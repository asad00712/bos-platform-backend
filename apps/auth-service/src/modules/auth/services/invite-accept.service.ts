import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CorePrismaService, TenantPrismaService } from '@bos/database';
import { PasswordHasherService, checkPasswordPolicy } from '@bos/security';
import { SessionScope, TenantMembershipStatus, UserStatus } from '@bos/common';
import {
  InvalidInviteException,
  InviteExpiredException,
  InviteAlreadyUsedException,
  PasswordTooWeakException,
} from '@bos/errors';
import { SessionsRepository } from '../repositories/sessions.repository';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { TokenIssuerService } from './token-issuer.service';
import type { LoginSuccessResult } from './login.service';

export interface InviteAcceptContext {
  rawToken: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Accepts a staff invite:
 *  1. Looks up the UserInvite by SHA-256 token hash — rejects if missing/revoked.
 *  2. Guards: not yet accepted, not expired, password meets policy.
 *  3. Core DB transaction: sets password + activates user + activates TenantMembership
 *     + stamps acceptedAt on the invite.
 *  4. Creates UserBranchMembership in the tenant schema with the invited role.
 *  5. Issues a full session (access + refresh tokens) so the user is logged in immediately
 *     after acceptance — no separate login step required.
 */
@Injectable()
export class InviteAcceptService {
  private readonly logger = new Logger(InviteAcceptService.name);

  constructor(
    private readonly corePrisma: CorePrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly hasher: PasswordHasherService,
    private readonly sessions: SessionsRepository,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly tokenIssuer: TokenIssuerService,
  ) {}

  async execute(ctx: InviteAcceptContext): Promise<LoginSuccessResult> {
    const tokenHash = createHash('sha256').update(ctx.rawToken).digest('hex');

    const invite = await this.corePrisma.userInvite.findUnique({
      where: { tokenHash },
      include: {
        tenant: { select: { id: true, schemaName: true } },
      },
    });

    // Treat missing + revoked identically — never reveal invite status to callers.
    if (!invite || invite.revokedAt) {
      throw new InvalidInviteException();
    }
    if (invite.acceptedAt) {
      throw new InviteAlreadyUsedException();
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new InviteExpiredException();
    }

    const violations = checkPasswordPolicy(ctx.password);
    if (violations.length > 0) {
      throw new PasswordTooWeakException(violations.map((v) => v.message));
    }

    const passwordHash = await this.hasher.hash(ctx.password);

    // ── Core DB transaction ────────────────────────────────────────────────────
    await this.corePrisma.$transaction(async (tx) => {
      // Set password + flip user to ACTIVE
      await tx.user.update({
        where: { id: invite.userId },
        data: {
          passwordHash,
          emailVerified: true,
          status: UserStatus.ACTIVE,
        },
      });

      // Activate tenant membership
      await tx.tenantMembership.update({
        where: {
          userId_tenantId: { userId: invite.userId, tenantId: invite.tenantId },
        },
        data: {
          status: TenantMembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      // Consume the invite — single-use
      await tx.userInvite.update({
        where: { tokenHash },
        data: { acceptedAt: new Date() },
      });
    });

    // ── Tenant schema: create UserBranchMembership ─────────────────────────────
    // Runs after the core transaction commits. Failure here is exceptional (schema
    // exists, role/branch IDs were validated at invite creation time).
    try {
      const tenantClient = this.tenantPrisma.forSchema(invite.tenant.schemaName);
      await tenantClient.userBranchMembership.create({
        data: {
          userId: invite.userId,
          roleId: invite.roleId,
          branchId: invite.branchId ?? null,
          assignedByUserId: invite.invitedByUserId,
          roundRobinAvailable: true,
        },
      });
    } catch (err: unknown) {
      this.logger.error(
        `UserBranchMembership creation failed for user ${invite.userId} ` +
          `in schema ${invite.tenant.schemaName}. User is activated but has no role. ` +
          `Manual intervention required.`,
        err,
      );
      throw err;
    }

    // ── Issue session + tokens (direct login after acceptance) ─────────────────
    const user = await this.corePrisma.user.findUniqueOrThrow({
      where: { id: invite.userId },
    });

    const session = await this.sessions.create({
      user: { connect: { id: invite.userId } },
      tenant: { connect: { id: invite.tenantId } },
      scope: SessionScope.TENANT,
      ipAddress: ctx.ipAddress ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
    });

    const access = await this.tokenIssuer.issueAccessToken({
      sub: invite.userId,
      scope: 'tenant',
      sessionId: session.id,
      tenantId: invite.tenantId,
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
      userId: invite.userId,
      sessionId: session.id,
      familyId: refresh.id,
      expiresAt: refresh.expiresAt,
    });

    this.logger.log(`Invite accepted: user=${invite.userId}, tenant=${invite.tenantId}`);

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
}
