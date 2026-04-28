import {
  IsEnum, IsInt, IsISO8601, IsObject, IsOptional, IsString, IsUrl, IsUUID,
  MaxLength, Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CallOutcome } from './create-activity.dto';

export enum ActivityTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ enum: CallOutcome })
  @IsOptional()
  @IsEnum(CallOutcome)
  outcome?: CallOutcome;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  recordingUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  transcriptUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'ISO8601 — update task deadline' })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional({ enum: ActivityTaskStatus })
  @IsOptional()
  @IsEnum(ActivityTaskStatus)
  taskStatus?: ActivityTaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
