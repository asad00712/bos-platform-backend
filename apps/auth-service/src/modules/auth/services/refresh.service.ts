import { Injectable, Logger } from '@nestjs/common';
import { SessionEndReason, SessionScope } from '@bos/common';
import {
  RefreshTokenInvalidException,
  TokenReuseDetectedException,
} from '@bos/errors';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { SessionsRepository } from '../repositories/sessions.repository';
import {
  TokenIssuerService,
  hashRefreshToken,
} from './token-issuer.service';

export interface RefreshResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  accessTokenExpiresIn: number;
  refreshTokenRaw: string;
  refreshTokenExpiresAt: Date;
}

/**
 * Rotates refresh tokens with reuse detection.
 *
 * Security model: each refresh_tokens row is used EXACTLY ONCE. On use we
 * set `usedAt`. On subsequent refresh with the same token, we detect the
 * reuse, revoke the ENTIRE family (every token descended from the same
 * initial login), and end the session. Real user must re-login; attacker
 * is cut off.
 */
@Injectable()
export class RefreshService {
  private readonly logger = new Logger(RefreshService.name);

  constructor(
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly sessions: SessionsRepository,
    private readonly tokenIssuer: TokenIssuerService,
  ) {}

  async execute(rawRefreshToken: string): Promise<RefreshResult> {
    const hash = hashRefreshToken(rawRefreshToken);
    const existing = await this.refreshTokens.findByHash(hash);
    if (!existing) {
      throw new RefreshTokenInvalidException();
    }

    if (existing.revokedAt) {
      throw new RefreshTokenInvalidException();
    }

    if (existing.usedAt) {
      // Reuse detected! Kill the whole family + end session + audit.
      this.logger.warn(
        `Refresh token reuse detected — revoking family ${existing.familyId} for user ${existing.userId}`,
      );
      await this.refreshTokens.revokeFamily(existing.familyId, 'reuse_detected');
      await this.sessions.end(existing.sessionId, SessionEndReason.TOKEN_REUSE_DETECTED);
      throw new TokenReuseDetectedException();
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new RefreshTokenInvalidException();
    }

    // Mark old token used first — if anything below fails, at least the
    // current token is burned and future reuses remain detectable.
    await this.refreshTokens.markUsed(existing.id);

    const session = await this.sessions.findById(existing.sessionId);
    if (!session || session.endedAt) {
      throw new RefreshTokenInvalidException();
    }

    // Issue new token pair. New refresh shares familyId with parent.
    // tenantId comes from the session row (populated at login time).
    const access = await this.tokenIssuer.issueAccessToken({
      sub:                existing.userId,
      scope:              SessionScope.TENANT,
      sessionId:          existing.sessionId,
      tenantId:           session.tenantId,
      activeBranchId:     session.activeBranchId,
      accessibleBranchIds: [],
      hasTenantWideAccess: false,
      roles:              [],
      v: 1,
    });

    const newRefresh = this.tokenIssuer.generateRefreshToken();
    await this.refreshTokens.create({
      id: newRefresh.id,
      tokenHash: newRefresh.hash,
      userId: existing.userId,
      sessionId: existing.sessionId,
      familyId: existing.familyId,
      parentId: existing.id,
      expiresAt: newRefresh.expiresAt,
    });

    await this.sessions.touch(existing.sessionId);

    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      accessTokenExpiresIn: this.tokenIssuer.accessTtl,
      refreshTokenRaw: newRefresh.raw,
      refreshTokenExpiresAt: newRefresh.expiresAt,
    };
  }
}
