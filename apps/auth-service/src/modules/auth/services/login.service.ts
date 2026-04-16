import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordHasherService } from '@bos/security';
import {
  REDIS_KEY_PREFIX,
  SessionScope,
  UserStatus,
} from '@bos/common';
import {
  AccountLockedException,
  EmailNotVerifiedException,
  InvalidCredentialsException,
  UserInactiveException,
  UserSuspendedException,
} from '@bos/errors';
import { RedisService } from '@bos/redis';
import type { User } from '@bos-prisma/core';
import { UsersService } from '../../users/users.service';
import { SessionsRepository } from '../repositories/sessions.repository';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { TokenIssuerService } from './token-issuer.service';

export interface LoginRequestContext {
  email: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginSuccessResult {
  requires2FA: false;
  user: User;
  accessToken: string;
  accessTokenExpiresAt: Date;
  accessTokenExpiresIn: number;
  refreshTokenRaw: string;
  refreshTokenExpiresAt: Date;
}

export interface LoginTwoFactorPendingResult {
  requires2FA: true;
  tempToken: string;
  tempTokenExpiresAt: Date;
}

export type LoginResult = LoginSuccessResult | LoginTwoFactorPendingResult;

@Injectable()
export class LoginService {
  private readonly maxAttempts: number;
  private readonly lockoutSeconds: number;

  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasherService,
    private readonly sessions: SessionsRepository,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly tokenIssuer: TokenIssuerService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.maxAttempts = config.get<number>('AUTH_LOCKOUT_MAX_ATTEMPTS', 10);
    this.lockoutSeconds = config.get<number>('AUTH_LOCKOUT_DURATION', 1800);
  }

  async execute(ctx: LoginRequestContext): Promise<LoginResult> {
    const user = await this.users.findByEmail(ctx.email);

    // Constant-time-ish: always hash the provided password even if user
    // doesn't exist, so response time does not leak account existence.
    if (!user) {
      await this.hasher.verify(
        '$argon2id$v=19$m=19456,t=2,p=1$bXVzdGxvb2tvayE$x0z8z8z8z8z8z8z8z8z8z8z8z8z8z8z8z8z8z8z8z8z',
        ctx.password,
      );
      throw new InvalidCredentialsException();
    }

    this.assertUserCanLogIn(user);

    const lockoutKey = `${REDIS_KEY_PREFIX.LOCKOUT}${user.id}`;
    const failureCount = await this.redis.client.get(lockoutKey);
    if (failureCount && Number(failureCount) >= this.maxAttempts) {
      await this.users.lock(user.id, new Date(Date.now() + this.lockoutSeconds * 1000));
      throw new AccountLockedException(new Date(Date.now() + this.lockoutSeconds * 1000));
    }

    const passwordOk = user.passwordHash
      ? await this.hasher.verify(user.passwordHash, ctx.password)
      : false;

    if (!passwordOk) {
      const newCount = await this.redis.client.incr(lockoutKey);
      if (newCount === 1) {
        await this.redis.client.expire(lockoutKey, this.lockoutSeconds);
      }
      if (newCount >= this.maxAttempts) {
        await this.users.lock(user.id, new Date(Date.now() + this.lockoutSeconds * 1000));
      }
      throw new InvalidCredentialsException();
    }

    // Password correct → clear lockout counter
    await this.redis.client.del(lockoutKey);

    const session = await this.sessions.create({
      user: { connect: { id: user.id } },
      scope: SessionScope.TENANT,
      ipAddress: ctx.ipAddress ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
    });

    // 2FA check
    if (user.twoFactorEnabled) {
      const temp = await this.tokenIssuer.issueTwoFactorPendingToken(user.id, session.id);
      return {
        requires2FA: true,
        tempToken: temp.token,
        tempTokenExpiresAt: temp.expiresAt,
      };
    }

    const access = await this.tokenIssuer.issueAccessToken({
      sub: user.id,
      scope: 'tenant',
      sessionId: session.id,
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
      userId: user.id,
      sessionId: session.id,
      familyId: refresh.id,
      expiresAt: refresh.expiresAt,
    });

    await this.users.recordLogin(user.id, ctx.ipAddress);

    return {
      requires2FA: false,
      user,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      accessTokenExpiresIn: this.tokenIssuer.accessTtl,
      refreshTokenRaw: refresh.raw,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  private assertUserCanLogIn(user: User): void {
    // Prisma generates user.status as a string literal union, not the
    // UserStatus enum — compare by string value explicitly.
    const status = user.status as UserStatus;
    switch (status) {
      case UserStatus.ACTIVE:
        return;
      case UserStatus.PENDING_VERIFICATION:
        throw new EmailNotVerifiedException();
      case UserStatus.LOCKED:
        throw new AccountLockedException(user.lockedUntil ?? undefined);
      case UserStatus.SUSPENDED:
        throw new UserSuspendedException();
      case UserStatus.INVITED:
      case UserStatus.DELETED:
      default:
        throw new UserInactiveException();
    }
  }
}
