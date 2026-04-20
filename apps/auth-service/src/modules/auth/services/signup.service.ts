import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CorePrismaService } from '@bos/database';
import { PasswordHasherService, checkPasswordPolicy } from '@bos/security';
import { PasswordTooWeakException, TenantSlugTakenException } from '@bos/errors';
import { TenantMembershipStatus, TenantStatus, UserStatus } from '@bos/common';
import {
  QUEUE_NAMES,
  MAIL_JOB_NAMES,
  EmailTemplateId,
  type SendEmailJobPayload,
} from '@bos/queue';
import { UsersService } from '../../users/users.service';
import type { SignupDto } from '../dto/signup.dto';

export interface SignupResult {
  userId: string;
  tenantId: string;
  tenantSlug: string;
}

/**
 * Owner self-signup flow. Creates User + Tenant + TenantMembership +
 * EmailVerification token in one DB transaction. Email sending and tenant
 * schema provisioning are queued AFTER transaction commits so a DB failure
 * never triggers side effects.
 *
 * Tenant schema provisioning is deferred to email verification — no cost
 * paid for unverified signups (spam protection).
 */
@Injectable()
export class SignupService {
  private readonly emailVerifyTtl: number;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly users: UsersService,
    private readonly hasher: PasswordHasherService,
    config: ConfigService,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue<SendEmailJobPayload>,
  ) {
    this.emailVerifyTtl = config.get<number>('AUTH_EMAIL_VERIFY_TTL', 86_400);
    this.frontendUrl    = config.get<string>('APP_FRONTEND_URL', 'http://localhost:3000');
  }

  async execute(dto: SignupDto): Promise<SignupResult> {
    // Password policy enforced here (not in DTO) so error codes match
    // the Error catalog precisely.
    const violations = checkPasswordPolicy(dto.password);
    if (violations.length > 0) {
      throw new PasswordTooWeakException(violations.map((v) => v.message));
    }

    // Uniqueness checks up-front for clearer error mapping (vs. unique
    // constraint races). The transaction below still enforces at DB level.
    if (await this.users.findByEmail(dto.email)) {
      // Silent 201 in signup to avoid account enumeration is a choice some
      // products make — we throw here because email uniqueness IS expected
      // and the UX signals `email in use, try login`.
      throw new (await import('@bos/errors')).UserAlreadyExistsException();
    }
    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug: dto.orgSlug } });
    if (existingSlug) {
      throw new TenantSlugTakenException();
    }

    const passwordHash = await this.hasher.hash(dto.password);
    const tenantId = randomUUID();
    const schemaName = buildSchemaName(tenantId);
    const verificationToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const verificationHash = createHash('sha256').update(verificationToken).digest('hex');

    const plan = await this.prisma.tenantPlan.findUnique({ where: { slug: 'free' } });
    if (!plan) {
      throw new Error('Seeded `free` tenant plan is missing — run pnpm db:seed:core');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          locale: dto.locale ?? 'en-US',
          timezone: dto.timezone ?? 'UTC',
          status: UserStatus.PENDING_VERIFICATION,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: dto.orgName,
          slug: dto.orgSlug,
          vertical: dto.vertical,
          status: TenantStatus.PROVISIONING,
          schemaName,
          planId: plan.id,
          ownerUserId: user.id,
          locale: dto.locale ?? 'en-US',
          timezone: dto.timezone ?? 'UTC',
        },
      });

      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          status: TenantMembershipStatus.INVITED,
        },
      });

      await tx.emailVerification.create({
        data: {
          tokenHash: verificationHash,
          userId: user.id,
          email: user.email,
          expiresAt: new Date(Date.now() + this.emailVerifyTtl * 1000),
        },
      });

      return { userId: user.id, tenantId: tenant.id, tenantSlug: tenant.slug };
    });

    await this.mailQueue.add(
      MAIL_JOB_NAMES.SEND_EMAIL,
      {
        tenantId:          result.tenantId,
        recipientEmail:    dto.email.trim().toLowerCase(),
        subject:           'Verify your email address — BOS Platform',
        templateId:        EmailTemplateId.VERIFY_EMAIL,
        templateData:      {
          firstName:    dto.firstName,
          verifyUrl:    `${this.frontendUrl}/verify-email?token=${verificationToken}`,
          expiresHours: Math.round(this.emailVerifyTtl / 3600),
        },
        triggeredByUserId: null,
        correlationId:     null,
      },
    );

    return result;
  }
}

function buildSchemaName(tenantId: string): string {
  return `tenant_${tenantId.replace(/-/g, '').slice(0, 16)}`;
}
