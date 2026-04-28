import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '@bos/database';
import type { CreateContactListDto } from '../dto/create-contact-list.dto';
import type { UpdateContactListDto } from '../dto/update-contact-list.dto';
import type { ContactListDto } from '../dto/contact.response.dto';

@Injectable()
export class ContactListRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll(schemaName: string, branchId?: string): Promise<ContactListDto[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const records = await prisma.contactList.findMany({
      where: {
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(this.toDto);
  }

  async findById(schemaName: string, id: string): Promise<ContactListDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contactList.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    return record ? this.toDto(record) : null;
  }

  async findByBranchAndName(schemaName: string, branchId: string, name: string): Promise<ContactListDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contactList.findUnique({
      where: { branchId_name: { branchId, name } },
      include: { _count: { select: { members: true } } },
    });
    return record ? this.toDto(record) : null;
  }

  async create(schemaName: string, dto: CreateContactListDto, createdByUserId?: string): Promise<ContactListDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contactList.create({
      data: {
        branchId:        dto.branchId,
        name:            dto.name,
        description:     dto.description ?? null,
        createdByUserId: createdByUserId ?? null,
      },
      include: { _count: { select: { members: true } } },
    });
    return this.toDto(record);
  }

  async update(schemaName: string, id: string, dto: UpdateContactListDto): Promise<ContactListDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined)        data['name']        = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.isActive !== undefined)    data['isActive']    = dto.isActive;
    const record = await prisma.contactList.update({
      where: { id },
      data,
      include: { _count: { select: { members: true } } },
    });
    return this.toDto(record);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.contactList.delete({ where: { id } });
  }

  // ── Members ──────────────────────────────────────────────────────────────

  async isMember(schemaName: string, listId: string, contactId: string): Promise<boolean> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const row = await prisma.contactListMember.findUnique({
      where: { listId_contactId: { listId, contactId } },
    });
    return row !== null;
  }

  async addMember(schemaName: string, listId: string, contactId: string, addedByUserId?: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.contactListMember.create({
      data: { listId, contactId, addedByUserId: addedByUserId ?? null },
    });
  }

  async removeMember(schemaName: string, listId: string, contactId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.contactListMember.delete({
      where: { listId_contactId: { listId, contactId } },
    });
  }

  async listMembers(schemaName: string, listId: string, page: number, limit: number) {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const [rows, total] = await Promise.all([
      prisma.contactListMember.findMany({
        where: { listId },
        include: { contact: true },
        orderBy: { addedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactListMember.count({ where: { listId } }),
    ]);
    return { members: rows.map((r) => r.contact), total };
  }

  private toDto(record: {
    id: string; branchId: string; name: string; description: string | null;
    listType: string; isActive: boolean; createdAt: Date; updatedAt: Date;
    _count: { members: number };
  }): ContactListDto {
    return {
      id: record.id, branchId: record.branchId, name: record.name,
      description: record.description, listType: record.listType,
      isActive: record.isActive, memberCount: record._count.members,
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }
}
