import { HttpStatus } from '@nestjs/common';
import { BosException } from './base.exception';
import { ErrorCode } from './error-codes';

export class DatabaseException extends BosException {
  constructor(message: string, cause?: Error) {
    super({
      code: ErrorCode.DATABASE_ERROR,
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      cause,
    });
  }
}

export class RedisException extends BosException {
  constructor(message: string, cause?: Error) {
    super({
      code: ErrorCode.REDIS_ERROR,
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      cause,
    });
  }
}

export class QueueException extends BosException {
  constructor(message: string, cause?: Error) {
    super({
      code: ErrorCode.QUEUE_ERROR,
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      cause,
    });
  }
}

export class ExternalServiceException extends BosException {
  constructor(service: string, message: string, cause?: Error) {
    super({
      code: ErrorCode.EXTERNAL_SERVICE_ERROR,
      message: `External service '${service}' failed: ${message}`,
      statusCode: HttpStatus.BAD_GATEWAY,
      details: { service },
      cause,
    });
  }
}

export class RateLimitExceededException extends BosException {
  constructor(retryAfterSeconds?: number) {
    super({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      details: retryAfterSeconds ? { retryAfterSeconds } : undefined,
    });
  }
}
