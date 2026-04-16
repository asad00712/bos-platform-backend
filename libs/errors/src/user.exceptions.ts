import { HttpStatus } from '@nestjs/common';
import { BosException } from './base.exception';
import { ErrorCode } from './error-codes';

export class UserNotFoundException extends BosException {
  constructor() {
    super({
      code: ErrorCode.USER_NOT_FOUND,
      message: 'User not found',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class UserAlreadyExistsException extends BosException {
  constructor() {
    super({
      code: ErrorCode.USER_ALREADY_EXISTS,
      message: 'A user with this email already exists',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class UserInactiveException extends BosException {
  constructor() {
    super({
      code: ErrorCode.USER_INACTIVE,
      message: 'User account is not active',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}

export class UserSuspendedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.USER_SUSPENDED,
      message: 'User account has been suspended',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}
