import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadWebhookDto {
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceId?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) name!: string;
}

export class UpdateLeadWebhookDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class LeadWebhookResponseDto {
  id!: string;
  branchId!: string;
  sourceId!: string | null;
  name!: string;
  token!: string;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
