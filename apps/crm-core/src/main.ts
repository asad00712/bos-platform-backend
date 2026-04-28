import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { applySecurity, createValidationPipe } from '@bos/security';
import { AppModule } from './app.module';
import { applySwagger } from './bootstrap/apply-swagger';

const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const logger = app.get(Logger);

  const corsOrigins = (config.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  applySecurity(app, {
    corsOrigins,
    corsCredentials: config.get<boolean>('CORS_CREDENTIALS', true),
    trustProxy: 1,
    jsonBodyLimit: '1mb',
    urlencodedBodyLimit: '1mb',
  });

  app.useGlobalPipes(createValidationPipe());
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health', 'health/live', 'health/ready'] });

  applySwagger(app, {
    serviceName: 'CRM Core',
    version: '0.1.0',
    routePrefix: API_PREFIX,
    enabled: config.get<string>('NODE_ENV') !== 'production',
  });

  const port = config.getOrThrow<number>('CRM_CORE_PORT');
  await app.listen(port);

  logger.log(`CRM Core service listening on port ${port}`, 'Bootstrap');
  logger.log(`Swagger UI: http://localhost:${port}/${API_PREFIX}/docs`, 'Bootstrap');
}

bootstrap().catch((err: unknown) => {
  console.error('CRM Core service failed to start:', err);
  process.exit(1);
});
