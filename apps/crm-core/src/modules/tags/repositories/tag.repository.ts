import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '@bos/database';
import type { CreateTagDto } from '../dto/create-tag.dto';
import type { UpdateTagDto } from '../dto/update-tag.dto';
import type { TagDto } from '../dto/tag.response.dto';

@Injectable()
export class TagRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll(schemaName: string, search?: string): Promise<TagDto[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const records = await prisma.tag.findMany({
      where: search
        ? { name: { contains: search, mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
    });
    return records.map(this.toDto);
  }

  async findById(schemaName: string, id: string): Promise<TagDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.tag.findUnique({ where: { id } });
    return record ? this.toDto(record) : null;
  }

  async findByName(schemaName: string, name: string): Promise<TagDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.tag.findUnique({ where: { name } });
    return record ? this.toDto(record) : null;
  }

  async create(schemaName: string, dto: CreateTagDto): Promise<TagDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.tag.create({
      data: { name: dto.name, color: dto.color ?? null },
    });
    return this.toDto(record);
  }

  async update(schemaName: string, id: string, dto: UpdateTagDto): Promise<TagDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.color !== undefined) data['color'] = dto.color;
    const record = await prisma.tag.update({ where: { id }, data });
    return this.toDto(record);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.tag.delete({ where: { id } });
  }

  async isTagInUse(schemaName: string, tagId: string): Promise<boolean> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const count = await prisma.entityTag.count({ where: { tagId } });
    return count > 0;
  }

  private toDto(record: {
    id: string;
    name: string;
    color: string | null;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): TagDto {
    return {
      id:        record.id,
      name:      record.name,
      color:     record.color,
      isSystem:  record.isSystem,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
