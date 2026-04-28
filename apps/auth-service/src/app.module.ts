import { Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { BosConfigModule, authServiceEnvSchema } from '@bos/config';
import { BosLoggerModule } from '@bos/logger';
import { BosSecurityModule } from '@bos/security';
import { BosHealthModule } from '@bos/health';
import { BosRedisModule } from '@bos/redis';
import { BosDatabaseModule } from '@bos/database';
import { BosAuthClientModule } from '@bos/auth-client';
import { BosQueueModule } from '@bos/queue';
import { BosMailerModule } from '@bos/mailer';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { DevModule } from './modules/dev/dev.module';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const logLevel = process.env.LOG_LEVEL ?? 'info';
const isProd = nodeEnv === 'production';

// Resolve public key path at module-evaluation time so we fail fast if
// misconfigured. Auth service signs with private key in TokenIssuerService
// and verifies incoming tokens via the shared auth-client lib (same public
// key the rest of the platform uses).
const publicKeyPath = resolve(
  process.cwd(),
  process.env.AUTH_JWT_PUBLIC_KEY_PATH ?? './keys/jwt-public.pem',
);

@Module({
  imports: [
    BosConfigModule.forRoot({ schema: authServiceEnvSchema }),
    BosLoggerModule.forRoot({
      serviceName: 'auth-service',
      nodeEnv,
      logLevel,
    }),
    BosSecurityModule.forRoot({
      isProd,
      throttle: {
        ttl: Number(process.env.THROTTLE_TTL ?? 60),
        limit: Number(process.env.THROTTLE_LIMIT ?? 1000),
      },
    }),
    BosRedisModule.forRoot({ withSubscriber: true }),
    BosDatabaseModule.forRoot({
      enableCore:    true,
      enableTenant:  true,
      enableVolatile: true,
    }),
    BosAuthClientModule.forRoot({
      publicKeyPath,
      algorithm: process.env.AUTH_JWT_ALGORITHM ?? 'RS256',
    }),
    BosQueueModule.forRoot(),
    BosMailerModule.forRoot(),
    BosHealthModule,
    UsersModule,
    AuthModule,
    MailModule,
    ...(isProd ? [] : [DevModule]),
  ],
})
export class AppModule {}
