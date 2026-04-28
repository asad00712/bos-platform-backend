import {
  IsString, IsEmail, IsOptional, IsUUID, IsEnum, IsNumber, Min, MaxLength, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) firstName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) company?: string;
  @ApiPropertyOptional({ description: 'Source ID from /contact-sources' })
  @IsOptional() @IsUUID() sourceId?: string;
  @ApiPropertyOptional({ description: 'Status ID from /lead-statuses' })
  @IsOptional() @IsUUID() statusId?: string;
  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' })
  @IsOptional() @IsEnum(['LOW', 'MEDIUM', 'HIGH']) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) estimatedValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownedByUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
