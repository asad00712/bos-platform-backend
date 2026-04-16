import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import {
  createLocalJWKSet,
  importSPKI,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyResult,
} from 'jose';

type JwtPublicKey = Awaited<ReturnType<typeof importSPKI>>;
import {
  InvalidTokenException,
  TokenExpiredException,
} from '@bos/errors';
import type { BosJwtClaims } from '../types/jwt-claims.types';

export interface JwtVerifierOptions {
  /** Absolute or project-relative path to the public key PEM. */
  publicKeyPath: string;
  /** JWT signing algorithm, e.g., 'RS256'. */
  algorithm: string;
  issuer: string;
  audience: string;
}

/**
 * Verifies BOS-issued JWTs using the Auth Service's public key. Stateless —
 * no network call per request. Every BOS service mounts one of these via
 * `BosAuthClientModule.forRoot()`.
 *
 * Responsibilities:
 *   - Load public key from disk at boot (fail fast if missing)
 *   - Verify signature, issuer, audience, expiry
 *   - Return typed `BosJwtClaims` on success
 *   - Throw `InvalidTokenException` / `TokenExpiredException` on failure
 *
 * Revocation checks (jti lookup in Redis) are done SEPARATELY by
 * TokenRevocationService so this service stays pure/stateless and trivially
 * testable.
 */
@Injectable()
export class JwtVerifierService implements OnModuleInit {
  private readonly logger = new Logger(JwtVerifierService.name);
  private publicKey!: JwtPublicKey;

  constructor(private readonly options: JwtVerifierOptions) {}

  async onModuleInit(): Promise<void> {
    const pem = await readFile(this.options.publicKeyPath, 'utf8');
    this.publicKey = await importSPKI(pem, this.options.algorithm);
    this.logger.log(`JWT public key loaded (${this.options.algorithm})`);
  }

  async verify(token: string): Promise<BosJwtClaims> {
    let result: JWTVerifyResult<JWTPayload>;
    try {
      result = await jwtVerify(token, this.publicKey, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: [this.options.algorithm],
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_JWT_EXPIRED') {
        throw new TokenExpiredException();
      }
      throw new InvalidTokenException(
        err instanceof Error ? err.message : 'Token verification failed',
      );
    }
    return result.payload as unknown as BosJwtClaims;
  }

  /**
   * Returns a JWKS helper over the single public key — useful when a caller
   * wants to fetch the key for tools like `jose.EncryptJWT` or for exposing
   * a `/.well-known/jwks.json` endpoint downstream.
   */
  getJwks(): ReturnType<typeof createLocalJWKSet> | null {
    // Implementation deferred: requires converting SPKI → JWK. Exposed as a
    // hook so consumers can add later without an interface break.
    return null;
  }
}
