import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CorePrismaService } from '@bos/database';
import { PasswordHasherService, checkPasswordPolicy } from '@bos/security';
import { SessionEndReason } from '@bos/common';
import {
  InvalidTokenException,
  TokenExpiredException,
  PasswordTooWeakException,
} from '@bos/errors';
import {
  QUEUE_NAMES,
  MAIL_JOB_NAMES,
  EmailTemplateId,
  type SendEmailJobPayload,
} from '@bos/queue';

export interface RequestResetResult {
  /** Raw token — empty string when email is not found (silent, no enumeration). */
  rawToken: string;
}

/**
 * Password reset flow (forgot password).
 *
 * 1. User submits email → we create a time-limited token (SHA-256 stored)
 *    and queue a password-reset email via BullMQ.
 * 2. User submits token + new password → we verify token, hash new password,
 *    update user record, and invalidate all active sessions (force re-login).
 *
 * Token TTL: AUTH_PASSWORD_RESET_TTL env (default 1 hour).
 * Token is single-use: `usedAt` is set on first use.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly ttlSeconds: number;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly hasher: PasswordHasherService,
    config: ConfigService,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue<SendEmailJobPayload>,
  ) {
    this.ttlSeconds = config.get<number>('AUTH_PASSWORD_RESET_TTL', 3600);
    this.frontendUrl = config.get<string>('APP_FRONTEND_URL', 'http://localhost:3000');
  }

  async requestReset(email: string): Promise<RequestResetResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, firstName: true },
    });

    // Always return success shape — never reveal whether the email is registered.
    if (!user) {
      return { rawToken: '' };
    }

    const rawToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Expire any existing pending reset tokens before issuing a new one.
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { expiresAt: new Date() },
      });
      await tx.passwordReset.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
        },
      });
    });

    await this.mailQueue.add(
      MAIL_JOB_NAMES.SEND_EMAIL,
      {
        tenantId:          null,
        recipientEmail:    user.email,
        subject:           'Reset your password — BOS Platform',
        templateId:        EmailTemplateId.PASSWORD_RESET,
        templateData:      {
          firstName:    user.firstName ?? user.email.split('@')[0],
          resetUrl:     `${this.frontendUrl}/reset-password?token=${rawToken}`,
          expiresHours: Math.round(this.ttlSeconds / 3600),
        },
        triggeredByUserId: null,
        correlationId:     null,
      },
    );

    return { rawToken };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const violations = checkPasswordPolicy(newPassword);
    if (violations.length > 0) {
      throw new PasswordTooWeakException(violations.map((v) => v.message));
    }

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.passwordReset.findUnique({ where: { tokenHash } });

    if (!record) {
      throw new InvalidTokenException('Password reset token is invalid');
    }
    if (record.usedAt) {
      throw new InvalidTokenException('Password reset token has already been used');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new TokenExpiredException();
    }

    const passwordHash = await this.hasher.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      // Mark token used.
      await tx.passwordReset.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      });

      // Update password.
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      // End all active sessions — user must re-login after password change.
      await tx.session.updateMany({
        where: { userId: record.userId, endedAt: null },
        data: { endedAt: new Date(), endReason: SessionEndReason.PASSWORD_CHANGED },
      });

      // Revoke all active refresh tokens.
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'password_reset' },
      });
    });

    this.logger.log(`Password reset completed for user ${record.userId}`);
  }
}
