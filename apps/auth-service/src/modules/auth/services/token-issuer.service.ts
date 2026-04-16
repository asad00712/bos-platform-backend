import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';

type JwtPrivateKey = Awaited<ReturnType<typeof importPKCS8>>;

export interface AccessTokenPayload {
  [claim: string]: unknown;
  sub: string;
  scope: 'tenant' | 'platform' | 'impersonation' | 'two_factor_pending';
  sessionId: string;
  v: 1;
}

export interface IssuedAccessToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export interface IssuedRefreshToken {
  /** Plaintext token (returned to client ONCE, in Set-Cookie). */
  raw: string;
  /** SHA-256 hash — stored in DB for later verification. */
  hash: string;
  id: string;
  expiresAt: Date;
}

/**
 * Signs JWT access tokens with the Auth Service's private RSA key and
 * generates opaque refresh tokens.
 *
 * The private key is loaded from disk ONCE at boot and kept in memory.
 * It never leaves this service. Only this service instance produces tokens
 * (public keys for verification are distributed to every other service via
 * `libs/auth-client`).
 */
@Injectable()
export class TokenIssuerService implements OnModuleInit {
  private readonly logger = new Logger(TokenIssuerService.name);
  private privateKey!: JwtPrivateKey;

  private readonly algorithm: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTtlSeconds: number;
  private readonly platformAccessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly twoFactorTempTtlSeconds: number;
  private readonly privateKeyPath: string;

  constructor(config: ConfigService) {
    this.algorithm = config.get<string>('AUTH_JWT_ALGORITHM', 'RS256');
    this.issuer = 'bos-auth';
    this.audience = 'bos-platform';
    this.accessTtlSeconds = config.get<number>('AUTH_JWT_ACCESS_TTL', 900);
    this.platformAccessTtlSeconds = config.get<number>('AUTH_JWT_PLATFORM_ACCESS_TTL', 300);
    this.refreshTtlSeconds = config.get<number>('AUTH_JWT_REFRESH_TTL', 2_592_000);
    this.twoFactorTempTtlSeconds = config.get<number>('AUTH_2FA_TEMP_TOKEN_TTL', 300);
    this.privateKeyPath = config.getOrThrow<string>('AUTH_JWT_PRIVATE_KEY_PATH');
  }

  async onModuleInit(): Promise<void> {
    const pem = await readFile(this.privateKeyPath, 'utf8');
    this.privateKey = await importPKCS8(pem, this.algorithm);
    this.logger.log(`JWT private key loaded (${this.algorithm})`);
  }

  get accessTtl(): number {
    return this.accessTtlSeconds;
  }

  get refreshTtl(): number {
    return this.refreshTtlSeconds;
  }

  get platformAccessTtl(): number {
    return this.platformAccessTtlSeconds;
  }

  get twoFactorTempTtl(): number {
    return this.twoFactorTempTtlSeconds;
  }

  async issueAccessToken(payload: AccessTokenPayload): Promise<IssuedAccessToken> {
    const ttl = payload.scope === 'platform' ? this.platformAccessTtlSeconds : this.accessTtlSeconds;
    const jti = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttl;

    const token = await new SignJWT({ ...payload, type: 'access' })
      .setProtectedHeader({ alg: this.algorithm })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .setJti(jti)
      .sign(this.privateKey);

    return {
      token,
      jti,
      expiresAt: new Date(exp * 1000),
    };
  }

  /**
   * Issues a short-lived token (5 min) used between password verification
   * and TOTP submission when 2FA is enabled.
   */
  async issueTwoFactorPendingToken(userId: string, sessionId: string): Promise<IssuedAccessToken> {
    const jti = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.twoFactorTempTtlSeconds;

    const token = await new SignJWT({
      sub: userId,
      scope: 'two_factor_pending',
      sessionId,
      v: 1,
      type: '2fa_pending',
    })
      .setProtectedHeader({ alg: this.algorithm })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .setJti(jti)
      .sign(this.privateKey);

    return { token, jti, expiresAt: new Date(exp * 1000) };
  }

  /**
   * Generates a cryptographically random refresh token. Returns raw + hash;
   * callers store the hash and return raw ONCE to the client.
   */
  generateRefreshToken(): IssuedRefreshToken {
    const raw = [randomUUID(), randomUUID()].join('.').replace(/-/g, '');
    const hash = hashRefreshToken(raw);
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);
    return { raw, hash, id: randomUUID(), expiresAt };
  }
}

/**
 * Deterministic hash for refresh token lookup. SHA-256 — we are NOT
 * storing passwords here, we're storing random high-entropy strings, so
 * argon2 is unnecessary overhead; we need a deterministic lookup key.
 */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
