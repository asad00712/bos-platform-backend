/**
 * Injection token for the optional permission resolver.
 * Register a provider under this token in any service that uses BosAuthClientModule
 * to enable live permission resolution from the database.
 *
 * @example
 *   // In AppModule:
 *   providers: [
 *     TenantPermissionResolverService,
 *     { provide: PERMISSION_RESOLVER, useExisting: TenantPermissionResolverService },
 *   ]
 */
export const PERMISSION_RESOLVER = Symbol('PERMISSION_RESOLVER');

/**
 * Resolves the effective permission slugs for a tenant-scoped user.
 * Implemented per-service (e.g. CRM Core queries UserBranchMembership → Role → Permission).
 */
export interface IPermissionResolver {
  /**
   * Returns all permission slugs the user holds in the given tenant.
   * Called at most once per request (result is cached on `request.user.permissions`).
   *
   * @param userId   - The authenticated user's ID
   * @param tenantId - The tenant they're operating within
   */
  resolve(userId: string, tenantId: string): Promise<Set<string>>;
}
