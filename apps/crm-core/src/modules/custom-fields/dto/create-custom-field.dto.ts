import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  Min,
  MaxLength,
  MinLength,
  Matches,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomFieldEntityType, CustomFieldType } from '@bos-prisma/tenant';

export class SelectOptionDto {
  @ApiProperty({ example: 'Active' })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ example: 'active' })
  @IsString()
  @MaxLength(100)
  value!: string;
}

export class CreateCustomFieldDto {
  @ApiProperty({ enum: CustomFieldEntityType })
  @IsEnum(CustomFieldEntityType)
  entityType!: CustomFieldEntityType;

  @ApiProperty({ example: 'Lead Source' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  label!: string;

  @ApiProperty({
    description: 'snake_case machine key, unique per entityType. Immutable after creation.',
    example: 'lead_source',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'key must start with a lowercase letter and contain only lowercase letters, digits, and underscores',
  })
  key!: string;

  @ApiProperty({ enum: CustomFieldType })
  @IsEnum(CustomFieldType)
  fieldType!: CustomFieldType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    type: [SelectOptionDto],
    description: 'Required when fieldType is SELECT or MULTI_SELECT',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectOptionDto)
  @ArrayMaxSize(100)
  options?: SelectOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
