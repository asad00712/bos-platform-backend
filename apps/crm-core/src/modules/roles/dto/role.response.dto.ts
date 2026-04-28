import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'tenant:contacts:create' })
  slug!: string;

  @ApiProperty({ example: 'tenant' })
  scope!: string;

  @ApiProperty({ example: 'contacts' })
  resource!: string;

  @ApiProperty({ example: 'create' })
  action!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  isSystem!: boolean;
}

export class RoleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'doctor' })
  slug!: string;

  @ApiProperty({ example: 'Doctor' })
  name!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: ['tenant', 'branch'] })
  scopeType!: string;

  @ApiProperty({ description: 'System roles cannot be deleted or have their scopeType changed' })
  isSystem!: boolean;

  @ApiPropertyOptional({ description: 'Vertical this role belongs to (null = generic)' })
  verticalSlug?: string | null;

  @ApiProperty({ type: [PermissionDto] })
  permissions!: PermissionDto[];

  @ApiProperty()
  createdAt!: Date;
}

export class RoleListResponseDto {
  @ApiProperty({ type: [RoleDto] })
  data!: RoleDto[];

  @ApiProperty()
  total!: number;
}
