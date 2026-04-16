import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import {
  InvalidTokenException,
  TwoFactorNotEnabledException,
  TwoFactorAlreadyEnabledException,
} from '@bos/errors';
import { UsersService } from '../../users/users.service';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { TokenIssuerService } from './token-issuer.service';

export interface TwoFactorSetupResult {
  /** TOTP shared secret (base32) — shown once, user saves in authenticator app. */
  secret: string;
  /** otpauth:// URI for QR code generation. */
  otpauthUrl: string;
  /** 10 single-use backup codes — shown once. */
  backupCodes: string[];
}

export interface TwoFactorVerifyResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  accessTokenExpiresIn: number;
  refreshTokenRaw: string;
  refreshTokenExpiresAt: Date;
}

/**
 * TOTP-based 2FA using RFC 6238 (compatible with Google Authenticator, Authy,
 * 1Password, Bitwarden, etc.).
 *
 * Enroll flow:
 *   1. POST /auth/2fa/setup → returns secret + QR URI + 10 backup codes
 *   2. User scans QR in authenticator app
 *   3. POST /auth/2fa/confirm with TOTP code → activates 2FA on account
 *
 * Login flow:
 *   1. POST /auth/login → returns 2fa_pending temp token when user has 2FA enabled
 *   2. POST /auth/2fa/verify with temp token + TOTP code → issues full access token
 *
 * Backup codes: 10 hex codes, stored as SHA-256 hashes, single-use.
 */
@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private static readonly ISSUER = 'BOS Platform';
  private static readonly BACKUP_CODE_COUNT = 10;

  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly tokenIssuer: TokenIssuerService,
  ) {}

  /**
   * Initiates 2FA setup — generates secret + backup codes, stores them on the
   * user record. 2FA is NOT active until `confirmSetup` succeeds.
   */
  async beginSetup(userId: string): Promise<TwoFactorSetupResult> {
    const user = await this.users.findByIdOrThrow(userId);
    if (user.twoFactorEnabled) {
      throw new TwoFactorAlreadyEnabledException();
    }

    const secret = new OTPAuth.Secret({ size: 20 });
    const secretBase32 = secret.base32;

    const totp = new OTPAuth.TOTP({
      issuer: TwoFactorService.ISSUER,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const backupCodes = this.generateBackupCodes();
    const backupHashes = backupCodes.map(hashBackupCode);

    await this.users.set2FA(userId, {
      enabled: false,
      secret: secretBase32,
      backupCodes: backupHashes,
    });

    return {
      secret: secretBase32,
      otpauthUrl: totp.toString(),
      backupCodes,
    };
  }

  /**
   * Confirms TOTP setup — verifies the provided code against the stored secret
   * and marks 2FA as active on the account.
   */
  async confirmSetup(userId: string, totpCode: string): Promise<void> {
    const user = await this.users.findByIdOrThrow(userId);
    if (user.twoFactorEnabled) {
      throw new TwoFactorAlreadyEnabledException();
    }
    if (!user.twoFactorSecret) {
      throw new InvalidTokenException('2FA setup not started. Call /auth/2fa/setup first.');
    }

    if (!this.verifyTotp(totpCode, user.twoFactorSecret)) {
      throw new InvalidTokenException('Invalid TOTP code');
    }

    await this.users.set2FA(userId, {
      enabled: true,
      secret: user.twoFactorSecret,
      backupCodes: user.twoFactorBackupCodes,
    });

    this.logger.log(`2FA enabled for user ${userId}`);
  }

  /**
   * Disables 2FA. Requires a valid TOTP code (or backup code) to confirm intent.
   */
  async disable(userId: string, totpOrBackupCode: string): Promise<void> {
    const user = await this.users.findByIdOrThrow(userId);
    if (!user.twoFactorEnabled) {
      throw new TwoFactorNotEnabledException();
    }

    const valid = this.verifyCodeOrBackup(totpOrBackupCode, user.twoFactorSecret!, user.twoFactorBackupCodes);
    if (!valid) {
      throw new InvalidTokenException('Invalid TOTP or backup code');
    }

    await this.users.set2FA(userId, { enabled: false, secret: null, backupCodes: [] });
    this.logger.log(`2FA disabled for user ${userId}`);
  }

  /**
   * Completes a login that required 2FA. The caller provides:
   *  - userId + sessionId from the 2fa_pending JWT claims
   *  - TOTP code (or backup code)
   *  - ipAddress for audit
   *
   * On success, issues full access + refresh tokens.
   */
  async verifyLogin(
    userId: string,
    sessionId: string,
    totpOrBackupCode: string,
    ipAddress: string | null,
  ): Promise<TwoFactorVerifyResult> {
    const user = await this.users.findByIdOrThrow(userId);

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new TwoFactorNotEnabledException();
    }

    const isBackupCode = this.isBackupCode(totpOrBackupCode, user.twoFactorBackupCodes);
    const valid =
      isBackupCode || this.verifyTotp(totpOrBackupCode, user.twoFactorSecret);

    if (!valid) {
      throw new InvalidTokenException('Invalid TOTP or backup code');
    }

    // Consume the backup code if one was used.
    if (isBackupCode) {
      const hash = hashBackupCode(totpOrBackupCode);
      const remaining = user.twoFactorBackupCodes.filter((h) => h !== hash);
      await this.users.set2FA(userId, {
        enabled: true,
        secret: user.twoFactorSecret,
        backupCodes: remaining,
      });
    }

    const access = await this.tokenIssuer.issueAccessToken({
      sub: userId,
      scope: 'tenant',
      sessionId,
      tenantId: null,
      activeBranchId: null,
      accessibleBranchIds: [],
      hasTenantWideAccess: false,
      roles: [],
      v: 1,
    });

    const refresh = this.tokenIssuer.generateRefreshToken();
    await this.refreshTokens.create({
      id: refresh.id,
      tokenHash: refresh.hash,
      userId,
      sessionId,
      familyId: refresh.id,
      expiresAt: refresh.expiresAt,
    });

    await this.users.recordLogin(userId, ipAddress);

    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      accessTokenExpiresIn: this.tokenIssuer.accessTtl,
      refreshTokenRaw: refresh.raw,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  /**
   * Regenerates all 10 backup codes. Old codes are invalidated immediately.
   * Requires current TOTP to authorize.
   */
  async regenerateBackupCodes(userId: string, totpCode: string): Promise<string[]> {
    const user = await this.users.findByIdOrThrow(userId);
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new TwoFactorNotEnabledException();
    }
    if (!this.verifyTotp(totpCode, user.twoFactorSecret)) {
      throw new InvalidTokenException('Invalid TOTP code');
    }

    const backupCodes = this.generateBackupCodes();
    const backupHashes = backupCodes.map(hashBackupCode);

    await this.users.set2FA(userId, {
      enabled: true,
      secret: user.twoFactorSecret,
      backupCodes: backupHashes,
    });

    return backupCodes;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private verifyTotp(token: string, secretBase32: string): boolean {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: TwoFactorService.ISSUER,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
      });
      // delta=1 allows 1 period skew (30s window on either side)
      const delta = totp.validate({ token, window: 1 });
      return delta !== null;
    } catch {
      return false;
    }
  }

  private isBackupCode(code: string, backupHashes: string[]): boolean {
    return backupHashes.includes(hashBackupCode(code));
  }

  private verifyCodeOrBackup(
    code: string,
    secretBase32: string,
    backupHashes: string[],
  ): boolean {
    return this.verifyTotp(code, secretBase32) || this.isBackupCode(code, backupHashes);
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: TwoFactorService.BACKUP_CODE_COUNT }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );
  }
}

function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
}
