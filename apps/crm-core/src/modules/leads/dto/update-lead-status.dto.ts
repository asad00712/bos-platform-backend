import { IsString, IsOptional, IsBoolean, IsInt, Min, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLeadStatusDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
