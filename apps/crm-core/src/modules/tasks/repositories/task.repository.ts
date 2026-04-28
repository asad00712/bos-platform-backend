import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@bos-prisma/tenant';
import { TenantPrismaService } from '@bos/database';
import type { CreateTaskDto } from '../dto/create-task.dto';
import type { UpdateTaskDto } from '../dto/update-task.dto';
import type { TaskQueryDto, UpdateChecklistItemDto } from '../dto/task-query.dto';
import type { TaskDto, TaskListResponseDto, TaskChecklistDto, TaskChecklistItemDto } from '../dto/task.dto';

// ---------------------------------------------------------------------------
// Shape returned by Prisma when including assignees + checklists
// ---------------------------------------------------------------------------
type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    assignees:  true;
    checklists: { include: { items: true } };
  };
}>;

type SubtaskRow = { id: string; title: string; status: string; priority: string; dueAt: Date | null };

@Injectable()
export class TaskRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(
    schemaName: string,
    dto: CreateTaskDto,
    createdByUserId: string,
  ): Promise<TaskDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const now = new Date();

    const task = await prisma.task.create({
      data: {
        title:           dto.title,
        description:     dto.description        ?? null,
        type:            (dto.type            as $Enums.TaskType)     ?? $Enums.TaskType.TODO,
        status:          (dto.status          as $Enums.TaskStatus)   ?? $Enums.TaskStatus.TODO,
        priority:        (dto.priority        as $Enums.TaskPriority) ?? $Enums.TaskPriority.NORMAL,
        startDate:       dto.startDate     ? new Date(dto.startDate) : null,
        dueAt:           dto.dueAt         ? new Date(dto.dueAt)     : null,
        points:          dto.points           ?? null,
        timeEstimate:    dto.timeEstimate     ?? null,
        recurrenceRule:  dto.recurrenceRule   ?? null,
        reminders:       dto.reminders        ? (dto.reminders as Prisma.InputJsonValue) : Prisma.JsonNull,
        entityType:      (dto.entityType    as $Enums.TaskEntityType | undefined) ?? null,
        entityId:        dto.entityId         ?? null,
        parentTaskId:    dto.parentTaskId     ?? null,
        createdByUserId,
        metadata:        dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        updatedAt:       now,
        // Create assignees in the same query if provided
        assignees: dto.assigneeIds?.length
          ? {
              createMany: {
                data: dto.assigneeIds.map((userId) => ({
                  userId,
                  assignedByUserId: createdByUserId,
                })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: {
        assignees:  true,
        checklists: { include: { items: { orderBy: { displayOrder: 'asc' } } }, orderBy: { displayOrder: 'asc' } },
      },
    });

    return this.toDto(task);
  }

  async findMany(
    schemaName: string,
    query: TaskQueryDto,
  ): Promise<TaskListResponseDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const now   = new Date();

    const where: Prisma.TaskWhereInput = { deletedAt: null };

    if (query.status)     where.status     = query.status as $Enums.TaskStatus;
    if (query.priority)   where.priority   = query.priority as $Enums.TaskPriority;
    if (query.type)       where.type       = query.type as $Enums.TaskType;
    if (query.entityType) where.entityType = query.entityType as $Enums.TaskEntityType;
    if (query.entityId)   where.entityId   = query.entityId;
    if (query.parentTaskId) where.parentTaskId = query.parentTaskId;

    // topLevel=true → parentTaskId IS NULL; topLevel=false → IS NOT NULL
    if (query.topLevel === true)  where.parentTaskId = null;
    if (query.topLevel === false) where.parentTaskId = { not: null };

    if (query.dueFrom || query.dueTo) {
      where.dueAt = {
        ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
        ...(query.dueTo   ? { lte: new Date(query.dueTo) }   : {}),
      };
    }

    if (query.overdue) {
      where.dueAt   = { lt: now };
      where.status  = { notIn: [$Enums.TaskStatus.DONE, $Enums.TaskStatus.CANCELLED] };
    }

    // assigneeId filter — task must have this user in its assignees
    if (query.assigneeId) {
      where.assignees = { some: { userId: query.assigneeId } };
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignees:  true,
          checklists: { include: { items: { orderBy: { displayOrder: 'asc' } } }, orderBy: { displayOrder: 'asc' } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return { items: tasks.map(this.toDto), total, page, limit };
  }

  async findById(schemaName: string, taskId: string): Promise<TaskDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);

    const [task, subtasks] = await Promise.all([
      prisma.task.findFirst({
        where: { id: taskId, deletedAt: null },
        include: {
          assignees:  true,
          checklists: { include: { items: { orderBy: { displayOrder: 'asc' } } }, orderBy: { displayOrder: 'asc' } },
        },
      }),
      prisma.task.findMany({
        where:   { parentTaskId: taskId, deletedAt: null },
        select:  { id: true, title: true, status: true, priority: true, dueAt: true },
        orderBy: { createdAt: 'asc' },
      }) as Promise<SubtaskRow[]>,
    ]);

    if (!task) return null;

    const dto = this.toDto(task);
    dto.subtasks = subtasks.map((s) => ({
      id:       s.id,
      title:    s.title,
      status:   s.status,
      priority: s.priority,
      dueAt:    s.dueAt?.toISOString() ?? null,
    }));
    return dto;
  }

  async update(schemaName: string, taskId: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const now = new Date();

    const data: Record<string, unknown> = { updatedAt: now };
    if (dto.title           !== undefined) data['title']          = dto.title;
    if (dto.description     !== undefined) data['description']    = dto.description    ?? null;
    if (dto.type            !== undefined) data['type']           = dto.type;
    if (dto.status          !== undefined) data['status']         = dto.status;
    if (dto.priority        !== undefined) data['priority']       = dto.priority;
    if (dto.startDate       !== undefined) data['startDate']      = dto.startDate    ? new Date(dto.startDate)  : null;
    if (dto.dueAt           !== undefined) data['dueAt']          = dto.dueAt        ? new Date(dto.dueAt)      : null;
    if (dto.completedAt     !== undefined) data['completedAt']    = dto.completedAt  ? new Date(dto.completedAt): null;
    if (dto.points          !== undefined) data['points']         = dto.points        ?? null;
    if (dto.timeEstimate    !== undefined) data['timeEstimate']   = dto.timeEstimate  ?? null;
    if (dto.recurrenceRule  !== undefined) data['recurrenceRule'] = dto.recurrenceRule ?? null;
    if (dto.reminders       !== undefined) data['reminders']      = dto.reminders ? (dto.reminders as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    if (dto.metadata        !== undefined) data['metadata']       = dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull;

    // Auto-stamp completedAt when status→DONE and not already set
    if (dto.status === 'DONE' && data['completedAt'] === undefined) {
      data['completedAt'] = now;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data:  data as any,
      include: {
        assignees:  true,
        checklists: { include: { items: { orderBy: { displayOrder: 'asc' } } }, orderBy: { displayOrder: 'asc' } },
      },
    });

    return this.toDto(task);
  }

  async softDelete(schemaName: string, taskId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.task.update({
      where: { id: taskId },
      data:  { deletedAt: new Date(), updatedAt: new Date() },
    });
  }

  // ── Assignees ─────────────────────────────────────────────────────────────

  async addAssignee(
    schemaName: string,
    taskId: string,
    userId: string,
    assignedByUserId: string,
  ): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.taskAssignee.upsert({
      where:  { taskId_userId: { taskId, userId } },
      create: { taskId, userId, assignedByUserId },
      update: {},
    });
  }

  async removeAssignee(schemaName: string, taskId: string, userId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.taskAssignee.deleteMany({ where: { taskId, userId } });
  }

  // ── Checklists ────────────────────────────────────────────────────────────

  async createChecklist(
    schemaName: string,
    taskId: string,
    title: string,
    displayOrder: number,
  ): Promise<TaskChecklistDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const checklist = await prisma.taskChecklist.create({
      data:    { taskId, title, displayOrder, updatedAt: new Date() },
      include: { items: true },
    });
    return this.toChecklistDto(checklist);
  }

  async deleteChecklist(schemaName: string, checklistId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.taskChecklist.delete({ where: { id: checklistId } });
  }

  async findChecklist(schemaName: string, checklistId: string, taskId: string) {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    return prisma.taskChecklist.findFirst({ where: { id: checklistId, taskId } });
  }

  // ── Checklist Items ───────────────────────────────────────────────────────

  async createChecklistItem(
    schemaName: string,
    checklistId: string,
    title: string,
    displayOrder: number,
  ): Promise<TaskChecklistItemDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const item = await prisma.taskChecklistItem.create({
      data: { checklistId, title, displayOrder, updatedAt: new Date() },
    });
    return this.toItemDto(item);
  }

  async updateChecklistItem(
    schemaName: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
    userId: string,
  ): Promise<TaskChecklistItemDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const now = new Date();

    const data: Record<string, unknown> = { updatedAt: now };
    if (dto.title        !== undefined) data['title']        = dto.title;
    if (dto.displayOrder !== undefined) data['displayOrder'] = dto.displayOrder;
    if (dto.isChecked !== undefined) {
      data['isChecked']       = dto.isChecked;
      data['checkedAt']       = dto.isChecked ? now : null;
      data['checkedByUserId'] = dto.isChecked ? userId : null;
    }

    const item = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data:  data as any,
    });
    return this.toItemDto(item);
  }

  async deleteChecklistItem(schemaName: string, itemId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.taskChecklistItem.delete({ where: { id: itemId } });
  }

  async findChecklistItem(schemaName: string, itemId: string, checklistId: string) {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    return prisma.taskChecklistItem.findFirst({ where: { id: itemId, checklistId } });
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private toDto(r: TaskWithRelations): TaskDto {
    return {
      id:             r.id,
      title:          r.title,
      description:    r.description,
      type:           r.type,
      status:         r.status,
      priority:       r.priority,
      startDate:      r.startDate?.toISOString()   ?? null,
      dueAt:          r.dueAt?.toISOString()        ?? null,
      completedAt:    r.completedAt?.toISOString()  ?? null,
      points:         r.points,
      timeEstimate:   r.timeEstimate,
      recurrenceRule: r.recurrenceRule,
      reminders:      Array.isArray(r.reminders) ? (r.reminders as string[]) : null,
      entityType:     r.entityType,
      entityId:       r.entityId,
      parentTaskId:   r.parentTaskId,
      watchers:       Array.isArray(r.watchers) ? (r.watchers as string[]) : null,
      createdByUserId: r.createdByUserId,
      metadata:       r.metadata,
      assignees:      r.assignees.map((a) => ({
        userId:           a.userId,
        assignedAt:       a.assignedAt.toISOString(),
        assignedByUserId: a.assignedByUserId,
      })),
      checklists: r.checklists.map(this.toChecklistDto),
      createdAt:  r.createdAt.toISOString(),
      updatedAt:  r.updatedAt.toISOString(),
    };
  }

  private toChecklistDto(c: {
    id: string; taskId: string; title: string; displayOrder: number;
    createdAt: Date; updatedAt: Date;
    items: Array<{
      id: string; checklistId: string; title: string; isChecked: boolean;
      checkedAt: Date | null; checkedByUserId: string | null;
      displayOrder: number; createdAt: Date; updatedAt: Date;
    }>;
  }): TaskChecklistDto {
    return {
      id:           c.id,
      taskId:       c.taskId,
      title:        c.title,
      displayOrder: c.displayOrder,
      items:        c.items.map(this.toItemDto),
      createdAt:    c.createdAt.toISOString(),
      updatedAt:    c.updatedAt.toISOString(),
    };
  }

  private toItemDto(i: {
    id: string; checklistId: string; title: string; isChecked: boolean;
    checkedAt: Date | null; checkedByUserId: string | null;
    displayOrder: number; createdAt: Date; updatedAt: Date;
  }): TaskChecklistItemDto {
    return {
      id:              i.id,
      checklistId:     i.checklistId,
      title:           i.title,
      isChecked:       i.isChecked,
      checkedAt:       i.checkedAt?.toISOString() ?? null,
      checkedByUserId: i.checkedByUserId,
      displayOrder:    i.displayOrder,
      createdAt:       i.createdAt.toISOString(),
      updatedAt:       i.updatedAt.toISOString(),
    };
  }
}
