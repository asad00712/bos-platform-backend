import { HttpStatus } from '@nestjs/common';
import { BosException } from './base.exception';
import { ErrorCode } from './error-codes';

export class CustomFieldNotFoundException extends BosException {
  constructor() {
    super({
      code: ErrorCode.CUSTOM_FIELD_NOT_FOUND,
      message: 'Custom field definition not found',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class CustomFieldKeyConflictException extends BosException {
  constructor(entityType: string, key: string) {
    super({
      code: ErrorCode.CUSTOM_FIELD_KEY_CONFLICT,
      message: `A custom field with key '${key}' already exists for entity type '${entityType}'`,
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
