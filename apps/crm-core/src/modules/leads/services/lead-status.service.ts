import { Injectable } from '@nestjs/common';
import { CorePrismaService } from '@bos/database';
import { LeadStatusNotFoundException, LeadStatusNameConflictException } from '@bos/errors';
import { LeadStatusRepository } from '../repositories/lead-status.repository';
import type { CreateLeadStatusDto } from '../dto/create-lead-status.dto';
import type { UpdateLeadStatusDto } from '../dto/update-lead-status.dto';
import type { LeadStatusDto, LeadStatusListDto } from '../dto/lead.response.dto';

@Injectable()
export class LeadStatusService {
  constructor(
    private readonly repository: LeadStatusRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  async listStatuses(tenantId: string, branchId?: string): Promise<LeadStatusListDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const data = await this.repository.findAll(schemaName, branchId);
    return { data, total: data.length };
  }

  async createStatus(tenantId: string, dto: CreateLeadStatusDto): Promise<LeadStatusDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findByBranchAndName(schemaName, dto.branchId, dto.name);
    if (existing) throw new LeadStatusNameConflictException(dto.name);
    return this.repository.create(schemaName, dto);
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateLeadStatusDto): Promise<LeadStatusDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new LeadStatusNotFoundException();

    if (dto.name !== undefined && dto.name !== existing.name) {
      const conflict = await this.repository.findByBranchAndName(schemaName, existing.branchId, dto.name);
      if (conflict) throw new LeadStatusNameConflictException(dto.name);
    }

    return this.repository.update(schemaName, id, dto);
  }

  async deleteStatus(tenantId: string, id: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new LeadStatusNotFoundException();
    if (existing.isSystem) throw new LeadStatusNotFoundException(); // system statuses cannot be deleted
    await this.repository.delete(schemaName, id);
  }

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}
