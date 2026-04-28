import {
  IsString, IsEmail, IsOptional, IsUUID, IsEnum, IsNumber, Min, MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLeadDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) company?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() statusId?: string;
  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsOptional() @IsEnum(['LOW', 'MEDIUM', 'HIGH']) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) estimatedValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownedByUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
