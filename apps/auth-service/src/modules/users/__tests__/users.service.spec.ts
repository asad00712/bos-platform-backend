import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@bos-prisma/core';
import { UserStatus } from '@bos/common';
import {
  UserAlreadyExistsException,
  UserNotFoundException,
} from '@bos/errors';
import { UsersRepository } from '../users.repository';
import { UsersService } from '../users.service';

const FIXED_NOW = new Date('2026-04-15T09:00:00Z');

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'jane@example.com',
    emailVerified: true,
    passwordHash: 'hash',
    fullName: 'Jane',
    avatarUrl: null,
    phone: null,
    locale: null,
    timezone: null,
    status: UserStatus.ACTIVE,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    deletedAt: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const repoMock: jest.Mocked<UsersRepository> = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      emailExists: jest.fn(),
      create: jest.fn(),
      setPasswordHash: jest.fn(),
      markEmailVerified: jest.fn(),
      updateStatus: jest.fn(),
      set2FA: jest.fn(),
      recordLogin: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repoMock },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    repo = moduleRef.get(UsersRepository);
  });

  describe('findByEmailOrThrow', () => {
    it('returns user when present', async () => {
      const user = buildUser();
      repo.findByEmail.mockResolvedValue(user);

      await expect(service.findByEmailOrThrow('jane@example.com')).resolves.toBe(user);
    });

    it('throws UserNotFoundException when missing', async () => {
      repo.findByEmail.mockResolvedValue(null);

      await expect(service.findByEmailOrThrow('missing@example.com')).rejects.toBeInstanceOf(
        UserNotFoundException,
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('returns user when present', async () => {
      const user = buildUser();
      repo.findById.mockResolvedValue(user);

      await expect(service.findByIdOrThrow('user-123')).resolves.toBe(user);
    });

    it('throws when missing', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findByIdOrThrow('missing')).rejects.toBeInstanceOf(
        UserNotFoundException,
      );
    });
  });

  describe('create', () => {
    it('rejects duplicate email with UserAlreadyExistsException', async () => {
      repo.emailExists.mockResolvedValue(true);

      await expect(
        service.create({ email: 'jane@example.com' } as Parameters<UsersService['create']>[0]),
      ).rejects.toBeInstanceOf(UserAlreadyExistsException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('inserts when email is free', async () => {
      repo.emailExists.mockResolvedValue(false);
      const created = buildUser();
      repo.create.mockResolvedValue(created);

      const result = await service.create({ email: 'jane@example.com' } as Parameters<
        UsersService['create']
      >[0]);

      expect(result).toBe(created);
      expect(repo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('status transitions', () => {
    beforeEach(() => {
      repo.findById.mockResolvedValue(buildUser());
    });

    it('activate clears lockedUntil', async () => {
      await service.activate('user-123');
      expect(repo.updateStatus).toHaveBeenCalledWith('user-123', UserStatus.ACTIVE, {
        lockedUntil: null,
      });
    });

    it('lock sets LOCKED with unlock date', async () => {
      const until = new Date('2026-04-16T00:00:00Z');
      await service.lock('user-123', until);
      expect(repo.updateStatus).toHaveBeenCalledWith('user-123', UserStatus.LOCKED, {
        lockedUntil: until,
      });
    });

    it('softDelete sets deletedAt + status', async () => {
      await service.softDelete('user-123');
      expect(repo.updateStatus).toHaveBeenCalledWith(
        'user-123',
        UserStatus.DELETED,
        expect.objectContaining({ deletedAt: expect.any(Date) as unknown as Date }),
      );
    });

    it('throws if user not found when changing status', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.activate('missing')).rejects.toBeInstanceOf(UserNotFoundException);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('set2FA', () => {
    it('delegates to repo after confirming user exists', async () => {
      repo.findById.mockResolvedValue(buildUser());
      await service.set2FA('user-123', { enabled: true, secret: 'abc', backupCodes: ['h1'] });
      expect(repo.set2FA).toHaveBeenCalledWith('user-123', {
        enabled: true,
        secret: 'abc',
        backupCodes: ['h1'],
      });
    });
  });

  describe('recordLogin', () => {
    it('records lastLogin timestamps via repo', async () => {
      await service.recordLogin('user-123', '1.2.3.4');
      expect(repo.recordLogin).toHaveBeenCalledWith('user-123', '1.2.3.4');
    });
  });
});
