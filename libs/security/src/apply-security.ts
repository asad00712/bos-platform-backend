import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

export interface ApplySecurityOptions {
  corsOrigins: string[];
  corsCredentials?: boolean;
  jsonBodyLimit?: string;
  urlencodedBodyLimit?: string;
  trustProxy?: boolean | number | string;
  cookieSecret?: string;
}

export function applySecurity(
  app: INestApplication,
  options: ApplySecurityOptions,
): void {
  const expressApp = app as NestExpressApplication;

  if (options.trustProxy !== undefined) {
    expressApp.set('trust proxy', options.trustProxy);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
        },
      },
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.enableCors({
    origin: options.corsOrigins,
    credentials: options.corsCredentials ?? true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Request-ID', 'X-Correlation-ID', 'X-RateLimit-Remaining'],
    maxAge: 86_400,
  });

  app.use(compression());
  app.use(cookieParser(options.cookieSecret));

  expressApp.useBodyParser('json', { limit: options.jsonBodyLimit ?? '1mb' });
  expressApp.useBodyParser('urlencoded', {
    limit: options.urlencodedBodyLimit ?? '1mb',
    extended: true,
  });

  app.enableShutdownHooks();
}
