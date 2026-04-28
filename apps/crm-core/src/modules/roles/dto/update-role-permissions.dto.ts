import { IsArray, IsUUID, ArrayUnique } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Replaces the full permission set for a role.
 * Send an empty array to clear all permissions (system roles will ignore this).
 */
export class UpdateRolePermissionsDto {
  @ApiProperty({
    description: 'Full list of permission IDs to assign (replaces current set)',
    type: [String],
    example: ['perm-uuid-001', 'perm-uuid-002'],
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  permissionIds!: string[];
}
