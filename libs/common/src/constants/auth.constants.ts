export const AUTH_HEADER = 'authorization';
export const BEARER_PREFIX = 'Bearer ';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

export const JWT_TYPE_ACCESS = 'access';
export const JWT_TYPE_TEMP_2FA = '2fa_pending';
export const JWT_TYPE_IMPERSONATION = 'impersonation';

export const REDIS_KEY_PREFIX = {
  REVOKED_JTI: 'revoked:jti:',
  LOCKOUT: 'lockout:',
  EMAIL_VERIFY: 'verify:email:',
  PASSWORD_RESET: 'reset:pwd:',
  TWOFA_SETUP: 'tmp:2fa:',
  TWOFA_ATTEMPTS: 'attempts:2fa:',
  SESSION_CACHE: 'session:',
  PERMISSIONS_CACHE: 'perms:',
} as const;
