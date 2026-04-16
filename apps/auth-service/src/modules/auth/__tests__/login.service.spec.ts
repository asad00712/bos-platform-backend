// jose is ESM-only; short-circuit it in tests so the import graph in
// token-issuer.service.ts doesn't break ts-jest's CJS transform. We only
// test LoginService behaviour — real JWT signing is not exercised here.
jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  importPKCS8: jest.fn(),
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
  createLocalJWKSet: jest.fn(),
}));

import type { ConfigService } from '@nestjs/config';
import type { User } from '@bos-prisma/core';
import type { PasswordHasherService } from '@bos/security';
import {
  AccountLockedException,
  EmailNotVerifiedException,
  InvalidCredentialsException,
  UserSuspendedException,
} from '@bos/errors';
import { UserStatus } from '@bos/common';
import { LoginService } from '../services/login.service';

const FIXED_NOW = new Date('2026-04-15T12:00:00Z');

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    emailVerified: true,
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$salt$hash',
    firstName: 'Jane',
    lastName: null,
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

describe('LoginService', () => {
  let service: LoginService;

  const users = {
    findByEmail: jest.fn(),
    lock: jest.fn(),
    recordLogin: jest.fn(),
  };
  const hasher: Partial<PasswordHasherService> = {
    verify: jest.fn(),
  };
  const sessions = {
    create: jest.fn().mockResolvedValue({ id: 'session-1' }),
  };
  const refreshTokens = {
    create: jest.fn(),
  };
  const redisClient = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  };
  const tokenIssuer = {
    issueAccessToken: jest
      .fn()
      .mockResolvedValue({ token: 'access.jwt', jti: 'jti-1', expiresAt: new Date(FIXED_NOW.getTime() + 900_000) }),
    issueTwoFactorPendingToken: jest
      .fn()
      .mockResolvedValue({ token: 'temp.jwt', jti: 'jti-temp', expiresAt: new Date(FIXED_NOW.getTime() + 300_000) }),
    generateRefreshToken: jest.fn().mockReturnValue({
      raw: 'raw-refresh',
      hash: 'hash-refresh',
      id: 'rt-1',
      expiresAt: new Date(FIXED_NOW.getTime() + 2_592_000_000),
    }),
    accessTtl: 900,
    refreshTtl: 2_592_000,
  };
  const config: Partial<ConfigService> = {
    get: jest.fn((key: string, fallback?: number) => {
      if (key === 'AUTH_LOCKOUT_MAX_ATTEMPTS') {
        return 10;
      }
      if (key === 'AUTH_LOCKOUT_DURATION') {
        return 1800;
      }
      return fallback;
    }) as unknown as ConfigService['get'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redisClient.get.mockResolvedValue(null);
    redisClient.incr.mockResolvedValue(1);

    service = new LoginService(
      users as unknown as ConstructorParameters<typeof LoginService>[0],
      hasher as PasswordHasherService,
      sessions as unknown as ConstructorParameters<typeof LoginService>[2],
      refreshTokens as unknown as ConstructorParameters<typeof LoginService>[3],
      tokenIssuer as unknown as ConstructorParameters<typeof LoginService>[4],
      { client: redisClient } as unknown as ConstructorParameters<typeof LoginService>[5],
      config as ConfigService,
    );
  });

  const ctx = (): {
    email: string;
    password: string;
    ipAddress: string;
    userAgent: string;
  } => ({
    email: 'jane@example.com',
    password: 'Correct-pass',
    ipAddress: '1.2.3.4',
    userAgent: 'Jest',
  });

  it('returns tokens on valid credentials (no 2FA)', async () => {
    users.findByEmail.mockResolvedValue(buildUser());
    (hasher.verify as jest.Mock).mockResolvedValue(true);

    const result = await service.execute(ctx());

    expect(result.requires2FA).toBe(false);
    if (!result.requires2FA) {
      expect(result.accessToken).toBe('access.jwt');
      expect(result.refreshTokenRaw).toBe('raw-refresh');
    }
    expect(sessions.create).toHaveBeenCalled();
    expect(refreshTokens.create).toHaveBeenCalled();
    expect(users.recordLogin).toHaveBeenCalledWith('user-1', '1.2.3.4');
    expect(redisClient.del).toHaveBeenCalled();
  });

  it('returns 2FA challenge when twoFactorEnabled=true', async () => {
    users.findByEmail.mockResolvedValue(buildUser({ twoFactorEnabled: true }));
    (hasher.verify as jest.Mock).mockResolvedValue(true);

    const result = await service.execute(ctx());

    expect(result.requires2FA).toBe(true);
    if (result.requires2FA) {
      expect(result.tempToken).toBe('temp.jwt');
    }
    expect(refreshTokens.create).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentialsException when user does not exist', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(service.execute(ctx())).rejects.toBeInstanceOf(InvalidCredentialsException);
    // Constant-time: still runs verify even when no user to avoid timing leak
    expect(hasher.verify).toHaveBeenCalled();
  });

  it('throws InvalidCredentialsException + increments lockout counter on wrong password', async () => {
    users.findByEmail.mockResolvedValue(buildUser());
    (hasher.verify as jest.Mock).mockResolvedValue(false);

    await expect(service.execute(ctx())).rejects.toBeInstanceOf(InvalidCredentialsException);
    expect(redisClient.incr).toHaveBeenCalled();
  });

  it('locks the account after too many failures', async () => {
    users.findByEmail.mockResolvedValue(buildUser());
    (hasher.verify as jest.Mock).mockResolvedValue(false);
    redisClient.incr.mockResolvedValue(10);

    await expect(service.execute(ctx())).rejects.toBeInstanceOf(InvalidCredentialsException);
    expect(users.lock).toHaveBeenCalled();
  });

  it('throws AccountLockedException when counter already at limit', async () => {
    users.findByEmail.mockResolvedValue(buildUser());
    redisClient.get.mockResolvedValue('10');

    await expect(service.execute(ctx())).rejects.toBeInstanceOf(AccountLockedException);
  });

  it('throws EmailNotVerifiedException when user is pending_verification', async () => {
    users.findByEmail.mockResolvedValue(buildUser({ status: UserStatus.PENDING_VERIFICATION }));
    await expect(service.execute(ctx())).rejects.toBeInstanceOf(EmailNotVerifiedException);
  });

  it('throws UserSuspendedException on suspended user', async () => {
    users.findByEmail.mockResolvedValue(buildUser({ status: UserStatus.SUSPENDED }));
    await expect(service.execute(ctx())).rejects.toBeInstanceOf(UserSuspendedException);
  });

  it('throws AccountLockedException when user status=locked', async () => {
    users.findByEmail.mockResolvedValue(buildUser({ status: UserStatus.LOCKED, lockedUntil: new Date() }));
    await expect(service.execute(ctx())).rejects.toBeInstanceOf(AccountLockedException);
  });
});
