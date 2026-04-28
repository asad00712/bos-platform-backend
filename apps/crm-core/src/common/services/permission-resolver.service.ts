import { Injectable, Logger } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { CorePrismaService, TenantPrismaService } from '@bos/database';
import type { IPermissionResolver } from '@bos/auth-client';

/**
 * Resolves tenant-scoped permissions for the PermissionsGuard.
 *
 * Strategy:
 *   1. Load the tenant's schemaName from the core DB (bos_core.public.tenants)
 *   2. Query UserBranchMembership in the tenant schema for the user's active role IDs
 *   3. Join RolePermission → Permission to get permission slugs
 *   4. Cache the result per userId+tenantId with a 60-second TTL (short enough
 *      to pick up role changes, long enough to survive a page's worth of requests)
 *
 * The cache is in-process only — a server restart or horizontal scale-out causes
 * a DB re-fetch, which is acceptable for permission data.
 */
@Injectable()
export class TenantPermissionResolverService implements IPermissionResolver {
  private readonly logger = new Logger(TenantPermissionResolverService.name);

  /** LRU cache: key = `${userId}:${tenantId}`, value = permission slug Set */
  private readonly cache = new LRUCache<string, Set<string>>({
    max: 1000,
    ttl: 60_000, // 60 seconds
  });

  constructor(
    private readonly corePrisma: CorePrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async resolve(userId: string, tenantId: string): Promise<Set<string>> {
    const cacheKey = `${userId}:${tenantId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const perms = await this.loadFromDb(userId, tenantId);
    this.cache.set(cacheKey, perms);
    return perms;
  }

  private async loadFromDb(userId: string, tenantId: string): Promise<Set<string>> {
    // 1. Get tenant schema name
    const tenant = await this.corePrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    if (!tenant) {
      this.logger.warn(`Permission resolution: tenant ${tenantId} not found`);
      return new Set();
    }

    // 2. Get active role IDs from tenant schema
    const prisma = this.tenantPrisma.forSchema(tenant.schemaName);
    const memberships = await prisma.userBranchMembership.findMany({
      where: { userId, revokedAt: null },
      select: { roleId: true },
    });
    if (memberships.length === 0) {
      return new Set();
    }

    // 3. Resolve permission slugs for those roles
    const roleIds = memberships.map((m) => m.roleId);
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: { select: { slug: true } } },
    });

    return new Set(rolePerms.map((rp) => rp.permission.slug));
  }
}
