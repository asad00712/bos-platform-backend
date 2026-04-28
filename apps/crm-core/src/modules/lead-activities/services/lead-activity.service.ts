import { BadRequestException, Injectable } from '@nestjs/common';
import { CorePrismaService, TenantPrismaService } from '@bos/database';
import { LeadNotFoundException, LeadActivityNotFoundException } from '@bos/errors';
import { LeadActivityRepository } from '../repositories/lead-activity.repository';
import type { CreateActivityDto } from '../dto/create-activity.dto';
import { LeadActivityType } from '../dto/create-activity.dto';
import type { UpdateActivityDto } from '../dto/update-activity.dto';
import type { ActivityQueryDto, MyTasksQueryDto } from '../dto/activity-query.dto';
import type {
  LeadActivityDto,
  LeadActivityListResponseDto,
  LeadActivitySummaryDto,
} from '../dto/lead-activity.dto';

@Injectable()
export class LeadActivityService {
  constructor(
    private readonly repo: LeadActivityRepository,
    private readonly corePrisma: CorePrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async createActivity(
    tenantId: string,
    leadId: string,
    dto: CreateActivityDto,
    userId: string,
  ): Promise<LeadActivityDto> {
    const schemaName = await this.getSchemaName(tenantId);
    await this.assertLeadExists(schemaName, leadId);

    if (dto.type === LeadActivityType.TASK && !dto.dueAt) {
      throw new BadRequestException('dueAt is required for TASK activities');
    }

    return this.repo.create(schemaName, leadId, dto, userId);
  }

  async listActivities(
    tenantId: string,
    leadId: string,
    query: ActivityQueryDto,
  ): Promise<LeadActivityListResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    await this.assertLeadExists(schemaName, leadId);

    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.repo.findMany(schemaName, leadId, query);
    return { items, total, page, limit };
  }

  async getActivitySummary(tenantId: string, leadId: string): Promise<LeadActivitySummaryDto> {
    const schemaName = await this.getSchemaName(tenantId);
    await this.assertLeadExists(schemaName, leadId);
    return this.repo.summary(schemaName, leadId);
  }

  async updateActivity(
    tenantId: string,
    leadId: string,
    activityId: string,
    dto: UpdateActivityDto,
  ): Promise<LeadActivityDto> {
    const schemaName = await this.getSchemaName(tenantId);
    await this.assertActivityBelongsToLead(schemaName, activityId, leadId);
    return this.repo.update(schemaName, activityId, dto);
  }

  async deleteActivity(
    tenantId: string,
    leadId: string,
    activityId: string,
  ): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    await this.assertActivityBelongsToLead(schemaName, activityId, leadId);
    await this.repo.softDelete(schemaName, activityId, leadId);
  }

  async getMyTasks(
    tenantId: string,
    userId: string,
    query: MyTasksQueryDto,
  ): Promise<LeadActivityListResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.repo.findMyTasks(schemaName, userId, query);
    return { items, total, page, limit };
  }

  // ---------------------------------------------------------------------------

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }

  private async assertLeadExists(schemaName: string, leadId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw new LeadNotFoundException();
  }

  private async assertActivityBelongsToLead(
    schemaName: string,
    activityId: string,
    leadId: string,
  ): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const activity = await prisma.leadActivity.findFirst({
      where: { id: activityId, leadId, deletedAt: null },
      select: { id: true },
    });
    if (!activity) throw new LeadActivityNotFoundException();
  }
}
