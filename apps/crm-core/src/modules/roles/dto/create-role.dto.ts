import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
  ArrayUnique,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RoleScopeTypeDto {
  TENANT = 'tenant',
  BRANCH = 'branch',
}

export class CreateRoleDto {
  @ApiProperty({ example: 'senior-doctor' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9_-]+$/, { message: 'slug may only contain lowercase letters, numbers, hyphens, underscores' })
  slug!: string;

  @ApiProperty({ example: 'Senior Doctor' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Senior clinician with full department access' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    enum: RoleScopeTypeDto,
    description:
      '"tenant" = company-wide role (no branch restriction). "branch" = must be assigned to a specific branch.',
    example: 'branch',
  })
  @IsEnum(RoleScopeTypeDto)
  scopeType!: RoleScopeTypeDto;

  @ApiPropertyOptional({
    description: 'Permission IDs to assign to this role',
    type: [String],
    example: ['perm-uuid-001', 'perm-uuid-002'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  permissionIds?: string[];
}
