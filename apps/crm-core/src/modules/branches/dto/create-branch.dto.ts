import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ example: 'Karachi Main Clinic' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    description: 'Short unique identifier for the branch (e.g. KHI-01). Auto-uppercased.',
    example: 'KHI-01',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'code may only contain letters, numbers, hyphens, underscores' })
  code!: string;

  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Karachi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Sindh' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'Pakistan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: '75500' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: '+92-21-1234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'karachi@clinic.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: 'Asia/Karachi', default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: 'Parent branch ID for hierarchical grouping' })
  @IsOptional()
  @IsUUID()
  parentBranchId?: string;

  @ApiPropertyOptional({ description: 'Mark this branch as the head office', default: false })
  @IsOptional()
  @IsBoolean()
  isHeadOffice?: boolean;
}
