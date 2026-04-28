import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface SwaggerOptions {
  serviceName: string;
  version: string;
  routePrefix: string;
  /** If true, expose Swagger UI. Always false in production unless auth-gated. */
  enabled: boolean;
}

/**
 * Mounts Swagger UI at `${routePrefix}/docs` with the standard BOS security
 * scheme (Bearer JWT). Disabled entirely in production by default — expose
 * only behind an auth-gated route if enabling for prod.
 */
export function applySwagger(app: INestApplication, options: SwaggerOptions): void {
  if (!options.enabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle(`BOS ${options.serviceName}`)
    .setDescription(
      `${options.serviceName} OpenAPI specification. ` +
        'All error responses follow the envelope in @bos/errors. ' +
        'All success responses are wrapped by the global TransformInterceptor.',
    )
    .setVersion(options.version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'BOS-issued access token',
      },
      'bearer',
    )
    .addCookieAuth('refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
      description: 'Opaque refresh token issued at login',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup(`${options.routePrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
