import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ContactFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] })
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE', 'ARCHIVED']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceId?: string;
  @ApiPropertyOptional({ description: 'Search by name, email, or phone' })
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
