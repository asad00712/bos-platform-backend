import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { BosException, ErrorCode } from '@bos/errors';
import { REQUEST_ID_HEADER } from '@bos/common';

interface ErrorResponseBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProd: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, body } = this.buildErrorResponse(exception, request);

    if (statusCode >= 500) {
      this.logger.error(
        `[${body.code}] ${body.message} | ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json(body);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): { statusCode: number; body: ErrorResponseBody } {
    const requestId =
      (request.headers[REQUEST_ID_HEADER] as string | undefined) ??
      (request as { id?: string }).id;
    const base = {
      requestId,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof BosException) {
      const res = exception.getResponse();
      const payload = typeof res === 'object' && res !== null ? res : {};
      return {
        statusCode: exception.getStatus(),
        body: {
          code: exception.code,
          message: (payload as { message?: string }).message ?? exception.message,
          details: exception.details,
          ...base,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        body: {
          code: this.mapHttpStatusToCode(status),
          message: Array.isArray(message) ? message.join('; ') : message,
          details:
            typeof res === 'object' && res !== null
              ? (res as Record<string, unknown>)
              : undefined,
          ...base,
        },
      };
    }

    const errorMessage = this.isProd
      ? 'Internal server error'
      : exception instanceof Error
        ? exception.message
        : 'Unknown error';

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: ErrorCode.INTERNAL_ERROR,
        message: errorMessage,
        ...base,
      },
    };
  }

  private mapHttpStatusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'HTTP_400_BAD_REQUEST',
      401: 'HTTP_401_UNAUTHORIZED',
      403: 'HTTP_403_FORBIDDEN',
      404: 'HTTP_404_NOT_FOUND',
      409: 'HTTP_409_CONFLICT',
      422: 'HTTP_422_UNPROCESSABLE_ENTITY',
      429: 'HTTP_429_TOO_MANY_REQUESTS',
    };
    return map[status] ?? `HTTP_${status}`;
  }
}
