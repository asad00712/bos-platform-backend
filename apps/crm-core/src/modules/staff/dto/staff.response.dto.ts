import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ---------------------------------------------------------------------------
// Role assignment within the tenant
// ---------------------------------------------------------------------------

export class StaffRoleAssignmentDto {
  @ApiProperty()
  membershipId!: string;

  @ApiProperty()
  roleId!: string;

  @ApiProperty()
  roleSlug!: string;

  @ApiProperty()
  roleName!: string;

  @ApiPropertyOptional()
  branchId?: string | null;

  @ApiPropertyOptional()
  branchName?: string | null;

  @ApiProperty()
  assignedAt!: Date;
}

// ---------------------------------------------------------------------------
// Single staff member
// ---------------------------------------------------------------------------

export class StaffMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty({ enum: ['invited', 'active', 'suspended', 'left'] })
  membershipStatus!: string;

  @ApiPropertyOptional()
  joinedAt?: Date | null;

  @ApiProperty({ type: [StaffRoleAssignmentDto] })
  roles!: StaffRoleAssignmentDto[];
}

// ---------------------------------------------------------------------------
// Paginated staff list
// ---------------------------------------------------------------------------

export class StaffListResponseDto {
  @ApiProperty({ type: [StaffMemberDto] })
  data!: StaffMemberDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

// ---------------------------------------------------------------------------
// Pending invite
// ---------------------------------------------------------------------------

export class PendingInviteDto {
  @ApiProperty()
  inviteId!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiProperty()
  roleId!: string;

  @ApiPropertyOptional()
  branchId?: string | null;

  @ApiProperty()
  invitedByUserId!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}
