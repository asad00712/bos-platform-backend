import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@bos-prisma/core';
import { CorePrismaService } from '@bos/database';
import type { UserStatus } from '@bos/common';

/**
 * Prisma wrapper for `public.users`. The only place in the codebase that
 * constructs raw User queries. Services consume this via DI and never touch
 * CorePrismaService.user directly.
 *
 * Every method uses an explicit `select` to keep sensitive columns
 * (`passwordHash`, `twoFactorSecret`, `twoFactorBackupCodes`) scoped to
 * the few flows that legitimately need them.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: CorePrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async emailExists(email: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true },
    });
    return row !== null;
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: normalizeEmail(data.email) },
    });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerified: true },
    });
  }

  async updateStatus(
    id: string,
    status: UserStatus,
    extras: { lockedUntil?: Date | null; deletedAt?: Date | null } = {},
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { status, ...extras },
    });
  }

  async set2FA(
    id: string,
    payload: {
      enabled: boolean;
      secret: string | null;
      backupCodes: string[];
    },
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        twoFactorEnabled: payload.enabled,
        twoFactorSecret: payload.secret,
        twoFactorBackupCodes: payload.backupCodes,
      },
    });
  }

  async recordLogin(id: string, ip: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
