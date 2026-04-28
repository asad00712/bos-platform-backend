// jose is ESM-only; prevent its import graph from breaking ts-jest's CJS transform.
jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  importPKCS8: jest.fn(),
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
  createLocalJWKSet: jest.fn(),
}));

import { createHash } from 'node:crypto';
import type { User } from '@bos-prisma/core';
import type { PasswordHasherService } from '@bos/security';
import {
  InvalidInviteException,
  InviteExpiredException,
  InviteAlreadyUsedException,
  PasswordTooWeakException,
} from '@bos/errors';
import { UserStatus } from '@bos/common';
import { InviteAcceptService } from '../services/invite-accept.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date('2026-04-17T10:00:00Z');

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-invited',
    email: 'staff@clinic.com',
    emailVerified: true,
    passwordHash: '$argon2id$hash',
    firstName: 'Alice',
    lastName: 'Smith',
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

const RAW_TOKEN = 'a'.repeat(64);
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

function makeInvite(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'invite-1',
    tokenHash: TOKEN_HASH,
    userId: 'user-invited',
    tenantId: 'tenant-1',
    invitedByUserId: 'admin-1',
    roleId: 'role-manager',
    branchId: 'branch-1',
    email: 'staff@clinic.com',
    expiresAt: new Date(FIXED_NOW.getTime() + 48 * 3600 * 1000),
    acceptedAt: null,
    revokedAt: null,
    createdAt: FIXED_NOW,
    tenant: { id: 'tenant-1', schemaName: 'tenant_aabbccdd11223344' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUbm = { create: jest.fn() };
const mockTenantClient = { userBranchMembership: mockUbm };
const mockTenantPrisma = { forSchema: jest.fn().mockReturnValue(mockTenantClient) };

const mockCorePrisma = {
  userInvite: { findUnique: jest.fn(), update: jest.fn() },
  user: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
  tenantMembership: { update: jest.fn() },
  $transaction: jest.fn(),
};

const mockHasher: Partial<PasswordHasherService> = {
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
};

const mockSessions = {
  create: jest.fn().mockResolvedValue({ id: 'session-1' }),
};

const mockRefreshTokens = { create: jest.fn() };

const mockTokenIssuer = {
  issueAccessToken: jest.fn().mockResolvedValue({
    token: 'access.jwt',
    jti: 'jti-1',
    expiresAt: new Date(FIXED_NOW.getTime() + 900_000),
  }),
  generateRefreshToken: jest.fn().mockReturnValue({
    raw: 'raw-refresh',
    hash: 'hash-refresh',
    id: 'rt-1',
    expiresAt: new Date(FIXED_NOW.getTime() + 2_592_000_000),
  }),
  accessTtl: 900,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('InviteAcceptService', () => {
  let service: InviteAcceptService;

  beforeEach(() => {
    jest.resetAllMocks();

    // Default: $transaction executes the callback with corePrisma as the tx client
    mockCorePrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockCorePrisma) => Promise<void>) => cb(mockCorePrisma),
    );
    mockTenantPrisma.forSchema.mockReturnValue(mockTenantClient);
    mockSessions.create.mockResolvedValue({ id: 'session-1' });
    mockTokenIssuer.issueAccessToken.mockResolvedValue({
      token: 'access.jwt',
      jti: 'jti-1',
      expiresAt: new Date(FIXED_NOW.getTime() + 900_000),
    });
    mockTokenIssuer.generateRefreshToken.mockReturnValue({
      raw: 'raw-refresh',
      hash: 'hash-refresh',
      id: 'rt-1',
      expiresAt: new Date(FIXED_NOW.getTime() + 2_592_000_000),
    });
    (mockHasher.hash as jest.Mock).mockResolvedValue('$argon2id$hashed');

    service = new InviteAcceptService(
      mockCorePrisma as unknown as ConstructorParameters<typeof InviteAcceptService>[0],
      mockTenantPrisma as unknown as ConstructorParameters<typeof InviteAcceptService>[1],
      mockHasher as PasswordHasherService,
      mockSessions as unknown as ConstructorParameters<typeof InviteAcceptService>[3],
      mockRefreshTokens as unknown as ConstructorParameters<typeof InviteAcceptService>[4],
      mockTokenIssuer as unknown as ConstructorParameters<typeof InviteAcceptService>[5],
    );
  });

  const ctx = () => ({
    rawToken: RAW_TOKEN,
    password: 'ValidPass1',
    ipAddress: '1.2.3.4',
    userAgent: 'Jest/1.0',
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    beforeEach(() => {
      mockCorePrisma.userInvite.findUnique.mockResolvedValue(makeInvite());
      mockCorePrisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());
      mockUbm.create.mockResolvedValue({});
    });

    it('returns access token and refresh token on success', async () => {
      const result = await service.execute(ctx());

      expect(result.requires2FA).toBe(false);
      expect(result.accessToken).toBe('access.jwt');
      expect(result.refreshTokenRaw).toBe('raw-refresh');
      expect(result.accessTokenExpiresIn).toBe(900);
    });

    it('activates user inside transaction', async () => {
      await service.execute(ctx());

      expect(mockCorePrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-invited' },
          data: expect.objectContaining({
            emailVerified: true,
            status: UserStatus.ACTIVE,
          }),
        }),
      );
    });

    it('activates TenantMembership and sets joinedAt inside transaction', async () => {
      await service.execute(ctx());

      expect(mockCorePrisma.tenantMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_tenantId: { userId: 'user-invited', tenantId: 'tenant-1' } },
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
    });

    it('stamps acceptedAt on the invite inside transaction', async () => {
      await service.execute(ctx());

      expect(mockCorePrisma.userInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: TOKEN_HASH } }),
      );
    });

    it('creates UserBranchMembership in the correct tenant schema', async () => {
      await service.execute(ctx());

      expect(mockTenantPrisma.forSchema).toHaveBeenCalledWith('tenant_aabbccdd11223344');
      expect(mockUbm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-invited',
            roleId: 'role-manager',
            branchId: 'branch-1',
            assignedByUserId: 'admin-1',
            roundRobinAvailable: true,
          }),
        }),
      );
    });

    it('creates UserBranchMembership with null branchId for tenant-wide roles', async () => {
      mockCorePrisma.userInvite.findUnique.mockResolvedValue(makeInvite({ branchId: null }));

      await service.execute(ctx());

      expect(mockUbm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ branchId: null }),
        }),
      );
    });

    it('creates a session scoped to the correct tenant', async () => {
      await service.execute(ctx());

      expect(mockSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: { connect: { id: 'tenant-1' } },
        }),
      );
    });

    it('hashes the password before storing', async () => {
      await service.execute(ctx());

      expect(mockHasher.hash).toHaveBeenCalledWith('ValidPass1');
      expect(mockCorePrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: '$argon2id$hashed' }),
        }),
      );
    });

    it('persists a refresh token record', async () => {
      await service.execute(ctx());

      expect(mockRefreshTokens.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-invited',
          sessionId: 'session-1',
        }),
      );
    });
  });

  // ── Token validation ────────────────────────────────────────────────────────

  it('throws InvalidInviteException when token is not found', async () => {
    mockCorePrisma.userInvite.findUnique.mockResolvedValue(null);

    await expect(service.execute(ctx())).rejects.toBeInstanceOf(InvalidInviteException);
    expect(mockCorePrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws InvalidInviteException when invite is revoked', async () => {
    mockCorePrisma.userInvite.findUnique.mockResolvedValue(
      makeInvite({ revokedAt: new Date() }),
    );

    await expect(service.execute(ctx())).rejects.toBeInstanceOf(InvalidInviteException);
  });

  it('throws InviteAlreadyUsedException when invite is already accepted', async () => {
    mockCorePrisma.userInvite.findUnique.mockResolvedValue(
      makeInvite({ acceptedAt: new Date() }),
    );

    await expect(service.execute(ctx())).rejects.toBeInstanceOf(InviteAlreadyUsedException);
  });

  it('throws InviteExpiredException when invite is past expiry', async () => {
    mockCorePrisma.userInvite.findUnique.mockResolvedValue(
      makeInvite({ expiresAt: new Date(FIXED_NOW.getTime() - 1) }),
    );

    await expect(service.execute(ctx())).rejects.toBeInstanceOf(InviteExpiredException);
  });

  // ── Password policy ─────────────────────────────────────────────────────────

  it('throws PasswordTooWeakException when password is too short', async () => {
    mockCorePrisma.userInvite.findUnique.mockResolvedValue(makeInvite());

    await expect(
      service.execute({ ...ctx(), password: 'short' }),
    ).rejects.toBeInstanceOf(PasswordTooWeakException);
    expect(mockCorePrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws PasswordTooWeakException when password has no uppercase', async () => {
    mockCorePrisma.userInvite.findUnique.mockResolvedValue(makeInvite());

    await expect(
      service.execute({ ...ctx(), password: 'alllowercase1' }),
    ).rejects.toBeInstanceOf(PasswordTooWeakException);
  });

  it('throws PasswordTooWeakException when password has no digit', async () => {
    mockCorePrisma.userInvite.findUnique.mockResolvedValue(makeInvite());

    await expect(
      service.execute({ ...ctx(), password: 'NoDigitHere!!' }),
    ).rejects.toBeInstanceOf(PasswordTooWeakException);
  });

  // ── UBM failure propagates ──────────────────────────────────────────────────

  it('re-throws when UserBranchMembership creation fails', async () => {
    mockCorePrisma.userInvite.findUnique.mockResolvedValue(makeInvite());
    mockUbm.create.mockRejectedValue(new Error('schema unavailable'));

    await expect(service.execute(ctx())).rejects.toThrow('schema unavailable');
    // Transaction already committed — session must NOT be issued
    expect(mockSessions.create).not.toHaveBeenCalled();
  });
});
