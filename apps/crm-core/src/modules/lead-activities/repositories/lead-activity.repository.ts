import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@bos-prisma/tenant';
import { TenantPrismaService } from '@bos/database';
import type { CreateActivityDto } from '../dto/create-activity.dto';
import type { UpdateActivityDto } from '../dto/update-activity.dto';
import type { ActivityQueryDto, MyTasksQueryDto } from '../dto/activity-query.dto';
import type { LeadActivityDto, LeadActivitySummaryDto } from '../dto/lead-activity.dto';

@Injectable()
export class LeadActivityRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(
    schemaName: string,
    leadId: string,
    dto: CreateActivityDto,
    createdByUserId: string,
  ): Promise<LeadActivityDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const now = new Date();

    const isTask = dto.type === 'TASK';

    const [activity] = await Promise.all([
      prisma.leadActivity.create({
        data: {
          leadId,
          type:             dto.type as $Enums.LeadActivityType,
          direction:        (dto.direction as $Enums.ActivityDirection | undefined) ?? null,
          subject:          dto.subject          ?? null,
          body:             dto.body             ?? null,
          outcome:          (dto.outcome as $Enums.CallOutcome | undefined) ?? null,
          durationSeconds:  dto.durationSeconds  ?? null,
          recordingUrl:     dto.recordingUrl     ?? null,
          transcriptUrl:    dto.transcriptUrl    ?? null,
          scheduledAt:      dto.scheduledAt    ? new Date(dto.scheduledAt)   : null,
          completedAt:      dto.completedAt   ? new Date(dto.completedAt)    : null,
          dueAt:            dto.dueAt          ? new Date(dto.dueAt)         : null,
          taskStatus:       isTask ? $Enums.ActivityTaskStatus.PENDING : null,
          createdByUserId,
          assignedToUserId: dto.assignedToUserId ?? null,
          metadata:         dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          updatedAt:        now,
        },
      }),
      prisma.lead.update({
        where: { id: leadId },
        data: {
          lastActivityAt:  now,
          touchpointCount: { increment: 1 },
        },
      }),
    ]);

    if (isTask && dto.dueAt) {
      await this.recalcNextFollowUp(schemaName, leadId);
    }

    return this.toDto(activity);
  }

  async findMany(
    schemaName: string,
    leadId: string,
    query: ActivityQueryDto,
  ): Promise<{ items: LeadActivityDto[]; total: number }> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      leadId,
      deletedAt: null as Date | null,
      ...(query.type ? { type: query.type as $Enums.LeadActivityType } : {}),
    };

    const [records, total] = await Promise.all([
      prisma.leadActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leadActivity.count({ where }),
    ]);

    return { items: records.map(this.toDto), total };
  }

  async findById(schemaName: string, activityId: string): Promise<LeadActivityDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const r = await prisma.leadActivity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    return r ? this.toDto(r) : null;
  }

  async update(
    schemaName: string,
    activityId: string,
    dto: UpdateActivityDto,
  ): Promise<LeadActivityDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const now = new Date();

    const data: Record<string, unknown> = { updatedAt: now };
    if (dto.subject          !== undefined) data['subject']          = dto.subject          ?? null;
    if (dto.body             !== undefined) data['body']             = dto.body             ?? null;
    if (dto.outcome          !== undefined) data['outcome']          = dto.outcome          ?? null;
    if (dto.durationSeconds  !== undefined) data['durationSeconds']  = dto.durationSeconds  ?? null;
    if (dto.recordingUrl     !== undefined) data['recordingUrl']     = dto.recordingUrl     ?? null;
    if (dto.transcriptUrl    !== undefined) data['transcriptUrl']    = dto.transcriptUrl    ?? null;
    if (dto.scheduledAt      !== undefined) data['scheduledAt']      = dto.scheduledAt    ? new Date(dto.scheduledAt)  : null;
    if (dto.completedAt      !== undefined) data['completedAt']      = dto.completedAt   ? new Date(dto.completedAt)   : null;
    if (dto.dueAt            !== undefined) data['dueAt']            = dto.dueAt         ? new Date(dto.dueAt)         : null;
    if (dto.taskStatus       !== undefined) data['taskStatus']       = dto.taskStatus       ?? null;
    if (dto.assignedToUserId !== undefined) data['assignedToUserId'] = dto.assignedToUserId ?? null;
    if (dto.metadata         !== undefined) data['metadata']         = dto.metadata         ?? null;

    const activity = await prisma.leadActivity.update({
      where: { id: activityId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
    });

    if (dto.taskStatus !== undefined || dto.dueAt !== undefined) {
      await this.recalcNextFollowUp(schemaName, activity.leadId);
    }

    return this.toDto(activity);
  }

  async softDelete(schemaName: string, activityId: string, leadId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const now = new Date();

    await prisma.leadActivity.update({
      where: { id: activityId },
      data: { deletedAt: now, updatedAt: now },
    });

    await Promise.all([
      prisma.lead.update({
        where: { id: leadId },
        data: { touchpointCount: { decrement: 1 } },
      }),
      this.recalcLastActivityAt(schemaName, leadId),
      this.recalcNextFollowUp(schemaName, leadId),
    ]);
  }

  async summary(schemaName: string, leadId: string): Promise<LeadActivitySummaryDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);

    const [grouped, lead] = await Promise.all([
      prisma.leadActivity.groupBy({
        by: ['type'],
        where: { leadId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.lead.findFirst({
        where: { id: leadId },
        select: { lastActivityAt: true, nextFollowUpAt: true, touchpointCount: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      counts[g.type] = g._count.id;
      total += g._count.id;
    }

    return {
      counts,
      total,
      lastActivityAt:  lead?.lastActivityAt?.toISOString()  ?? null,
      nextFollowUpAt:  lead?.nextFollowUpAt?.toISOString()  ?? null,
      touchpointCount: lead?.touchpointCount ?? 0,
    };
  }

  async findMyTasks(
    schemaName: string,
    assignedToUserId: string,
    query: MyTasksQueryDto,
  ): Promise<{ items: LeadActivityDto[]; total: number }> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const statusFilter: $Enums.ActivityTaskStatus[] = query.status
      ? [query.status as $Enums.ActivityTaskStatus]
      : [$Enums.ActivityTaskStatus.PENDING, $Enums.ActivityTaskStatus.IN_PROGRESS];

    const where = {
      type:             $Enums.LeadActivityType.TASK,
      assignedToUserId,
      taskStatus:       { in: statusFilter },
      deletedAt:        null as Date | null,
    };

    const [records, total] = await Promise.all([
      prisma.leadActivity.findMany({
        where,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leadActivity.count({ where }),
    ]);

    return { items: records.map(this.toDto), total };
  }

  // ---------------------------------------------------------------------------
  // Denorm helpers
  // ---------------------------------------------------------------------------

  private async recalcNextFollowUp(schemaName: string, leadId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const earliest = await prisma.leadActivity.findFirst({
      where: {
        leadId,
        type:       $Enums.LeadActivityType.TASK,
        taskStatus: { in: [$Enums.ActivityTaskStatus.PENDING, $Enums.ActivityTaskStatus.IN_PROGRESS] },
        dueAt:      { not: null },
        deletedAt:  null,
      },
      orderBy: { dueAt: 'asc' },
      select:  { dueAt: true },
    });
    await prisma.lead.update({
      where: { id: leadId },
      data:  { nextFollowUpAt: earliest?.dueAt ?? null },
    });
  }

  private async recalcLastActivityAt(schemaName: string, leadId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const latest = await prisma.leadActivity.findFirst({
      where:   { leadId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select:  { createdAt: true },
    });
    await prisma.lead.update({
      where: { id: leadId },
      data:  { lastActivityAt: latest?.createdAt ?? null },
    });
  }

  // ---------------------------------------------------------------------------
  // Mapper
  // ---------------------------------------------------------------------------

  private toDto(r: {
    id: string;
    leadId: string;
    type: string;
    direction: string | null;
    subject: string | null;
    body: string | null;
    outcome: string | null;
    durationSeconds: number | null;
    recordingUrl: string | null;
    transcriptUrl: string | null;
    scheduledAt: Date | null;
    completedAt: Date | null;
    dueAt: Date | null;
    taskStatus: string | null;
    createdByUserId: string;
    assignedToUserId: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): LeadActivityDto {
    return {
      id:               r.id,
      leadId:           r.leadId,
      type:             r.type,
      direction:        r.direction,
      subject:          r.subject,
      body:             r.body,
      outcome:          r.outcome,
      durationSeconds:  r.durationSeconds,
      recordingUrl:     r.recordingUrl,
      transcriptUrl:    r.transcriptUrl,
      scheduledAt:      r.scheduledAt?.toISOString() ?? null,
      completedAt:      r.completedAt?.toISOString() ?? null,
      dueAt:            r.dueAt?.toISOString()        ?? null,
      taskStatus:       r.taskStatus,
      createdByUserId:  r.createdByUserId,
      assignedToUserId: r.assignedToUserId,
      metadata:         r.metadata,
      createdAt:        r.createdAt.toISOString(),
      updatedAt:        r.updatedAt.toISOString(),
    };
  }
}
