import { Injectable } from '@nestjs/common';
import { RedisService } from '@bos/redis';
import { REDIS_KEY_PREFIX } from '@bos/common';

/**
 * Checks Redis for tokens that have been explicitly revoked (logout,
 * admin-revoked, suspected reuse). Access tokens are stateless JWTs —
 * without this service, revocation would have to wait for token expiry
 * (15 minutes). With this service, revocation is effective instantly and
 * costs ~0.2ms per request (Redis EXISTS is cheap + pipelineable).
 *
 * The revocation key carries the remaining access-token lifetime as TTL,
 * so Redis auto-cleans up once the token would expire naturally.
 */
@Injectable()
export class TokenRevocationService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Marks a token (by `jti`) as revoked. Set TTL slightly longer than the
   * remaining access-token lifetime so there's no revocation gap near expiry.
   */
  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    const key = `${REDIS_KEY_PREFIX.REVOKED_JTI}${jti}`;
    await this.redis.client.set(key, '1', 'EX', Math.max(1, ttlSeconds));
  }

  /**
   * Returns true if a token's jti has been revoked. Called on every
   * authenticated request via JwtAuthGuard.
   */
  async isRevoked(jti: string): Promise<boolean> {
    const key = `${REDIS_KEY_PREFIX.REVOKED_JTI}${jti}`;
    const result = await this.redis.client.exists(key);
    return result === 1;
  }

  /**
   * Bulk-revoke all tokens belonging to a session. Used on logout-all
   * and when a refresh token reuse is detected.
   */
  async revokeMany(jtis: string[], ttlSeconds: number): Promise<void> {
    if (jtis.length === 0) {
      return;
    }
    const pipeline = this.redis.client.pipeline();
    for (const jti of jtis) {
      pipeline.set(`${REDIS_KEY_PREFIX.REVOKED_JTI}${jti}`, '1', 'EX', Math.max(1, ttlSeconds));
    }
    await pipeline.exec();
  }
}
