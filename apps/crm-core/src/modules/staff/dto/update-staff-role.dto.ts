import { IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStaffRoleDto {
  @ApiProperty({
    description: 'New role ID to assign (refers to tenant schema roles.id)',
    example: '018f1e2a-0000-7000-8000-000000000003',
  })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({
    description: 'Branch to assign the role to; omit or null for tenant-wide role',
    example: '018f1e2a-0000-7000-8000-000000000004',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
