import { Injectable } from '@nestjs/common';
import { LeadAssignmentMode } from '@bos-prisma/tenant';
import { TenantPrismaService } from '@bos/database';
import type { UpsertLeadAssignmentConfigDto, LeadAssignmentConfigResponseDto } from '../dto/lead-assignment.dto';

@Injectable()
export class LeadAssignmentConfigRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findByBranch(schemaName: string, branchId: string): Promise<LeadAssignmentConfigResponseDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadAssignmentConfig.findUnique({ where: { branchId } });
    return r ? this.toDto(r) : null;
  }

  async upsert(schemaName: string, dto: UpsertLeadAssignmentConfigDto): Promise<LeadAssignmentConfigResponseDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadAssignmentConfig.upsert({
      where: { branchId: dto.branchId },
      create: {
        branchId:        dto.branchId,
        assignmentMode:  (dto.assignmentMode as LeadAssignmentMode) ?? LeadAssignmentMode.ROUND_ROBIN,
        eligibleRoleIds: dto.eligibleRoleIds ?? [],
        isActive:        dto.isActive ?? true,
      },
      update: {
        ...(dto.assignmentMode !== undefined && { assignmentMode: dto.assignmentMode as LeadAssignmentMode }),
        ...(dto.eligibleRoleIds !== undefined && { eligibleRoleIds: dto.eligibleRoleIds }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return this.toDto(r);
  }

  /** Returns active eligible agents for round-robin: role in eligibleRoleIds + roundRobinAvailable=true */
  async findEligibleAgents(
    schemaName: string,
    branchId: string,
    eligibleRoleIds: string[],
  ): Promise<string[]> {
    if (eligibleRoleIds.length === 0) return [];
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const memberships = await prisma.userBranchMembership.findMany({
      where: {
        branchId,
        revokedAt: null,
        roundRobinAvailable: true,
        roleId: { in: eligibleRoleIds },
      },
      select: { userId: true },
      orderBy: { userId: 'asc' }, // stable ordering
    });
    // Deduplicate — a user could have multiple matching role rows
    return [...new Set(memberships.map((m) => m.userId))];
  }

  private toDto(r: {
    id: string; branchId: string; assignmentMode: LeadAssignmentMode;
    eligibleRoleIds: unknown; isActive: boolean; createdAt: Date; updatedAt: Date;
  }): LeadAssignmentConfigResponseDto {
    return {
      id: r.id,
      branchId: r.branchId,
      assignmentMode: r.assignmentMode,
      eligibleRoleIds: Array.isArray(r.eligibleRoleIds) ? (r.eligibleRoleIds as string[]) : [],
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
