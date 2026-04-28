import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '@bos/database';
import type { CreateLeadWebhookDto, UpdateLeadWebhookDto, LeadWebhookResponseDto } from '../dto/lead-webhook.dto';

@Injectable()
export class LeadWebhookRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll(schemaName: string, branchId?: string): Promise<LeadWebhookResponseDto[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const rows = await prisma.leadWebhook.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toDto);
  }

  async findById(schemaName: string, id: string): Promise<LeadWebhookResponseDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadWebhook.findUnique({ where: { id } });
    return r ? this.toDto(r) : null;
  }

  async findByToken(schemaName: string, token: string): Promise<LeadWebhookResponseDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadWebhook.findUnique({ where: { token } });
    return r ? this.toDto(r) : null;
  }

  async create(schemaName: string, dto: CreateLeadWebhookDto, token: string): Promise<LeadWebhookResponseDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadWebhook.create({
      data: {
        branchId: dto.branchId,
        sourceId: dto.sourceId ?? null,
        name: dto.name,
        token,
      },
    });
    return this.toDto(r);
  }

  async update(schemaName: string, id: string, dto: UpdateLeadWebhookDto): Promise<LeadWebhookResponseDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined)     data['name']     = dto.name;
    if (dto.sourceId !== undefined) data['sourceId'] = dto.sourceId;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;
    const r = await prisma.leadWebhook.update({ where: { id }, data });
    return this.toDto(r);
  }

  async updateToken(schemaName: string, id: string, token: string): Promise<LeadWebhookResponseDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadWebhook.update({ where: { id }, data: { token } });
    return this.toDto(r);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.leadWebhook.delete({ where: { id } });
  }

  private toDto(r: {
    id: string; branchId: string; sourceId: string | null; name: string;
    token: string; isActive: boolean; createdAt: Date; updatedAt: Date;
  }): LeadWebhookResponseDto {
    return {
      id: r.id, branchId: r.branchId, sourceId: r.sourceId,
      name: r.name, token: r.token, isActive: r.isActive,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }
}
