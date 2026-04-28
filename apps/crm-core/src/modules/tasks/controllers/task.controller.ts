import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser, RequirePermission, TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { TaskService } from '../services/task.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskQueryDto, CreateChecklistDto, CreateChecklistItemDto, UpdateChecklistItemDto } from '../dto/task-query.dto';
import type { TaskDto, TaskListResponseDto, TaskChecklistDto, TaskChecklistItemDto } from '../dto/task.dto';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Inline DTO for adding an assignee
class AddAssigneeDto {
  @ApiProperty() @IsString() userId!: string;
}

// Inline DTO for creating a checklist (title in body)
class CreateChecklistBodyDto implements CreateChecklistDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  displayOrder?: number;
}

// Inline DTO for creating a checklist item (title in body)
class CreateChecklistItemBodyDto implements CreateChecklistItemDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  displayOrder?: number;
}

@ApiTags('Tasks')
@ApiBearerAuth('bearer')
@Controller('tasks')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class TaskController {
  constructor(private readonly service: TaskService) {}

  // ── Core CRUD ───────────────────────────────────────────────────────────

  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:tasks:create')
  @ApiOperation({
    summary: 'Create a task',
    description: 'Creates a task. Optionally link to a Lead/Contact via entityType+entityId, or nest under a parent task via parentTaskId.',
  })
  createTask(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskDto> {
    return this.service.createTask(user.tenantId, dto, user.userId);
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('tenant:tasks:view')
  @ApiOperation({
    summary: 'List tasks',
    description: 'Supports filtering by status, priority, type, assignee, entity link, due date range, overdue flag, and top-level vs subtask.',
  })
  listTasks(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Query() query: TaskQueryDto,
  ): Promise<TaskListResponseDto> {
    return this.service.listTasks(user.tenantId, query);
  }

  @Get(':taskId')
  @HttpCode(200)
  @RequirePermission('tenant:tasks:view')
  @ApiOperation({
    summary: 'Get a single task',
    description: 'Returns full task detail including assignees, checklists with items, and immediate subtasks.',
  })
  getTask(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<TaskDto> {
    return this.service.getTask(user.tenantId, taskId);
  }

  @Patch(':taskId')
  @HttpCode(200)
  @RequirePermission('tenant:tasks:update')
  @ApiOperation({
    summary: 'Update a task',
    description: 'Partial update — send only the fields to change. Setting status=DONE auto-stamps completedAt.',
  })
  updateTask(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.service.updateTask(user.tenantId, taskId, dto);
  }

  @Delete(':taskId')
  @HttpCode(204)
  @RequirePermission('tenant:tasks:delete')
  @ApiOperation({ summary: 'Soft-delete a task (and all its subtasks are orphaned)' })
  async deleteTask(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    await this.service.deleteTask(user.tenantId, taskId);
  }

  // ── Assignees ─────────────────────────────────────────────────────────────

  @Post(':taskId/assignees')
  @HttpCode(204)
  @RequirePermission('tenant:tasks:update')
  @ApiOperation({ summary: 'Add an assignee to a task' })
  @ApiParam({ name: 'taskId', type: String })
  async addAssignee(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AddAssigneeDto,
  ): Promise<void> {
    await this.service.addAssignee(user.tenantId, taskId, dto.userId, user.userId);
  }

  @Delete(':taskId/assignees/:userId')
  @HttpCode(204)
  @RequirePermission('tenant:tasks:update')
  @ApiOperation({ summary: 'Remove an assignee from a task' })
  async removeAssignee(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.service.removeAssignee(user.tenantId, taskId, userId);
  }

  // ── Checklists ─────────────────────────────────────────────────────────────

  @Post(':taskId/checklists')
  @HttpCode(201)
  @RequirePermission('tenant:tasks:manage_checklist')
  @ApiOperation({
    summary: 'Add a checklist to a task',
    description: 'A task can have multiple named checklists (e.g. "Pre-call checklist", "Follow-up steps").',
  })
  createChecklist(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateChecklistBodyDto,
  ): Promise<TaskChecklistDto> {
    return this.service.createChecklist(user.tenantId, taskId, dto);
  }

  @Delete(':taskId/checklists/:checklistId')
  @HttpCode(204)
  @RequirePermission('tenant:tasks:manage_checklist')
  @ApiOperation({ summary: 'Delete a checklist (and all its items)' })
  async deleteChecklist(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
  ): Promise<void> {
    await this.service.deleteChecklist(user.tenantId, taskId, checklistId);
  }

  // ── Checklist Items ─────────────────────────────────────────────────────────

  @Post(':taskId/checklists/:checklistId/items')
  @HttpCode(201)
  @RequirePermission('tenant:tasks:manage_checklist')
  @ApiOperation({ summary: 'Add an item to a checklist' })
  createChecklistItem(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
    @Body() dto: CreateChecklistItemBodyDto,
  ): Promise<TaskChecklistItemDto> {
    return this.service.createChecklistItem(user.tenantId, taskId, checklistId, dto);
  }

  @Patch(':taskId/checklists/:checklistId/items/:itemId')
  @HttpCode(200)
  @RequirePermission('tenant:tasks:manage_checklist')
  @ApiOperation({
    summary: 'Update a checklist item',
    description: 'Toggle isChecked (auto-stamps checkedAt + checkedByUserId), rename title, or reorder.',
  })
  updateChecklistItem(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ): Promise<TaskChecklistItemDto> {
    return this.service.updateChecklistItem(user.tenantId, taskId, checklistId, itemId, dto, user.userId);
  }

  @Delete(':taskId/checklists/:checklistId/items/:itemId')
  @HttpCode(204)
  @RequirePermission('tenant:tasks:manage_checklist')
  @ApiOperation({ summary: 'Remove a checklist item' })
  async deleteChecklistItem(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    await this.service.deleteChecklistItem(user.tenantId, taskId, checklistId, itemId);
  }
}
