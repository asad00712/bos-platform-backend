import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CorePrismaService } from '@bos/database';
import { UserStatus, TenantMembershipStatus, TenantStatus } from '@bos/common';
import {
  InvalidTokenException,
  TokenExpiredException,
  UserAlreadyVerifiedException,
} from '@bos/errors';
import { TenantSchemaManager } from '@bos/database';
import {
  QUEUE_NAMES,
  MAIL_JOB_NAMES,
  EmailTemplateId,
  type SendEmailJobPayload,
} from '@bos/queue';

export interface VerifyEmailResult {
  userId: string;
  tenantId: string;
}

/**
 * Verifies an email address using the token delivered in the signup email.
 *
 * On success:
 *  1. Marks the user as ACTIVE (status was pending_verification)
 *  2. Marks TenantMembership as ACTIVE (was INVITED at signup)
 *  3. Provisions the tenant schema via TenantSchemaManager (runs migrations +
 *     seeds default roles/permissions)
 *  4. Updates Tenant status from PROVISIONING → ACTIVE
 *
 * Token is a 64-char hex random string. We store its SHA-256 hash in DB.
 * The token can only be used once — we delete it on success.
 */
@Injectable()
export class EmailVerifyService {
  private readonly logger = new Logger(EmailVerifyService.name);
  private readonly ttl: number;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly tenantSchemaManager: TenantSchemaManager,
    config: ConfigService,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue<SendEmailJobPayload>,
  ) {
    this.ttl = config.get<number>('AUTH_EMAIL_VERIFY_TTL', 86_400);
    this.frontendUrl = config.get<string>('APP_FRONTEND_URL', 'http://localhost:3000');
  }

  async execute(rawToken: string): Promise<VerifyEmailResult> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const record = await this.prisma.emailVerification.findUnique({
      where: { tokenHash },
    });
    if (!record) {
      throw new InvalidTokenException('Email verification token is invalid');
    }
    if (record.verifiedAt) {
      throw new InvalidTokenException('Email verification token has already been used');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new TokenExpiredException();
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) {
      throw new InvalidTokenException('User not found for this token');
    }
    if (user.emailVerified && user.status === UserStatus.ACTIVE) {
      throw new UserAlreadyVerifiedException();
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });
    if (!membership) {
      throw new InvalidTokenException('No tenant membership found for this user');
    }

    const { tenant } = membership;

    // Mark token used and activate user + membership + tenant in one transaction.
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerification.update({
        where: { tokenHash },
        data: { verifiedAt: new Date() },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { emailVerified: true, status: UserStatus.ACTIVE },
      });

      await tx.tenantMembership.update({
        where: { id: membership.id },
        data: { status: TenantMembershipStatus.ACTIVE },
      });
    });

    // Provision schema AFTER transaction commits — schema creation is
    // irreversible, so we do it after all DB writes succeed.
    try {
      await this.tenantSchemaManager.provisionSchema({
        schemaName:   tenant.schemaName,
        vertical:     tenant.vertical ?? undefined,
        ownerUserId:  user.id,
      });
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.ACTIVE },
      });
      this.logger.log(`Tenant schema provisioned: ${tenant.schemaName}`);
    } catch (err: unknown) {
      // Schema provisioning failed — update tenant to error state so ops can retry.
      // User is still activated; they can try again via support.
      this.logger.error(`Schema provisioning failed for tenant ${tenant.id}`, err);
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.SUSPENDED },
      });
      throw err;
    }

    return { userId: user.id, tenantId: tenant.id };
  }

  /**
   * Development-only shortcut: verifies a user by email without a token.
   * Runs the exact same activation + schema-provisioning logic as execute().
   *
   * NEVER call this from production code paths — it is exposed only by DevController
   * which is not registered when NODE_ENV=production.
   */
  async bypassVerify(email: string): Promise<VerifyEmailResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
      throw new InvalidTokenException('No user found with that email');
    }
    if (user.emailVerified && user.status === UserStatus.ACTIVE) {
      throw new UserAlreadyVerifiedException();
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });
    if (!membership) {
      throw new InvalidTokenException('No tenant membership found for this user');
    }

    const { tenant } = membership;

    await this.prisma.$transaction(async (tx) => {
      // Expire any pending tokens so they can't be used after bypass
      await tx.emailVerification.updateMany({
        where: { userId: user.id, verifiedAt: null },
        data: { verifiedAt: new Date() },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { emailVerified: true, status: UserStatus.ACTIVE },
      });

      await tx.tenantMembership.update({
        where: { id: membership.id },
        data: { status: TenantMembershipStatus.ACTIVE },
      });
    });

    try {
      await this.tenantSchemaManager.provisionSchema({
        schemaName:   tenant.schemaName,
        vertical:     tenant.vertical ?? undefined,
        ownerUserId:  user.id,
      });
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.ACTIVE },
      });
      this.logger.log(`[DEV] Tenant schema provisioned: ${tenant.schemaName}`);
    } catch (err: unknown) {
      this.logger.error(`[DEV] Schema provisioning failed for tenant ${tenant.id}`, err);
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.SUSPENDED },
      });
      throw err;
    }

    return { userId: user.id, tenantId: tenant.id };
  }

  /**
   * Re-issues an email verification token for a user whose token has expired.
   * Queues the verification email via BullMQ — silent when email is not found
   * (never reveals whether an address is registered).
   */
  async resend(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, firstName: true, emailVerified: true },
    });
    if (!user) {
      // Silent: don't reveal whether email is registered.
      return;
    }
    if (user.emailVerified) {
      throw new UserAlreadyVerifiedException();
    }

    const rawToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Expire previous tokens for this user and create a new one.
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerification.updateMany({
        where: { userId: user.id, verifiedAt: null },
        data: { expiresAt: new Date() },
      });
      await tx.emailVerification.create({
        data: {
          tokenHash,
          userId: user.id,
          email: user.email,
          expiresAt: new Date(Date.now() + this.ttl * 1000),
        },
      });
    });

    await this.mailQueue.add(
      MAIL_JOB_NAMES.SEND_EMAIL,
      {
        tenantId:          null,
        recipientEmail:    user.email,
        subject:           'Verify your email address — BOS Platform',
        templateId:        EmailTemplateId.VERIFY_EMAIL,
        templateData:      {
          firstName:    user.firstName ?? user.email.split('@')[0],
          verifyUrl:    `${this.frontendUrl}/verify-email?token=${rawToken}`,
          expiresHours: Math.round(this.ttl / 3600),
        },
        triggeredByUserId: null,
        correlationId:     null,
      },
    );
  }
}
