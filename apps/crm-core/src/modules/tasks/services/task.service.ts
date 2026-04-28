import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CorePrismaService, TenantPrismaService } from '@bos/database';
import {
  TaskNotFoundException,
  TaskChecklistNotFoundException,
  TaskChecklistItemNotFoundException,
} from '@bos/errors';
import {
  QUEUE_NAMES,
  MAIL_JOB_NAMES,
  EmailTemplateId,
  type SendEmailJobPayload,
  type TaskAssignedTemplateData,
} from '@bos/queue';
import { ConfigService } from '@nestjs/config';
import { TaskRepository } from '../repositories/task.repository';
import type { CreateTaskDto } from '../dto/create-task.dto';
import type { UpdateTaskDto } from '../dto/update-task.dto';
import type {
  TaskQueryDto,
  CreateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
} from '../dto/task-query.dto';
import type {
  TaskDto,
  TaskListResponseDto,
  TaskChecklistDto,
  TaskChecklistItemDto,
} from '../dto/task.dto';

@Injectable()
export class TaskService {
  private readonly frontendUrl: string;

  constructor(
    private readonly repo: TaskRepository,
    private readonly corePrisma: CorePrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue,
  ) {
    this.frontendUrl = this.config.get<string>('APP_FRONTEND_URL') ?? 'http://localhost:3000';
  }

  // ── Core CRUD ─────────────────────────────────────────────────────────────

  async createTask(tenantId: string, dto: CreateTaskDto, userId: string): Promise<TaskDto> {
    const schema = await this.getSchema(tenantId);
    return this.repo.create(schema, dto, userId);
  }

  async listTasks(tenantId: string, query: TaskQueryDto): Promise<TaskListResponseDto> {
    const schema = await this.getSchema(tenantId);
    return this.repo.findMany(schema, query);
  }

  async getTask(tenantId: string, taskId: string): Promise<TaskDto> {
    const schema = await this.getSchema(tenantId);
    const task   = await this.repo.findById(schema, taskId);
    if (!task) throw new TaskNotFoundException();
    return task;
  }

  async updateTask(tenantId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const schema = await this.getSchema(tenantId);
    await this.assertTaskExists(schema, taskId);
    return this.repo.update(schema, taskId, dto);
  }

  async deleteTask(tenantId: string, taskId: string): Promise<void> {
    const schema = await this.getSchema(tenantId);
    await this.assertTaskExists(schema, taskId);
    await this.repo.softDelete(schema, taskId);
  }

  // ── Assignees ─────────────────────────────────────────────────────────────

  async addAssignee(
    tenantId: string,
    taskId: string,
    userId: string,
    byUserId: string,
  ): Promise<void> {
    const schema = await this.getSchema(tenantId);
    await this.assertTaskExists(schema, taskId);
    await this.repo.addAssignee(schema, taskId, userId, byUserId);

    // Notify the assigned user — run in parallel, non-blocking
    void this.notifyTaskAssigned(tenantId, schema, taskId, userId, byUserId);
  }

  private async notifyTaskAssigned(
    tenantId: string,
    schema:   string,
    taskId:   string,
    userId:   string,
    byUserId: string,
  ): Promise<void> {
    try {
      const prisma = this.tenantPrisma.forSchema(schema);
      const [task, assignee, assigner] = await Promise.all([
        prisma.task.findFirst({ where: { id: taskId, deletedAt: null }, select: { title: true, dueAt: true } }),
        this.corePrisma.user.findUnique({ where: { id: userId },   select: { email: true, firstName: true } }),
        this.corePrisma.user.findUnique({ where: { id: byUserId }, select: { firstName: true, lastName: true } }),
      ]);

      if (!task || !assignee) return;

      const assignerName = assigner
        ? `${assigner.firstName} ${assigner.lastName ?? ''}`.trim()
        : 'A team member';

      const templateData: TaskAssignedTemplateData = {
        assigneeName: assignee.firstName,
        assignerName,
        taskTitle:    task.title,
        taskDueAt:    task.dueAt
          ? task.dueAt.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
          : null,
        taskUrl: `${this.frontendUrl}/tasks/${taskId}`,
      };

      const payload: SendEmailJobPayload = {
        tenantId,
        recipientEmail:    assignee.email,
        subject:           `You've been assigned a task: ${task.title}`,
        templateId:        EmailTemplateId.TASK_ASSIGNED,
        templateData:      templateData as unknown as Record<string, unknown>,
        triggeredByUserId: byUserId,
        correlationId:     null,
      };

      await this.mailQueue.add(MAIL_JOB_NAMES.SEND_EMAIL, payload);

      // #TODO: also emit in-app WebSocket notification here — requires Notification module
      // #TODO: send Slack webhook if tenant has Slack integration configured — requires Integration module
    } catch {
      // Notification failure must never break the assignee operation
    }
  }

