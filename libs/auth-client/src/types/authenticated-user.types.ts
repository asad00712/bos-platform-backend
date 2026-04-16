import type { SessionScope } from '@bos/common';
import type { TenantId, UUIDv7, UserId } from '@bos/common';

/**
 * Request-scoped representation of the currently-authenticated principal.
 * Attached to `request.user` by JwtAuthGuard after validating the token
 * and consulted by decorators (@CurrentUser, @Tenant, @ActiveBranch)
 * and permission guards.
 */
export type AuthenticatedUser =
  | TenantAuthenticatedUser
  | PlatformAuthenticatedUser
  | ImpersonationAuthenticatedUser;

interface CommonAuthenticatedUser {
  userId: UserId;
  sessionId: UUIDv7;
  jti: UUIDv7;
  /** Effective permissions resolved server-side (union across roles). */
  permissions: Set<string>;
}

export interface TenantAuthenticatedUser extends CommonAuthenticatedUser {
  scope: SessionScope.TENANT;
  tenantId: TenantId;
  activeBranchId: string | null;
  accessibleBranchIds: string[];
  hasTenantWideAccess: boolean;
  roles: string[];
}

export interface PlatformAuthenticatedUser extends CommonAuthenticatedUser {
  scope: SessionScope.PLATFORM;
  platformRoles: string[];
}

export interface ImpersonationAuthenticatedUser extends CommonAuthenticatedUser {
  scope: SessionScope.IMPERSONATION;
  tenantId: TenantId;
  activeBranchId: string | null;
  accessibleBranchIds: string[];
  hasTenantWideAccess: boolean;
  roles: string[];
  impersonatedByUserId: UserId;
  impersonationReason: string;
}
