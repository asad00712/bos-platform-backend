import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '@bos/common';

/**
 * Standard success response envelope. Every endpoint returns this shape
 * (or a specialised wrapper). Errors use the shape produced by
 * AllExceptionsFilter and NEVER go through this interceptor.
 */
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta: {
    requestId?: string;
    timestamp: string;
  };
}

/**
 * Wraps every controller return value (except streams / binary responses /
 * pre-wrapped payloads) in a consistent success envelope:
 *
 *     { success: true, data, meta: { requestId, timestamp } }
 *
 * Applied globally from BosSecurityModule.forRoot().
 *
 * Opt-out markers:
 *  - controller returns `StreamableFile` (binary)
 *  - controller's response value has the shape `{ success, data }` already
 *  - response is already flushed (e.g., redirects) — detected via res.headersSent
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data: T) => {
        if (data instanceof StreamableFile) {
          return data;
        }
        if (response.headersSent) {
          return data;
        }
        if (isAlreadyEnveloped(data)) {
          return data;
        }
        const envelope: ApiSuccessEnvelope<T> = {
          success: true,
          data,
          meta: {
            requestId:
              (request.headers[REQUEST_ID_HEADER] as string | undefined) ??
              (request as { requestId?: string }).requestId,
            timestamp: new Date().toISOString(),
          },
        };
        return envelope;
      }),
    );
  }
}

function isAlreadyEnveloped(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in (value as Record<string, unknown>) &&
    'data' in (value as Record<string, unknown>)
  );
}
