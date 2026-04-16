import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@bos-prisma/core';
import type { UserStatus } from '@bos/common';

/**
 * Public-safe representation of a User. NEVER returns `passwordHash`,
 * `twoFactorSecret`, or `twoFactorBackupCodes`. Construct via
 * `UserResponseDto.fromEntity(user)` — never `new UserResponseDto(user)` —
 * so accidental property leakage is impossible.
 */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ type: Boolean })
  emailVerified!: boolean;

  @ApiProperty({ nullable: true, example: 'Jane' })
  firstName!: string | null;

  @ApiProperty({ nullable: true, example: 'Doe' })
  lastName!: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ enum: ['invited', 'pending_verification', 'active', 'locked', 'suspended', 'deleted'] })
  status!: UserStatus;

  @ApiProperty({ type: Boolean })
  twoFactorEnabled!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLoginAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.emailVerified = user.emailVerified;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.avatarUrl = user.avatarUrl;
    dto.status = user.status as UserStatus;
    dto.twoFactorEnabled = user.twoFactorEnabled;
    dto.lastLoginAt = user.lastLoginAt ? user.lastLoginAt.toISOString() : null;
    dto.createdAt = user.createdAt.toISOString();
    return dto;
  }
}
