export enum SessionEndReason {
  LOGOUT = 'logout',
  EXPIRED = 'expired',
  REVOKED_BY_ADMIN = 'revoked_by_admin',
  PASSWORD_CHANGED = 'password_changed',
  TOKEN_REUSE_DETECTED = 'token_reuse_detected',
  USER_SUSPENDED = 'user_suspended',
  TENANT_SUSPENDED = 'tenant_suspended',
  IMPERSONATION_ENDED = 'impersonation_ended',
}
