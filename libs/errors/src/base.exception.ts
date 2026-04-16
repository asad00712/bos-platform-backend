import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

export interface BosExceptionOptions {
  code: ErrorCode;
  message: string;
  statusCode?: HttpStatus;
  details?: Record<string, unknown>;
  cause?: Error;
}

export class BosException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(options: BosExceptionOptions) {
    const statusCode = options.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
    super(
      {
        code: options.code,
        message: options.message,
        details: options.details,
      },
      statusCode,
      { cause: options.cause },
    );
    this.code = options.code;
    this.details = options.details;
  }
}
