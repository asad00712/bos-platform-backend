import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CorePrismaService } from '@bos/database';
import {
  LeadNotFoundException,
  LeadAlreadyConvertedException,
  ContactNotFoundException,
  TagNotFoundException,
} from '@bos/errors';
import {
  QUEUE_NAMES,
  WORKFLOW_JOB_NAMES,
  type LeadCreatedJobPayload,
  type LeadStatusChangedJobPayload,
} from '@bos/queue';
import { LeadRepository } from '../repositories/lead.repository';
import { TagRepository } from '../../tags/repositories/tag.repository';
import { ContactRepository } from '../../contacts/repositories/contact.repository';
import type { CreateLeadDto } from '../dto/create-lead.dto';
import type { UpdateLeadDto } from '../dto/update-lead.dto';
import type { LeadFilterDto } from '../dto/lead-filter.dto';
import type { ConvertLeadDto } from '../dto/convert-lead.dto';
import type { LeadDto, LeadListResponseDto } from '../dto/lead.response.dto';

@Injectable()
export class LeadService {
  constructor(
    private readonly repository: LeadRepository,
    private readonly tagRepository: TagRepository,
    private readonly contactRepository: ContactRepository,
    private readonly corePrisma: CorePrismaService,
    @InjectQueue(QUEUE_NAMES.WORKFLOW) private readonly workflowQueue: Queue,
  ) {}

