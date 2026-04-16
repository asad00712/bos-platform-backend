import { HttpStatus } from '@nestjs/common';
import { BosException } from './base.exception';
import { ErrorCode } from './error-codes';

export class InvalidCredentialsException extends BosException {
  constructor() {
    super({
      code: ErrorCode.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class AccountLockedException extends BosException {
  constructor(unlockAt?: Date) {
    super({
      code: ErrorCode.ACCOUNT_LOCKED,
      message: 'Account is locked due to too many failed login attempts',
      statusCode: HttpStatus.LOCKED,
      details: unlockAt ? { unlockAt: unlockAt.toISOString() } : undefined,
    });
  }
}

export class EmailNotVerifiedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.EMAIL_NOT_VERIFIED,
      message: 'Email address has not been verified',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}

export class TwoFactorRequiredException extends BosException {
  constructor(tempToken: string) {
    super({
      code: ErrorCode.TWO_FACTOR_REQUIRED,
      message: 'Two-factor authentication is required',
      statusCode: HttpStatus.OK,
      details: { tempToken, requires2FA: true },
    });
  }
}

export class TwoFactorInvalidException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TWO_FACTOR_INVALID,
      message: 'Invalid two-factor authentication code',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class InvalidTokenException extends BosException {
  constructor(detail?: string) {
    super({
      code: ErrorCode.INVALID_TOKEN,
      message: detail ?? 'Invalid authentication token',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class TokenExpiredException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TOKEN_EXPIRED,
      message: 'Authentication token has expired',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class TokenRevokedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TOKEN_REVOKED,
      message: 'Authentication token has been revoked',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class TokenReuseDetectedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TOKEN_REUSE_DETECTED,
      message: 'Refresh token reuse detected; session terminated for security',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class RefreshTokenInvalidException extends BosException {
  constructor() {
    super({
      code: ErrorCode.REFRESH_TOKEN_INVALID,
      message: 'Refresh token is invalid or expired',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class SessionNotFoundException extends BosException {
  constructor() {
    super({
      code: ErrorCode.SESSION_NOT_FOUND,
      message: 'Session not found or expired',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class InvalidInviteException extends BosException {
  constructor() {
    super({
      code: ErrorCode.INVALID_INVITE,
      message: 'Invitation token is invalid',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class InviteExpiredException extends BosException {
  constructor() {
    super({
      code: ErrorCode.INVITE_EXPIRED,
      message: 'Invitation has expired',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class InviteAlreadyUsedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.INVITE_ALREADY_USED,
      message: 'Invitation has already been accepted',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class PasswordResetInvalidException extends BosException {
  constructor() {
    super({
      code: ErrorCode.PASSWORD_RESET_INVALID,
      message: 'Password reset token is invalid',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class PasswordResetExpiredException extends BosException {
  constructor() {
    super({
      code: ErrorCode.PASSWORD_RESET_EXPIRED,
      message: 'Password reset token has expired',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class PasswordTooWeakException extends BosException {
  constructor(requirements?: string[]) {
    super({
      code: ErrorCode.PASSWORD_TOO_WEAK,
      message: 'Password does not meet security requirements',
      statusCode: HttpStatus.BAD_REQUEST,
      details: requirements ? { requirements } : undefined,
    });
  }
}

export class PasswordReusedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.PASSWORD_REUSED,
      message: 'Password cannot be one of your recent passwords',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class EmailVerifyInvalidException extends BosException {
  constructor() {
    super({
      code: ErrorCode.EMAIL_VERIFY_INVALID,
      message: 'Email verification token is invalid',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class EmailVerifyExpiredException extends BosException {
  constructor() {
    super({
      code: ErrorCode.EMAIL_VERIFY_EXPIRED,
      message: 'Email verification token has expired',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class SsoFailedException extends BosException {
  constructor(provider: string, reason?: string) {
    super({
      code: ErrorCode.SSO_FAILED,
      message: `SSO authentication with ${provider} failed`,
      statusCode: HttpStatus.UNAUTHORIZED,
      details: reason ? { reason } : undefined,
    });
  }
}

export class TwoFactorNotEnabledException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TWO_FACTOR_NOT_ENABLED,
      message: 'Two-factor authentication is not enabled',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class TwoFactorAlreadyEnabledException extends BosException {
  constructor() {
    super({
      code: ErrorCode.TWO_FACTOR_ALREADY_ENABLED,
      message: 'Two-factor authentication is already enabled',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class UserAlreadyVerifiedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.EMAIL_ALREADY_VERIFIED,
      message: 'Email address has already been verified',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class ImpersonationNotAllowedException extends BosException {
  constructor() {
    super({
      code: ErrorCode.IMPERSONATION_NOT_ALLOWED,
      message: 'Impersonation is not permitted for this action',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}

export class ImpersonationActionBlockedException extends BosException {
  constructor(action: string) {
    super({
      code: ErrorCode.IMPERSONATION_ACTION_BLOCKED,
      message: `Action '${action}' is blocked during impersonation`,
      statusCode: HttpStatus.FORBIDDEN,
      details: { action },
    });
  }
}
