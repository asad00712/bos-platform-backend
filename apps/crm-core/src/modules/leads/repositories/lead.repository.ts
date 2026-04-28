import { Injectable } from '@nestjs/common';
import { LeadPriority } from '@bos-prisma/tenant';
import { TenantPrismaService } from '@bos/database';
import type { CreateLeadDto } from '../dto/create-lead.dto';
import type { UpdateLeadDto } from '../dto/update-lead.dto';
import type { LeadFilterDto } from '../dto/lead-filter.dto';
import type { LeadDto } from '../dto/lead.response.dto';

@Injectable()
export class LeadRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findMany(schemaName: string, filter: LeadFilterDto): Promise<{ data: LeadDto[]; total: number }> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 20;
    const where = this.buildWhere(filter);
    const [records, total] = await Promise.all([
      prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.lead.count({ where }),
    ]);
    return { data: records.map(this.toDto), total };
  }

  async findById(schemaName: string, id: string): Promise<LeadDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    return r ? this.toDto(r) : null;
  }

  async create(
    schemaName: string,
    dto: CreateLeadDto,
    createdByUserId?: string,
    contactId?: string,
  ): Promise<LeadDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.lead.create({
      data: {
        branchId:        dto.branchId,
        firstName:       dto.firstName,
        lastName:        dto.lastName        ?? null,
        email:           dto.email           ?? null,
        phone:           dto.phone           ?? null,
        company:         dto.company         ?? null,
        sourceId:        dto.sourceId        ?? null,
        statusId:        dto.statusId        ?? null,
        priority:        (dto.priority as LeadPriority) ?? LeadPriority.MEDIUM,
        estimatedValue:  dto.estimatedValue  ?? null,
        ownedByUserId:   dto.ownedByUserId   ?? null,
        notes:           dto.notes           ?? null,
        createdByUserId: createdByUserId     ?? null,
        contactId:       contactId           ?? null,
      },
    });
    return this.toDto(r);
  }

  async update(schemaName: string, id: string, dto: UpdateLeadDto): Promise<LeadDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined)      data['firstName']      = dto.firstName;
    if (dto.lastName !== undefined)       data['lastName']       = dto.lastName;
    if (dto.email !== undefined)          data['email']          = dto.email;
    if (dto.phone !== undefined)          data['phone']          = dto.phone;
    if (dto.company !== undefined)        data['company']        = dto.company;
    if (dto.sourceId !== undefined)       data['sourceId']       = dto.sourceId;
    if (dto.statusId !== undefined)       data['statusId']       = dto.statusId;
    if (dto.priority !== undefined)       data['priority']       = dto.priority as LeadPriority;
    if (dto.estimatedValue !== undefined) data['estimatedValue'] = dto.estimatedValue;
    if (dto.ownedByUserId !== undefined)  data['ownedByUserId']  = dto.ownedByUserId;
    if (dto.notes !== undefined)          data['notes']          = dto.notes;
    const r = await prisma.lead.update({ where: { id }, data });
    return this.toDto(r);
  }

  async convertLead(
    schemaName: string,
    id: string,
    contactId: string,
    convertedByUserId: string,
  ): Promise<LeadDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.lead.update({
      where: { id },
      data: { contactId, convertedAt: new Date(), convertedByUserId },
    });
    return this.toDto(r);
  }

  async softDelete(schemaName: string, id: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Tag helpers ──────────────────────────────────────────────────────────

  async addTag(schemaName: string, leadId: string, tagId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.entityTag.create({ data: { tagId, entityType: 'LEAD', entityId: leadId } });
  }

  async removeTag(schemaName: string, leadId: string, tagId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.entityTag.deleteMany({ where: { tagId, entityType: 'LEAD', entityId: leadId } });
  }

  async findTags(schemaName: string, leadId: string): Promise<{ id: string; name: string; color: string | null }[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const rows = await prisma.entityTag.findMany({
      where: { entityType: 'LEAD', entityId: leadId },
      include: { tag: { select: { id: true, name: true, color: true } } },
    });
    return rows.map((r) => r.tag);
  }

  private buildWhere(filter: LeadFilterDto) {
    const conditions: Record<string, unknown> = { deletedAt: null };
    if (filter.branchId)  conditions['branchId']  = filter.branchId;
    if (filter.statusId)  conditions['statusId']  = filter.statusId;
    if (filter.sourceId)  conditions['sourceId']  = filter.sourceId;
    if (filter.priority)  conditions['priority']  = filter.priority as LeadPriority;
    if (filter.converted === true)  conditions['convertedAt'] = { not: null };
    if (filter.converted === false) conditions['convertedAt'] = null;
    if (filter.search) {
      const t = filter.search;
      conditions['OR'] = [
        { firstName: { contains: t, mode: 'insensitive' } },
        { lastName:  { contains: t, mode: 'insensitive' } },
        { email:     { contains: t, mode: 'insensitive' } },
        { phone:     { contains: t, mode: 'insensitive' } },
      ];
    }
    return conditions;
  }

  private toDto(r: {
    id: string; branchId: string; contactId: string | null; firstName: string;
    lastName: string | null; email: string | null; phone: string | null; company: string | null;
    sourceId: string | null; statusId: string | null; priority: LeadPriority;
    estimatedValue: number | null; ownedByUserId: string | null; notes: string | null;
    convertedAt: Date | null; convertedByUserId: string | null; createdAt: Date; updatedAt: Date;
  }): LeadDto {
    return {
      id: r.id, branchId: r.branchId, contactId: r.contactId,
      firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone,
      company: r.company, sourceId: r.sourceId, statusId: r.statusId, priority: r.priority,
      estimatedValue: r.estimatedValue, ownedByUserId: r.ownedByUserId, notes: r.notes,
      convertedAt: r.convertedAt, convertedByUserId: r.convertedByUserId,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }
}
