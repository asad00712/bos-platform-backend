import { Injectable } from '@nestjs/common';
import { CorePrismaService } from '@bos/database';
import { LeadAssignmentConfigRepository } from '../repositories/lead-assignment-config.repository';
import type { UpsertLeadAssignmentConfigDto, LeadAssignmentConfigResponseDto } from '../dto/lead-assignment.dto';

@Injectable()
export class LeadAssignmentConfigService {
  constructor(
    private readonly repository: LeadAssignmentConfigRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  async getConfig(tenantId: string, branchId: string): Promise<LeadAssignmentConfigResponseDto | null> {
    const schemaName = await this.getSchemaName(tenantId);
    return this.repository.findByBranch(schemaName, branchId);
  }

  async upsertConfig(tenantId: string, dto: UpsertLeadAssignmentConfigDto): Promise<LeadAssignmentConfigResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    return this.repository.upsert(schemaName, dto);
  }

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}
