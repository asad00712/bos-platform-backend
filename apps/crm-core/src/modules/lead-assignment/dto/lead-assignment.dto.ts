import { IsArray, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LeadAssignmentModeDto {
  ROUND_ROBIN = 'ROUND_ROBIN',
  MANUAL = 'MANUAL',
}

export class UpsertLeadAssignmentConfigDto {
  @ApiProperty() @IsUUID() branchId!: string;

  @ApiPropertyOptional({ enum: LeadAssignmentModeDto, default: 'ROUND_ROBIN' })
  @IsOptional() @IsEnum(LeadAssignmentModeDto)
  assignmentMode?: LeadAssignmentModeDto;

  @ApiPropertyOptional({ description: 'Role UUIDs eligible for round-robin assignment', type: [String] })
  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  eligibleRoleIds?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class LeadAssignmentConfigResponseDto {
  id!: string;
  branchId!: string;
  assignmentMode!: string;
  eligibleRoleIds!: string[];
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