  async removeAssignee(tenantId: string, taskId: string, userId: string): Promise<void> {
    const schema = await this.getSchema(tenantId);
    await this.assertTaskExists(schema, taskId);
    await this.repo.removeAssignee(schema, taskId, userId);
  }

  // ── Checklists ────────────────────────────────────────────────────────────

  async createChecklist(
    tenantId: string,
    taskId: string,
    dto: CreateChecklistDto,
  ): Promise<TaskChecklistDto> {
    const schema = await this.getSchema(tenantId);
    await this.assertTaskExists(schema, taskId);
    return this.repo.createChecklist(schema, taskId, dto.title, dto.displayOrder ?? 0);
  }

  async deleteChecklist(tenantId: string, taskId: string, checklistId: string): Promise<void> {
    const schema = await this.getSchema(tenantId);
    await this.assertChecklistBelongsToTask(schema, checklistId, taskId);
    await this.repo.deleteChecklist(schema, checklistId);
  }

  // ── Checklist Items ───────────────────────────────────────────────────────

  async createChecklistItem(
    tenantId: string,
    taskId: string,
    checklistId: string,
    dto: CreateChecklistItemDto,
  ): Promise<TaskChecklistItemDto> {
    const schema = await this.getSchema(tenantId);
    await this.assertChecklistBelongsToTask(schema, checklistId, taskId);
    return this.repo.createChecklistItem(schema, checklistId, dto.title, dto.displayOrder ?? 0);
  }

  async updateChecklistItem(
    tenantId: string,
    taskId: string,
    checklistId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
    userId: string,
  ): Promise<TaskChecklistItemDto> {
    const schema = await this.getSchema(tenantId);
    await this.assertChecklistBelongsToTask(schema, checklistId, taskId);
    await this.assertItemBelongsToChecklist(schema, itemId, checklistId);
    return this.repo.updateChecklistItem(schema, itemId, dto, userId);
  }

  async deleteChecklistItem(
    tenantId: string,
    taskId: string,
    checklistId: string,
    itemId: string,
  ): Promise<void> {
    const schema = await this.getSchema(tenantId);
    await this.assertChecklistBelongsToTask(schema, checklistId, taskId);
    await this.assertItemBelongsToChecklist(schema, itemId, checklistId);
    await this.repo.deleteChecklistItem(schema, itemId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getSchema(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where:  { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }

  private async assertTaskExists(schema: string, taskId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schema);
    const t = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null }, select: { id: true } });
    if (!t) throw new TaskNotFoundException();
  }

  private async assertChecklistBelongsToTask(
    schema: string,
    checklistId: string,
    taskId: string,
  ): Promise<void> {
    const row = await this.repo.findChecklist(schema, checklistId, taskId);
    if (!row) throw new TaskChecklistNotFoundException();
  }

  private async assertItemBelongsToChecklist(
    schema: string,
    itemId: string,
    checklistId: string,
  ): Promise<void> {
    const row = await this.repo.findChecklistItem(schema, itemId, checklistId);
    if (!row) throw new TaskChecklistItemNotFoundException();
  }
}
