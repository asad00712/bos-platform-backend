import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LeadActivityType } from './create-activity.dto';
import { ActivityTaskStatus } from './update-activity.dto';

export class ActivityQueryDto {
  @ApiPropertyOptional({ enum: LeadActivityType, description: 'Filter by activity type' })
  @IsOptional()
  @IsEnum(LeadActivityType)
  type?: LeadActivityType;

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

export class MyTasksQueryDto {
  @ApiPropertyOptional({ enum: ActivityTaskStatus, description: 'Filter tasks by status (default: PENDING + IN_PROGRESS)' })
  @IsOptional()
  @IsEnum(ActivityTaskStatus)
  status?: ActivityTaskStatus;

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
