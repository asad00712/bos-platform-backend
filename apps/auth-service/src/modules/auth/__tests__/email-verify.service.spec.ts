import type { ConfigService } from '@nestjs/config';
import {
  InvalidTokenException,
  TokenExpiredException,
  UserAlreadyVerifiedException,
} from '@bos/errors';
import { UserStatus, TenantMembershipStatus, TenantStatus } from '@bos/common';
import { EmailVerifyService } from '../services/email-verify.service';

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST   = new Date(Date.now() - 1);

function buildRecord(overrides: Record<string, unknown> = {}) {
  return {
    tokenHash: 'some-hash',
    userId: 'user-1',
    email: 'jane@clinic.com',
    verifiedAt: null,
    expiresAt: FUTURE,
    ...overrides,
  };
}

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'jane@clinic.com',
    emailVerified: false,
    status: UserStatus.PENDING_VERIFICATION,
    ...overrides,
  };
}

function buildMembership(tenantOverrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-1',
    tenant: {
      id: 'tenant-1',
      schemaName: 'tenant_abcdef1234567890',
      vertical: 'medical',
      ...tenantOverrides,
    },
  };
}

describe('EmailVerifyService', () => {
  const txRunner = jest.fn();
  const prisma = {
    emailVerification: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    tenantMembership: { findFirst: jest.fn(), update: jest.fn() },
    tenant: { update: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => txRunner(fn) as Promise<unknown>),
  };
  const tenantSchemaManager = {
    provisionSchema: jest.fn(),
  };
  const config: Partial<ConfigService> = {
    get: jest.fn().mockReturnValue(86_400),
  };
  const mailQueue = { add: jest.fn().mockResolvedValue(undefined) };

  let service: EmailVerifyService;

  beforeEach(() => {
    service = new EmailVerifyService(
      prisma as unknown as ConstructorParameters<typeof EmailVerifyService>[0],
      tenantSchemaManager as unknown as ConstructorParameters<typeof EmailVerifyService>[1],
      config as ConfigService,
      mailQueue as unknown as ConstructorParameters<typeof EmailVerifyService>[3],
    );

    // Happy-path defaults
    prisma.emailVerification.findUnique.mockResolvedValue(buildRecord());
    prisma.user.findUnique.mockResolvedValue(buildUser());
    prisma.tenantMembership.findFirst.mockResolvedValue(buildMembership());
    prisma.tenant.update.mockResolvedValue({});
    tenantSchemaManager.provisionSchema.mockResolvedValue(undefined);

    txRunner.mockImplementation((fn: (tx: unknown) => unknown) => {
      const tx = {
        emailVerification: { update: jest.fn() },
        user: { update: jest.fn() },
        tenantMembership: { update: jest.fn() },
      };
      return fn(tx);
    });
  });

  // ─── execute ─────────────────────────────────────────────────────────────────

  describe('execute', () => {
    it('activates user, membership, provisions schema, and returns ids', async () => {
      const result = await service.execute('raw-token-64chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tenantSchemaManager.provisionSchema).toHaveBeenCalledWith(
        expect.objectContaining({ schemaName: 'tenant_abcdef1234567890', vertical: 'medical' }),
      );
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: TenantStatus.ACTIVE } }),
      );
      expect(result.userId).toBe('user-1');
      expect(result.tenantId).toBe('tenant-1');
    });

    it('activates membership inside the transaction', async () => {
      let capturedTx: Record<string, { update: jest.Mock }> | null = null;
      txRunner.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          emailVerification: { update: jest.fn() },
          user: { update: jest.fn() },
          tenantMembership: { update: jest.fn() },
        };
        capturedTx = tx as typeof tx;
        return fn(tx);
      });

      await service.execute('raw-token-64chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

      expect(capturedTx!.tenantMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: TenantMembershipStatus.ACTIVE } }),
      );
    });

    it('marks tenant SUSPENDED and rethrows when schema provisioning fails', async () => {
      const provisionError = new Error('pg connection refused');
      tenantSchemaManager.provisionSchema.mockRejectedValue(provisionError);

      await expect(
        service.execute('raw-token-64chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      ).rejects.toThrow('pg connection refused');

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: TenantStatus.SUSPENDED } }),
      );
    });

    it('throws InvalidTokenException when token not found', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue(null);
      await expect(service.execute('bad-token')).rejects.toBeInstanceOf(InvalidTokenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws InvalidTokenException when token already used (verifiedAt set)', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue(buildRecord({ verifiedAt: new Date() }));
      await expect(service.execute('raw-token')).rejects.toBeInstanceOf(InvalidTokenException);
    });

    it('throws TokenExpiredException when token is expired', async () => {
      prisma.emailVerification.findUnique.mockResolvedValue(buildRecord({ expiresAt: PAST }));
      await expect(service.execute('raw-token')).rejects.toBeInstanceOf(TokenExpiredException);
    });

    it('throws InvalidTokenException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.execute('raw-token')).rejects.toBeInstanceOf(InvalidTokenException);
    });

    it('throws UserAlreadyVerifiedException when user is already active + verified', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ emailVerified: true, status: UserStatus.ACTIVE }),
      );
      await expect(service.execute('raw-token')).rejects.toBeInstanceOf(UserAlreadyVerifiedException);
    });

    it('throws InvalidTokenException when membership not found', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(null);
      await expect(service.execute('raw-token')).rejects.toBeInstanceOf(InvalidTokenException);
    });

    it('passes null vertical to provisionSchema when tenant has no vertical', async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(
        buildMembership({ vertical: null }),
      );

      await service.execute('raw-token-64chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

      expect(tenantSchemaManager.provisionSchema).toHaveBeenCalledWith(
        expect.objectContaining({ vertical: undefined }),
      );
    });
  });

  // ─── resend ───────────────────────────────────────────────────────────────────

  describe('resend', () => {
    it('resolves silently without queueing when email not registered', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resend('unknown@x.com')).resolves.toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(mailQueue.add).not.toHaveBeenCalled();
    });

    it('throws UserAlreadyVerifiedException when user is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ emailVerified: true }));
      await expect(service.resend('jane@clinic.com')).rejects.toBeInstanceOf(
        UserAlreadyVerifiedException,
      );
    });

    it('runs transaction and queues verify email for unverified user', async () => {
      txRunner.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          emailVerification: { updateMany: jest.fn(), create: jest.fn() },
        };
        return fn(tx);
      });

      await service.resend('jane@clinic.com');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mailQueue.add).toHaveBeenCalledTimes(1);
      expect(mailQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recipientEmail: 'jane@clinic.com' }),
      );
    });
  });
});
