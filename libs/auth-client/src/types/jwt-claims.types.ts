import type { SessionScope } from '@bos/common';
import type { TenantId, UUIDv7, UserId } from '@bos/common';

/**
 * Discriminated union of JWT payloads BOS issues. The `scope` claim tells
 * consumers which shape to expect.
 */
export type BosJwtClaims =
  | TenantScopedJwtClaims
  | PlatformScopedJwtClaims
  | ImpersonationScopedJwtClaims
  | TwoFactorPendingClaims;

interface CommonJwtClaims {
  iss: 'bos-auth';
  aud: 'bos-platform';
  sub: UserId;
  sessionId: UUIDv7;
  jti: UUIDv7;
  iat: number;
  exp: number;
  /** Claims schema version — bump on breaking changes so validators can refuse old tokens. */
  v: 1;
}

export interface TenantScopedJwtClaims extends CommonJwtClaims {
  scope: SessionScope.TENANT;
  tenantId: TenantId;
  /** Currently-selected branch for multi-branch users; null = no branch picked. */
  activeBranchId: string | null;
  /** Every branch this user can access within the tenant (for scoping queries). */
  accessibleBranchIds: string[];
  /** True when user has a role assignment with branchId=NULL (owner/admin tier). */
  hasTenantWideAccess: boolean;
  /** Role slugs this user holds in the tenant (for nav + display). */
  roles: string[];
  type: 'access';
}

export interface PlatformScopedJwtClaims extends CommonJwtClaims {
  scope: SessionScope.PLATFORM;
  tenantId: null;
  platformRoles: string[];
  type: 'access';
}

export interface ImpersonationScopedJwtClaims extends CommonJwtClaims {
  scope: SessionScope.IMPERSONATION;
  /** The target tenant user — sub is set to this for auto-scoping of queries. */
  tenantId: TenantId;
  activeBranchId: string | null;
  accessibleBranchIds: string[];
  hasTenantWideAccess: boolean;
  roles: string[];
  /** The platform user performing the impersonation (audit marker). */
  impersonatedByUserId: UserId;
  impersonationReason: string;
  type: 'access';
}

/**
 * Short-lived token issued after successful password verification when 2FA
 * is enabled. Holder must submit this plus the TOTP code to complete login.
 */
export interface TwoFactorPendingClaims extends CommonJwtClaims {
  scope: 'two_factor_pending';
  type: '2fa_pending';
}
