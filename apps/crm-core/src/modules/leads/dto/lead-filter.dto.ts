import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max, IsString, MaxLength, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LeadFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() statusId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceId?: string;
  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsOptional() @IsEnum(['LOW', 'MEDIUM', 'HIGH']) priority?: string;
  @ApiPropertyOptional({ description: 'Filter by converted status' })
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() converted?: boolean;
  @ApiPropertyOptional({ description: 'Search by name, email, or phone' })
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
