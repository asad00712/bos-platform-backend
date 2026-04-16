import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@bos/common';

export interface BuildLoggerConfigOptions {
  serviceName: string;
  nodeEnv: string;
  logLevel: string;
}

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.body.password',
  'req.body.newPassword',
  'req.body.oldPassword',
  'req.body.refreshToken',
  'req.body.token',
  'req.body.code',
  'req.body.secret',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.refreshToken',
  '*.accessToken',
  '*.jwt',
  '*.secret',
];

export function buildLoggerConfig(options: BuildLoggerConfigOptions): Params {
  const { serviceName, nodeEnv, logLevel } = options;
  const isProd = nodeEnv === 'production';

  return {
    pinoHttp: {
      name: serviceName,
      level: logLevel,
      base: {
        service: serviceName,
        env: nodeEnv,
      },
      genReqId: (req: IncomingMessage, res: ServerResponse): string => {
        const existing =
          (req.headers[REQUEST_ID_HEADER] as string | undefined) ??
          (req.headers[CORRELATION_ID_HEADER] as string | undefined);
        const id = existing ?? randomUUID();
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },
      customProps: (req) => {
        const correlationId =
          (req.headers[CORRELATION_ID_HEADER] as string | undefined) ??
          ((req as { id?: string }).id ?? undefined);
        return correlationId ? { correlationId } : {};
      },
      serializers: {
        req: (req: {
          id: string;
          method: string;
          url: string;
          remoteAddress: string;
        }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res: { statusCode: number }) => ({
          statusCode: res.statusCode,
        }),
      },
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
      },
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,service,env',
              messageFormat: '[{service}] {msg}',
            },
          },
    },
  };
}
