import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '@bos/database';
import type { CreateContactSourceDto } from '../dto/create-contact-source.dto';
import type { UpdateContactSourceDto } from '../dto/update-contact-source.dto';
import type { ContactSourceDto } from '../dto/contact.response.dto';

@Injectable()
export class ContactSourceRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll(schemaName: string, branchId?: string): Promise<ContactSourceDto[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const records = await prisma.contactSource.findMany({
      where: {
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return records.map(this.toDto);
  }

  async findById(schemaName: string, id: string): Promise<ContactSourceDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contactSource.findUnique({ where: { id } });
    return record ? this.toDto(record) : null;
  }

  async findByBranchAndName(schemaName: string, branchId: string, name: string): Promise<ContactSourceDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contactSource.findUnique({
      where: { branchId_name: { branchId, name } },
    });
    return record ? this.toDto(record) : null;
  }

  async create(schemaName: string, dto: CreateContactSourceDto): Promise<ContactSourceDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contactSource.create({
      data: { branchId: dto.branchId, name: dto.name },
    });
    return this.toDto(record);
  }

  async update(schemaName: string, id: string, dto: UpdateContactSourceDto): Promise<ContactSourceDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined)     data['name']     = dto.name;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;
    const record = await prisma.contactSource.update({ where: { id }, data });
    return this.toDto(record);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    // SET NULL on Contact.sourceId and Lead.sourceId cascades from FK
    await prisma.contactSource.delete({ where: { id } });
  }

  private toDto(record: {
    id: string; branchId: string; name: string; isSystem: boolean;
    isActive: boolean; createdAt: Date; updatedAt: Date;
  }): ContactSourceDto {
    return {
      id: record.id, branchId: record.branchId, name: record.name,
      isSystem: record.isSystem, isActive: record.isActive,
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }
}
