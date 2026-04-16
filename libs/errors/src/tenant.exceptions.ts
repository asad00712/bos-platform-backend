import { HttpStatus } from '@nestjs/common';
import { BosException } from './base.exception';
import { ErrorCode } from './error-codes';

export class TenantNotFoundException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TENANT_NOT_FOUND,
      message: 'Tenant not found',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class TenantSuspendedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TENANT_SUSPENDED,
      message: 'Tenant has been suspended',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}

export class TenantProvisioningFailedException extends BosException {
  constructor(reason?: string) {
    super({
      code: ErrorCode.TENANT_PROVISIONING_FAILED,
      message: 'Tenant provisioning failed',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      details: reason ? { reason } : undefined,
    });
  }
}

export class TenantNameTakenException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TENANT_NAME_TAKEN,
      message: 'Tenant name is already taken',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class TenantSlugTakenException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TENANT_SLUG_TAKEN,
      message: 'Tenant slug is already taken',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