  async listLeads(tenantId: string, filter: LeadFilterDto): Promise<LeadListResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 20;
    const { data, total } = await this.repository.findMany(schemaName, filter);
    return { data, total, page, limit };
  }

  async getLead(tenantId: string, id: string): Promise<LeadDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const lead = await this.repository.findById(schemaName, id);
    if (!lead) throw new LeadNotFoundException();
    return lead;
  }

  /**
   * Creates a lead and auto-upserts a Contact (GHL/HubSpot model):
   *   - If lead.email matches an existing contact → link that contact
   *   - Otherwise → create a new contact from lead data
   * After lead creation, sets contact.originLeadId for traceability.
   * Emits crm.lead.created to the workflow queue for downstream automation.
   */
  async createLead(tenantId: string, dto: CreateLeadDto, userId: string): Promise<LeadDto> {
    const schemaName = await this.getSchemaName(tenantId);

    // 1. Upsert contact — dedup by email if provided
    let contactId: string;
    let isNewContact = false;

    if (dto.email) {
      const existing = await this.contactRepository.findByEmail(schemaName, dto.email);
      if (existing) {
        contactId = existing.id;
      } else {
        const newContact = await this.contactRepository.create(
          schemaName,
          {
            branchId:      dto.branchId,
            firstName:     dto.firstName,
            lastName:      dto.lastName,
            email:         dto.email,
            phone:         dto.phone,
            company:       dto.company,
            sourceId:      dto.sourceId,
            ownedByUserId: dto.ownedByUserId,
          },
          userId,
        );
        contactId = newContact.id;
        isNewContact = true;
      }
    } else {
      // No email — always create a new contact (no dedup possible)
      const newContact = await this.contactRepository.create(
        schemaName,
        {
          branchId:      dto.branchId,
          firstName:     dto.firstName,
          lastName:      dto.lastName,
          phone:         dto.phone,
          company:       dto.company,
          sourceId:      dto.sourceId,
          ownedByUserId: dto.ownedByUserId,
        },
        userId,
      );
      contactId = newContact.id;
      isNewContact = true;
    }

    // 2. Create lead with contactId already linked
    const lead = await this.repository.create(schemaName, dto, userId, contactId);

    // 3. If a new contact was created, stamp originLeadId for traceability
    if (isNewContact) {
      await this.contactRepository.setOriginLeadId(schemaName, contactId, lead.id);
    }

    // 4. Emit event — Automation module will handle welcome messages etc.
    await this.workflowQueue.add(
      WORKFLOW_JOB_NAMES.LEAD_CREATED,
      {
        tenantId,
        schemaName,
        leadId:          lead.id,
        contactId,
        branchId:        lead.branchId,
        createdByUserId: userId,
      } satisfies LeadCreatedJobPayload,
    );

    return lead;
  }

  /**
   * Updates a lead. If statusId changes, emits crm.lead.status_changed
   * so the Automation module can trigger configured rules (e.g. notify on drop).
   */
  async updateLead(
    tenantId: string,
    id: string,
    dto: UpdateLeadDto,
    userId: string,
  ): Promise<LeadDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new LeadNotFoundException();

    const updated = await this.repository.update(schemaName, id, dto);

    // Emit status change event only when statusId actually changed
    if (dto.statusId !== undefined && dto.statusId !== existing.statusId) {
      await this.workflowQueue.add(
        WORKFLOW_JOB_NAMES.LEAD_STATUS_CHANGED,
        {
          tenantId,
          schemaName,
          leadId:          id,
          contactId:       existing.contactId,
          branchId:        existing.branchId,
          oldStatusId:     existing.statusId,
          newStatusId:     dto.statusId ?? null,
          changedByUserId: userId,
        } satisfies LeadStatusChangedJobPayload,
      );
    }

    return updated;
  }

  async deleteLead(tenantId: string, id: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new LeadNotFoundException();
    await this.repository.softDelete(schemaName, id);
  }

  /**
   * Converts a lead to a contact.
   *
   * Since createLead now always links a contact, this endpoint is used to:
   *   - Re-link to a different existing contact (dto.contactId provided)
   *   - Or mark the auto-created contact as the final qualified contact (dto empty)
   *
   * Sets lead.convertedAt = now(). Throws CRM_8003 if already converted.
   */
  async convertLead(tenantId: string, leadId: string, dto: ConvertLeadDto, userId: string): Promise<LeadDto> {
    const schemaName = await this.getSchemaName(tenantId);

    const lead = await this.repository.findById(schemaName, leadId);
    if (!lead) throw new LeadNotFoundException();
    if (lead.convertedAt !== null) throw new LeadAlreadyConvertedException();

    let contactId: string;

    if (dto.contactId) {
      // Explicit re-link to a different contact
      const existingContact = await this.contactRepository.findById(schemaName, dto.contactId);
      if (!existingContact) throw new ContactNotFoundException();
      contactId = dto.contactId;
    } else {
      // Use the already-linked contact (auto-created at lead creation)
      // If for some reason there's no contact yet, create one now
      if (lead.contactId) {
        contactId = lead.contactId;
      } else {
        const newContact = await this.contactRepository.create(
          schemaName,
          {
            branchId:      lead.branchId,
            firstName:     lead.firstName,
            lastName:      lead.lastName   ?? undefined,
            email:         lead.email      ?? undefined,
            phone:         lead.phone      ?? undefined,
            company:       lead.company    ?? undefined,
            sourceId:      lead.sourceId   ?? undefined,
            ownedByUserId: lead.ownedByUserId ?? undefined,
          },
          userId,
          leadId,
        );
        contactId = newContact.id;
      }
    }

    return this.repository.convertLead(schemaName, leadId, contactId, userId);
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async getLeadTags(tenantId: string, leadId: string) {
    const schemaName = await this.getSchemaName(tenantId);
    const lead = await this.repository.findById(schemaName, leadId);
    if (!lead) throw new LeadNotFoundException();
    return this.repository.findTags(schemaName, leadId);
  }

  async addTag(tenantId: string, leadId: string, tagId: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const [lead, tag] = await Promise.all([
      this.repository.findById(schemaName, leadId),
      this.tagRepository.findById(schemaName, tagId),
    ]);
    if (!lead) throw new LeadNotFoundException();
    if (!tag) throw new TagNotFoundException();
    await this.repository.addTag(schemaName, leadId, tagId);
  }

  async removeTag(tenantId: string, leadId: string, tagId: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const lead = await this.repository.findById(schemaName, leadId);
    if (!lead) throw new LeadNotFoundException();
    await this.repository.removeTag(schemaName, leadId, tagId);
  }

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}
