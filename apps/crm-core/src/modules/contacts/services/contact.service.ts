import { Injectable } from '@nestjs/common';
import { CorePrismaService } from '@bos/database';
import { ContactNotFoundException, TagNotFoundException } from '@bos/errors';
import { ContactRepository } from '../repositories/contact.repository';
import { TagRepository } from '../../tags/repositories/tag.repository';
import type { CreateContactDto } from '../dto/create-contact.dto';
import type { UpdateContactDto } from '../dto/update-contact.dto';
import type { ContactFilterDto } from '../dto/contact-filter.dto';
import type { ContactDto, ContactListResponseDto } from '../dto/contact.response.dto';

@Injectable()
export class ContactService {
  constructor(
    private readonly repository: ContactRepository,
    private readonly tagRepository: TagRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  async listContacts(tenantId: string, filter: ContactFilterDto): Promise<ContactListResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 20;
    const { data, total } = await this.repository.findMany(schemaName, filter);
    return { data, total, page, limit };
  }

  async getContact(tenantId: string, id: string): Promise<ContactDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const contact = await this.repository.findById(schemaName, id);
    if (!contact) throw new ContactNotFoundException();
    return contact;
  }

  async createContact(
    tenantId: string,
    dto: CreateContactDto,
    createdByUserId: string,
    originLeadId?: string,
  ): Promise<ContactDto> {
    const schemaName = await this.getSchemaName(tenantId);
    return this.repository.create(schemaName, dto, createdByUserId, originLeadId);
  }

  async updateContact(tenantId: string, id: string, dto: UpdateContactDto): Promise<ContactDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new ContactNotFoundException();
    return this.repository.update(schemaName, id, dto);
  }

  async deleteContact(tenantId: string, id: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new ContactNotFoundException();
    await this.repository.softDelete(schemaName, id);
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async getContactTags(tenantId: string, contactId: string) {
    const schemaName = await this.getSchemaName(tenantId);
    const contact = await this.repository.findById(schemaName, contactId);
    if (!contact) throw new ContactNotFoundException();
    return this.repository.findTags(schemaName, contactId);
  }

  async addTag(tenantId: string, contactId: string, tagId: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const [contact, tag] = await Promise.all([
      this.repository.findById(schemaName, contactId),
      this.tagRepository.findById(schemaName, tagId),
    ]);
    if (!contact) throw new ContactNotFoundException();
    if (!tag) throw new TagNotFoundException();
    await this.repository.addTag(schemaName, contactId, tagId);
  }

  async removeTag(tenantId: string, contactId: string, tagId: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const contact = await this.repository.findById(schemaName, contactId);
    if (!contact) throw new ContactNotFoundException();
    await this.repository.removeTag(schemaName, contactId, tagId);
  }

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}
