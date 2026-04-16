import { HttpStatus } from '@nestjs/common';
import { BosException } from './base.exception';
import { ErrorCode } from './error-codes';

export class InsufficientPermissionsException extends BosException {
  constructor(required?: string | string[]) {
    super({
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      message: 'You do not have permission to perform this action',
      statusCode: HttpStatus.FORBIDDEN,
      details: required ? { required } : undefined,
    });
  }
}

export class ForbiddenResourceException extends BosException {
  constructor() {
    super({
      code: ErrorCode.FORBIDDEN_RESOURCE,
      message: 'Access to this resource is forbidden',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}

export class RoleNotFoundException extends BosException {
  constructor() {
    super({
      code: ErrorCode.ROLE_NOT_FOUND,
      message: 'Role not found',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class RoleInUseException extends BosException {
  constructor(userCount: number) {
    super({
      code: ErrorCode.ROLE_IN_USE,
      message: 'Role cannot be deleted while assigned to users',
      statusCode: HttpStatus.CONFLICT,
      details: { userCount },
    });
  }
}

export class CannotRemoveLastOwnerException extends BosException {
  constructor() {
    super({
      code: ErrorCode.CANNOT_REMOVE_LAST_OWNER,
      message: 'Cannot remove the last owner of a tenant',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
