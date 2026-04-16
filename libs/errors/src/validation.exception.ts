import { HttpStatus } from '@nestjs/common';
import { BosException } from './base.exception';
import { ErrorCode } from './error-codes';

export class ValidationFailedException extends BosException {
  constructor(errors: Record<string, string[]> | string[]) {
    super({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Validation failed',
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      details: { errors },
    });
  }
}

export class InvalidInputException extends BosException {
  constructor(message: string, field?: string) {
    super({
      code: ErrorCode.INVALID_INPUT,
      message,
      statusCode: HttpStatus.BAD_REQUEST,
      details: field ? { field } : undefined,
    });
  }
}
