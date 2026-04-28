import { IsBoolean, IsEnum, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { TaskType, TaskStatus, TaskPriority, TaskEntityType } from './task.enums';

export class TaskQueryDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: TaskType })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional({ description: 'Filter by assignee user ID' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ enum: TaskEntityType })
  @IsOptional()
  @IsEnum(TaskEntityType)
  entityType?: TaskEntityType;

  @ApiPropertyOptional({ description: 'Filter by linked entity ID (Lead/Contact UUID)' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Only subtasks of this parent task UUID' })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiPropertyOptional({
    description: 'true = top-level tasks only | false = subtasks only | omit = all',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  topLevel?: boolean;

  @ApiPropertyOptional({ description: 'ISO8601 — tasks due on or after this date' })
  @IsOptional()
  @IsISO8601()
  dueFrom?: string;

  @ApiPropertyOptional({ description: 'ISO8601 — tasks due on or before this date' })
  @IsOptional()
  @IsISO8601()
  dueTo?: string;

  @ApiPropertyOptional({ description: 'true = only overdue tasks (dueAt < now, not DONE/CANCELLED)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreateChecklistDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  constructor(public title: string) {}
}

export class CreateChecklistItemDto {
  constructor(public title: string) {}

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateChecklistItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isChecked?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
