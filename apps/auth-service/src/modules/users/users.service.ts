import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@bos-prisma/core';
import { UserStatus } from '@bos/common';
import {
  UserAlreadyExistsException,
  UserNotFoundException,
} from '@bos/errors';
import { UsersRepository } from './users.repository';

/**
 * Business logic for the User identity record. No HTTP concerns —
 * controllers / auth services compose these calls.
 */
@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  async findByEmailOrThrow(email: string): Promise<User> {
    const user = await this.repo.findByEmail(email);
    if (!user) {
      throw new UserNotFoundException();
    }
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new UserNotFoundException();
    }
    return user;
  }

  /**
   * Creates a new identity row. Enforces email uniqueness BEFORE insert
   * so downstream flows can distinguish conflicts from races.
   */
  async create(input: Prisma.UserCreateInput): Promise<User> {
    if (await this.repo.emailExists(input.email)) {
      throw new UserAlreadyExistsException();
    }
    return this.repo.create(input);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repo.setPasswordHash(id, passwordHash);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repo.markEmailVerified(id);
  }

  async activate(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repo.updateStatus(id, UserStatus.ACTIVE, { lockedUntil: null });
  }

  async lock(id: string, until: Date): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repo.updateStatus(id, UserStatus.LOCKED, { lockedUntil: until });
  }

  async unlock(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repo.updateStatus(id, UserStatus.ACTIVE, { lockedUntil: null });
  }

  async suspend(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repo.updateStatus(id, UserStatus.SUSPENDED);
  }

  async softDelete(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repo.updateStatus(id, UserStatus.DELETED, { deletedAt: new Date() });
  }

  async set2FA(
    id: string,
    payload: { enabled: boolean; secret: string | null; backupCodes: string[] },
  ): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repo.set2FA(id, payload);
  }

  async recordLogin(id: string, ip: string | null): Promise<void> {
    await this.repo.recordLogin(id, ip);
  }
}
