import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VerticalType } from '@bos/common';

export class SignupDto {
  @ApiProperty({ example: 'owner@acmeclinic.com', description: 'Organization owner email' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'S3cureP@ssword!',
    description: 'Password — min 10 chars, 1 upper + 1 lower + 1 digit',
    minLength: 10,
    maxLength: 128,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Jane', description: 'First name' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'Last name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiProperty({ example: 'Acme Medical Clinic' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  orgName!: string;

  @ApiProperty({
    example: 'acme-clinic',
    description: 'URL-safe tenant slug — lowercase letters, digits, hyphens',
  })
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, {
    message: 'orgSlug must be lowercase alphanumeric with optional hyphens, 1-64 chars',
  })
  orgSlug!: string;

  @ApiProperty({ enum: VerticalType, example: VerticalType.MEDICAL })
  @IsNotEmpty()
  vertical!: VerticalType;

  @ApiProperty({ required: false, default: 'en-US' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  locale?: string;

  @ApiProperty({ required: false, default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
