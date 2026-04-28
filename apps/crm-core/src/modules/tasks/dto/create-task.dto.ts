import {
  IsArray, IsEnum, IsInt, IsISO8601, IsObject, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TaskType, TaskStatus, TaskPriority, TaskEntityType } from './task.enums';

export class CreateTaskDto {
  @ApiProperty({ minLength: 1, maxLength: 300 })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ description: 'Markdown supported' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskType, default: TaskType.TODO })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.NORMAL })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'ISO8601 — when work on this task begins' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'ISO8601 with time — precise deadline' })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional({ description: 'Story points / effort estimate (ClickUp-style)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  points?: number;

  @ApiPropertyOptional({ description: 'Expected duration in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timeEstimate?: number;

  @ApiPropertyOptional({
    description: 'iCal RRULE string — e.g. "FREQ=WEEKLY;BYDAY=MO;COUNT=10"',
    example: 'FREQ=DAILY;COUNT=5',
  })
  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @ApiPropertyOptional({
    description: 'Array of ISO8601 datetime strings for scheduled reminders',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsISO8601({}, { each: true })
  reminders?: string[];

  @ApiPropertyOptional({ enum: TaskEntityType, description: 'CRM entity type this task belongs to' })
  @IsOptional()
  @IsEnum(TaskEntityType)
  entityType?: TaskEntityType;

  @ApiPropertyOptional({ description: 'UUID of the linked Lead or Contact' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Parent task UUID — makes this a subtask' })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiPropertyOptional({ description: 'Initial assignee user IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
