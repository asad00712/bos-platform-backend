import {
  IsEnum, IsInt, IsISO8601, IsObject, IsOptional, IsString, IsUrl, IsUUID,
  MaxLength, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum LeadActivityType {
  NOTE = 'NOTE',
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  MEETING = 'MEETING',
  TASK = 'TASK',
}

export enum ActivityDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum CallOutcome {
  SPOKE = 'SPOKE',
  NO_ANSWER = 'NO_ANSWER',
  VOICEMAIL = 'VOICEMAIL',
  BUSY = 'BUSY',
  WRONG_NUMBER = 'WRONG_NUMBER',
  CALL_BACK_REQUESTED = 'CALL_BACK_REQUESTED',
}

export class CreateActivityDto {
  @ApiProperty({ enum: LeadActivityType })
  @IsEnum(LeadActivityType)
  type!: LeadActivityType;

  @ApiPropertyOptional({ enum: ActivityDirection })
  @IsOptional()
  @IsEnum(ActivityDirection)
  direction?: ActivityDirection;

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

  @ApiPropertyOptional({ description: 'Call duration in seconds' })
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

  @ApiPropertyOptional({ description: 'ISO8601 — when the meeting is/was scheduled' })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'ISO8601 — when the activity was actually completed' })
  @IsOptional()
  @IsISO8601()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'ISO8601 — task deadline (required when type=TASK)' })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
