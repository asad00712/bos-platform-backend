import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '@bos/database';
import type { CreateLeadStatusDto } from '../dto/create-lead-status.dto';
import type { UpdateLeadStatusDto } from '../dto/update-lead-status.dto';
import type { LeadStatusDto } from '../dto/lead.response.dto';

@Injectable()
export class LeadStatusRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll(schemaName: string, branchId?: string): Promise<LeadStatusDto[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    return (await prisma.leadStatusConfig.findMany({
      where: { isActive: true, ...(branchId ? { branchId } : {}) },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    })).map(this.toDto);
  }

  async findById(schemaName: string, id: string): Promise<LeadStatusDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadStatusConfig.findUnique({ where: { id } });
    return r ? this.toDto(r) : null;
  }

  async findByBranchAndName(schemaName: string, branchId: string, name: string): Promise<LeadStatusDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadStatusConfig.findUnique({
      where: { branchId_name: { branchId, name } },
    });
    return r ? this.toDto(r) : null;
  }

  async create(schemaName: string, dto: CreateLeadStatusDto): Promise<LeadStatusDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadStatusConfig.create({
      data: {
        branchId:     dto.branchId,
        name:         dto.name,
        color:        dto.color ?? null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
    return this.toDto(r);
  }

  async update(schemaName: string, id: string, dto: UpdateLeadStatusDto): Promise<LeadStatusDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined)         data['name']         = dto.name;
    if (dto.color !== undefined)        data['color']        = dto.color;
    if (dto.displayOrder !== undefined) data['displayOrder'] = dto.displayOrder;
    if (dto.isActive !== undefined)     data['isActive']     = dto.isActive;
    const r = await prisma.leadStatusConfig.update({ where: { id }, data });
    return this.toDto(r);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.leadStatusConfig.delete({ where: { id } });
  }

  private toDto(r: {
    id: string; branchId: string; name: string; color: string | null;
    displayOrder: number; isSystem: boolean; isActive: boolean; createdAt: Date; updatedAt: Date;
  }): LeadStatusDto {
    return {
      id: r.id, branchId: r.branchId, name: r.name, color: r.color,
      displayOrder: r.displayOrder, isSystem: r.isSystem, isActive: r.isActive,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }
}
