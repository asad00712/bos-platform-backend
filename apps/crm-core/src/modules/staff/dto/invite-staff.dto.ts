import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteStaffDto {
  @ApiProperty({ example: 'ali@clinic.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Ali' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Khan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({
    description: 'Role to assign on accept (refers to tenant schema roles.id)',
    example: '018f1e2a-0000-7000-8000-000000000001',
  })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({
    description: 'Branch to assign (null = tenant-wide role)',
    example: '018f1e2a-0000-7000-8000-000000000002',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Custom welcome message included in the invite email',
    example: 'Welcome to our team!',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  personalMessage?: string;
}
