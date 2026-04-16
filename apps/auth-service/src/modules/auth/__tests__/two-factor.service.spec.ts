// jose and otpauth are ESM-only; mock them so ts-jest CJS transform doesn't break.
jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  importPKCS8: jest.fn(),
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
}));

jest.mock('otpauth', () => {
  const mockTotp = {
    toString: jest.fn().mockReturnValue('otpauth://totp/BOS%20Platform:test@x.com?secret=TESTSECRET'),
    validate: jest.fn().mockReturnValue(0), // 0 = current window, null = invalid
  };
  const MockTOTP = jest.fn().mockImplementation(() => mockTotp);

  const mockSecret = { base32: 'TESTSECRETBASE32' };
  const MockSecret = Object.assign(
    jest.fn().mockImplementation(() => mockSecret),
    { fromBase32: jest.fn().mockReturnValue(mockSecret) },
  );

  return { TOTP: MockTOTP, Secret: MockSecret };
});

import * as OTPAuth from 'otpauth';
import {
  InvalidTokenException,
  TwoFactorAlreadyEnabledException,
  TwoFactorNotEnabledException,
} from '@bos/errors';
import { TwoFactorService } from '../services/two-factor.service';

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@clinic.com',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [] as string[],
    ...overrides,
  };
}

describe('TwoFactorService', () => {
  const users = {
    findByIdOrThrow: jest.fn(),
    set2FA: jest.fn(),
    recordLogin: jest.fn(),
  };
  const refreshTokens = {
    create: jest.fn(),
  };
  const tokenIssuer = {
    issueAccessToken: jest.fn().mockResolvedValue({
      token: 'access.jwt',
      expiresAt: new Date(Date.now() + 900_000),
    }),
    generateRefreshToken: jest.fn().mockReturnValue({
      raw: 'raw-refresh',
      hash: 'hash-refresh',
      id: 'rt-1',
      expiresAt: new Date(Date.now() + 2_592_000_000),
    }),
    accessTtl: 900,
  };

  let service: TwoFactorService;

  beforeEach(() => {
    service = new TwoFactorService(
      users as unknown as ConstructorParameters<typeof TwoFactorService>[0],
      refreshTokens as unknown as ConstructorParameters<typeof TwoFactorService>[1],
      tokenIssuer as unknown as ConstructorParameters<typeof TwoFactorService>[2],
    );
  });

  // ─── beginSetup ───────────────────────────────────────────────────────────────

  describe('beginSetup', () => {
    it('returns secret + otpauthUrl + 10 backup codes and stores them (2FA disabled)', async () => {
      users.findByIdOrThrow.mockResolvedValue(buildUser());

      const result = await service.beginSetup('user-1');

      expect(result.secret).toBe('TESTSECRETBASE32');
      expect(result.otpauthUrl).toContain('otpauth://totp');
      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toMatch(/^[A-F0-9]{8}$/);
      expect(users.set2FA).toHaveBeenCalledWith('user-1', expect.objectContaining({ enabled: false }));
    });

    it('throws TwoFactorAlreadyEnabledException when 2FA is already enabled', async () => {
      users.findByIdOrThrow.mockResolvedValue(buildUser({ twoFactorEnabled: true }));
      await expect(service.beginSetup('user-1')).rejects.toBeInstanceOf(
        TwoFactorAlreadyEnabledException,
      );
      expect(users.set2FA).not.toHaveBeenCalled();
    });
  });

  // ─── confirmSetup ─────────────────────────────────────────────────────────────

  describe('confirmSetup', () => {
    it('activates 2FA when TOTP code is valid', async () => {
      users.findByIdOrThrow.mockResolvedValue(
        buildUser({ twoFactorSecret: 'TESTSECRETBASE32', twoFactorBackupCodes: ['hash1', 'hash2'] }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(0),
      }));

      await service.confirmSetup('user-1', '123456');

      expect(users.set2FA).toHaveBeenCalledWith('user-1', expect.objectContaining({ enabled: true }));
    });

    it('throws InvalidTokenException when TOTP code is invalid', async () => {
      users.findByIdOrThrow.mockResolvedValue(
        buildUser({ twoFactorSecret: 'TESTSECRETBASE32', twoFactorBackupCodes: [] }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(null),
      }));

      await expect(service.confirmSetup('user-1', '000000')).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
      expect(users.set2FA).not.toHaveBeenCalled();
    });

    it('throws TwoFactorAlreadyEnabledException when 2FA is already active', async () => {
      users.findByIdOrThrow.mockResolvedValue(buildUser({ twoFactorEnabled: true }));
      await expect(service.confirmSetup('user-1', '123456')).rejects.toBeInstanceOf(
        TwoFactorAlreadyEnabledException,
      );
    });

    it('throws InvalidTokenException when setup was not started (no secret)', async () => {
      users.findByIdOrThrow.mockResolvedValue(buildUser({ twoFactorSecret: null }));
      await expect(service.confirmSetup('user-1', '123456')).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
    });
  });

  // ─── disable ──────────────────────────────────────────────────────────────────

  describe('disable', () => {
    it('disables 2FA when TOTP code is valid', async () => {
      users.findByIdOrThrow.mockResolvedValue(
        buildUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET' }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(0),
      }));

      await service.disable('user-1', '123456');

      expect(users.set2FA).toHaveBeenCalledWith('user-1', {
        enabled: false,
        secret: null,
        backupCodes: [],
      });
    });

    it('disables 2FA when a valid backup code is provided', async () => {
      // createHash('sha256').update('AB12CD34').digest('hex')
      const { createHash } = await import('node:crypto');
      const backupHash = createHash('sha256').update('AB12CD34').digest('hex');

      users.findByIdOrThrow.mockResolvedValue(
        buildUser({
          twoFactorEnabled: true,
          twoFactorSecret: 'SECRET',
          twoFactorBackupCodes: [backupHash],
        }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(null), // TOTP fails
      }));

      await service.disable('user-1', 'AB12CD34');

      expect(users.set2FA).toHaveBeenCalledWith('user-1', {
        enabled: false,
        secret: null,
        backupCodes: [],
      });
    });

    it('throws InvalidTokenException when both TOTP and backup code are invalid', async () => {
      users.findByIdOrThrow.mockResolvedValue(
        buildUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET', twoFactorBackupCodes: [] }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(null),
      }));

      await expect(service.disable('user-1', '000000')).rejects.toBeInstanceOf(InvalidTokenException);
    });

    it('throws TwoFactorNotEnabledException when 2FA is not enabled', async () => {
      users.findByIdOrThrow.mockResolvedValue(buildUser({ twoFactorEnabled: false }));
      await expect(service.disable('user-1', '123456')).rejects.toBeInstanceOf(
        TwoFactorNotEnabledException,
      );
    });
  });

  // ─── verifyLogin ──────────────────────────────────────────────────────────────

  describe('verifyLogin', () => {
    it('issues full tokens on valid TOTP code', async () => {
      users.findByIdOrThrow.mockResolvedValue(
        buildUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET' }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(0),
      }));

      const result = await service.verifyLogin('user-1', 'sess-1', '123456', '1.2.3.4');

      expect(result.accessToken).toBe('access.jwt');
      expect(result.refreshTokenRaw).toBe('raw-refresh');
      expect(refreshTokens.create).toHaveBeenCalled();
      expect(users.recordLogin).toHaveBeenCalledWith('user-1', '1.2.3.4');
    });

    it('consumes backup code and issues tokens', async () => {
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256').update('BACKUP01').digest('hex');

      users.findByIdOrThrow.mockResolvedValue(
        buildUser({
          twoFactorEnabled: true,
          twoFactorSecret: 'SECRET',
          twoFactorBackupCodes: [hash, 'other-hash'],
        }),
      );
      // No TOTP mock needed: service checks isBackupCode first (short-circuit OR),
      // so verifyTotp is never called when a backup code matches.

      await service.verifyLogin('user-1', 'sess-1', 'BACKUP01', null);

      // Backup code consumed — only 'other-hash' remains
      expect(users.set2FA).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ backupCodes: ['other-hash'] }),
      );
    });

    it('throws InvalidTokenException on invalid code', async () => {
      users.findByIdOrThrow.mockResolvedValue(
        buildUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET', twoFactorBackupCodes: [] }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(null),
      }));

      await expect(service.verifyLogin('user-1', 'sess-1', 'BADCODE', null)).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('throws TwoFactorNotEnabledException when user has no 2FA', async () => {
      users.findByIdOrThrow.mockResolvedValue(buildUser({ twoFactorEnabled: false }));
      await expect(service.verifyLogin('user-1', 'sess-1', '123456', null)).rejects.toBeInstanceOf(
        TwoFactorNotEnabledException,
      );
    });
  });

  // ─── regenerateBackupCodes ────────────────────────────────────────────────────

  describe('regenerateBackupCodes', () => {
    it('returns 10 new uppercase hex codes and invalidates old ones', async () => {
      users.findByIdOrThrow.mockResolvedValue(
        buildUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET' }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(0),
      }));

      const codes = await service.regenerateBackupCodes('user-1', '123456');

      expect(codes).toHaveLength(10);
      codes.forEach((c) => expect(c).toMatch(/^[A-F0-9]{8}$/));
      expect(users.set2FA).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ enabled: true, backupCodes: expect.arrayContaining([expect.any(String)]) }),
      );
    });

    it('throws InvalidTokenException when TOTP is invalid', async () => {
      users.findByIdOrThrow.mockResolvedValue(
        buildUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET' }),
      );
      (OTPAuth.TOTP as unknown as jest.Mock).mockImplementationOnce(() => ({
        validate: jest.fn().mockReturnValue(null),
      }));

      await expect(service.regenerateBackupCodes('user-1', 'BADCODE')).rejects.toBeInstanceOf(
        InvalidTokenException,
      );
    });

    it('throws TwoFactorNotEnabledException when 2FA is not active', async () => {
      users.findByIdOrThrow.mockResolvedValue(buildUser({ twoFactorEnabled: false }));
      await expect(service.regenerateBackupCodes('user-1', '123456')).rejects.toBeInstanceOf(
        TwoFactorNotEnabledException,
      );
    });
  });
});
