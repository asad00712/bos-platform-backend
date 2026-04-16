import type { ConfigService } from '@nestjs/config';
import type { PasswordHasherService } from '@bos/security';
import {
  InvalidTokenException,
  PasswordTooWeakException,
  TokenExpiredException,
} from '@bos/errors';
import { PasswordResetService } from '../services/password-reset.service';

const FUTURE = new Date(Date.now() + 3_600_000);
const PAST   = new Date(Date.now() - 1);

function buildReset(overrides: Record<string, unknown> = {}) {
  return {
    tokenHash: 'some-hash',
    userId: 'user-1',
    usedAt: null,
    expiresAt: FUTURE,
    ...overrides,
  };
}

describe('PasswordResetService', () => {
  const txRunner = jest.fn();
  const prisma = {
    user: { findUnique: jest.fn() },
    passwordReset: { findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    session: { updateMany: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => txRunner(fn) as Promise<unknown>),
  };
  const hasher: Partial<PasswordHasherService> = {
    hash: jest.fn().mockResolvedValue('$argon2id$new'),
  };
  const config: Partial<ConfigService> = {
    get: jest.fn().mockReturnValue(3_600),
  };
  const mailQueue = { add: jest.fn().mockResolvedValue(undefined) };

  let service: PasswordResetService;

  beforeEach(() => {
    service = new PasswordResetService(
      prisma as unknown as ConstructorParameters<typeof PasswordResetService>[0],
      hasher as PasswordHasherService,
      config as ConfigService,
      mailQueue as unknown as ConstructorParameters<typeof PasswordResetService>[3],
    );

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'jane@x.com' });
    prisma.passwordReset.findUnique.mockResolvedValue(buildReset());
    prisma.passwordReset.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordReset.create.mockResolvedValue({});

    txRunner.mockImplementation((fn: (tx: unknown) => unknown) => {
      const tx = {
        passwordReset: { update: jest.fn(), updateMany: jest.fn(), create: jest.fn().mockResolvedValue({}) },
        user: { update: jest.fn() },
        session: { updateMany: jest.fn() },
        refreshToken: { updateMany: jest.fn() },
      };
      return fn(tx);
    });
  });

  // ─── requestReset ─────────────────────────────────────────────────────────────

  describe('requestReset', () => {
    it('creates a reset record and returns rawToken for known email', async () => {
      const result = await service.requestReset('jane@x.com');
      expect(typeof result.rawToken).toBe('string');
      expect(result.rawToken.length).toBeGreaterThanOrEqual(60);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('expires existing pending tokens before creating a new one', async () => {
      let capturedTx: Record<string, { updateMany: jest.Mock; create: jest.Mock }> | null = null;
      txRunner.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          passwordReset: { updateMany: jest.fn(), create: jest.fn().mockResolvedValue({}) },
        };
        capturedTx = tx as typeof tx;
        return fn(tx);
      });

      await service.requestReset('jane@x.com');

      expect(capturedTx!.passwordReset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', usedAt: null } }),
      );
      expect(capturedTx!.passwordReset.create).toHaveBeenCalled();
    });

    it('returns empty rawToken silently for unknown email (no enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.requestReset('nobody@x.com');
      expect(result.rawToken).toBe('');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('normalises email to lowercase before lookup', async () => {
      await service.requestReset('JANE@X.COM');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'jane@x.com' } }),
      );
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('hashes new password + marks token used + ends sessions in one transaction', async () => {
      let capturedTx: Record<string, { update?: jest.Mock; updateMany?: jest.Mock }> | null = null;
      txRunner.mockImplementation((fn: (tx: unknown) => unknown) => {
        const tx = {
          passwordReset: { update: jest.fn() },
          user: { update: jest.fn() },
          session: { updateMany: jest.fn() },
          refreshToken: { updateMany: jest.fn() },
        };
        capturedTx = tx as typeof tx;
        return fn(tx);
      });

      await service.resetPassword('valid-raw-token', 'NewSecurePass123!');

      expect(hasher.hash).toHaveBeenCalledWith('NewSecurePass123!');
      expect(capturedTx!.passwordReset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { usedAt: expect.any(Date) } }),
      );
      expect(capturedTx!.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { passwordHash: '$argon2id$new' } }),
      );
      expect(capturedTx!.session.updateMany).toHaveBeenCalled();
      expect(capturedTx!.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('throws PasswordTooWeakException before touching DB for a weak password', async () => {
      await expect(service.resetPassword('valid-token', 'weak')).rejects.toBeInstanceOf(
        PasswordTooWeakException,
      );
      expect(prisma.passwordReset.findUnique).not.toHaveBeenCalled();
    });

    it('throws InvalidTokenException when token not found', async () => {
      prisma.passwordReset.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('bad-token', 'SecurePass123!')).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
    });

    it('throws InvalidTokenException when token was already used', async () => {
      prisma.passwordReset.findUnique.mockResolvedValue(buildReset({ usedAt: new Date() }));
      await expect(service.resetPassword('used-token', 'SecurePass123!')).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
    });

    it('throws TokenExpiredException when token is expired', async () => {
      prisma.passwordReset.findUnique.mockResolvedValue(buildReset({ expiresAt: PAST }));
      await expect(service.resetPassword('expired-token', 'SecurePass123!')).rejects.toBeInstanceOf(
        TokenExpiredException,
      );
    });
  });
});
