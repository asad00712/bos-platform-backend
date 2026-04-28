import {
  IsString, IsEmail, IsOptional, IsUUID, IsEnum, MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateContactDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) company?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) jobTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceId?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] })
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE', 'ARCHIVED']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownedByUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
