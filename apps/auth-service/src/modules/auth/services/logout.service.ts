import { Injectable } from '@nestjs/common';
import { SessionEndReason } from '@bos/common';
import { TokenRevocationService } from '@bos/auth-client';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { SessionsRepository } from '../repositories/sessions.repository';
import {
  TokenIssuerService,
  hashRefreshToken,
} from './token-issuer.service';

@Injectable()
export class LogoutService {
  constructor(
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly sessions: SessionsRepository,
    private readonly revocation: TokenRevocationService,
    private readonly tokenIssuer: TokenIssuerService,
  ) {}

  async logoutCurrent(params: {
    sessionId: string;
    accessJti: string;
    rawRefreshToken: string | null;
  }): Promise<void> {
    await this.revocation.revoke(params.accessJti, this.tokenIssuer.accessTtl);

    if (params.rawRefreshToken) {
      const existing = await this.refreshTokens.findByHash(hashRefreshToken(params.rawRefreshToken));
      if (existing && !existing.revokedAt) {
        await this.refreshTokens.revoke(existing.id, 'logout');
      }
    }

    await this.sessions.end(params.sessionId, SessionEndReason.LOGOUT);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId, 'logout_all');
    await this.sessions.endAllForUser(userId, SessionEndReason.LOGOUT);
    // Individual access JTIs are not revocable in bulk without a list;
    // they'll naturally expire in ≤15 min. Short access TTL makes this
    // acceptable per OWASP logout guidance.
  }
}
