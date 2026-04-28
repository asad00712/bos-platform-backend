import { IsString, IsUUID, IsOptional, MaxLength, MinLength, Matches, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadStatusDto {
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty({ example: 'Qualified' }) @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiPropertyOptional({ example: '#27AE60' })
  @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color like #27AE60' }) color?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
