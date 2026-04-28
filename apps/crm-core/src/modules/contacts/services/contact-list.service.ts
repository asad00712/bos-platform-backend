import { Injectable } from '@nestjs/common';
import { CorePrismaService } from '@bos/database';
import {
  ContactListNotFoundException,
  ContactListNameConflictException,
  ContactNotFoundException,
  ContactAlreadyInListException,
  ContactNotInListException,
} from '@bos/errors';
import { ContactListRepository } from '../repositories/contact-list.repository';
import { ContactRepository } from '../repositories/contact.repository';
import type { CreateContactListDto } from '../dto/create-contact-list.dto';
import type { UpdateContactListDto } from '../dto/update-contact-list.dto';
import type { ContactListDto, ContactListListDto } from '../dto/contact.response.dto';

@Injectable()
export class ContactListService {
  constructor(
    private readonly listRepository: ContactListRepository,
    private readonly contactRepository: ContactRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  async listContactLists(tenantId: string, branchId?: string): Promise<ContactListListDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const data = await this.listRepository.findAll(schemaName, branchId);
    return { data, total: data.length };
  }

  async createList(tenantId: string, dto: CreateContactListDto, userId: string): Promise<ContactListDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.listRepository.findByBranchAndName(schemaName, dto.branchId, dto.name);
    if (existing) throw new ContactListNameConflictException(dto.name);
    return this.listRepository.create(schemaName, dto, userId);
  }

  async updateList(tenantId: string, id: string, dto: UpdateContactListDto): Promise<ContactListDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.listRepository.findById(schemaName, id);
    if (!existing) throw new ContactListNotFoundException();

    if (dto.name !== undefined && dto.name !== existing.name) {
      const conflict = await this.listRepository.findByBranchAndName(schemaName, existing.branchId, dto.name);
      if (conflict) throw new ContactListNameConflictException(dto.name);
    }

    return this.listRepository.update(schemaName, id, dto);
  }

  async deleteList(tenantId: string, id: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.listRepository.findById(schemaName, id);
    if (!existing) throw new ContactListNotFoundException();
    await this.listRepository.delete(schemaName, id);
  }

  async addMember(tenantId: string, listId: string, contactId: string, userId: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const [list, contact] = await Promise.all([
      this.listRepository.findById(schemaName, listId),
      this.contactRepository.findById(schemaName, contactId),
    ]);
    if (!list) throw new ContactListNotFoundException();
    if (!contact) throw new ContactNotFoundException();

    const alreadyMember = await this.listRepository.isMember(schemaName, listId, contactId);
    if (alreadyMember) throw new ContactAlreadyInListException();

    await this.listRepository.addMember(schemaName, listId, contactId, userId);
  }

  async removeMember(tenantId: string, listId: string, contactId: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const list = await this.listRepository.findById(schemaName, listId);
    if (!list) throw new ContactListNotFoundException();

    const isMember = await this.listRepository.isMember(schemaName, listId, contactId);
    if (!isMember) throw new ContactNotInListException();

    await this.listRepository.removeMember(schemaName, listId, contactId);
  }

  async listMembers(tenantId: string, listId: string, page = 1, limit = 20) {
    const schemaName = await this.getSchemaName(tenantId);
    const list = await this.listRepository.findById(schemaName, listId);
    if (!list) throw new ContactListNotFoundException();
    return this.listRepository.listMembers(schemaName, listId, page, limit);
  }

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}
