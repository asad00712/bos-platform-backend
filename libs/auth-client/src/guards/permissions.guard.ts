import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import type { Request } from 'express';
import { SessionScope } from '@bos/common';
import { InsufficientPermissionsException } from '@bos/errors';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { PLATFORM_ONLY_KEY } from '../decorators/platform-only.decorator';
import {
  PERMISSION_RESOLVER,
  type IPermissionResolver,
} from '../services/permission-resolver.interface';
import type { AuthenticatedUser, TenantAuthenticatedUser, ImpersonationAuthenticatedUser } from '../types/authenticated-user.types';

/**
 * Enforces permission-based and scope-based authorization.
 *
 * Runs AFTER JwtAuthGuard has attached `request.user`. Two checks:
 *
 *   1. @PlatformOnly() — rejects anything that isn't SessionScope.PLATFORM
 *   2. @RequirePermission(...) — rejects when user lacks ANY of the listed
 *      permission slugs (AND semantics)
 *
 * Uses ModuleRef.get(PERMISSION_RESOLVER, { strict: false }) to lazily look up
 * the resolver across the entire app context on first use. This avoids DI
 * scoping issues when the guard is registered as APP_GUARD in a different module
 * from where PERMISSION_RESOLVER is provided.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);
  private resolver: IPermissionResolver | null | undefined = undefined; // undefined = not yet looked up

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const platformOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      PLATFORM_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length && !platformOnly) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser }
    >();
    const user = request.user;
    if (!user) {
      throw new InsufficientPermissionsException(required);
    }

    if (platformOnly && user.scope !== SessionScope.PLATFORM) {
      throw new InsufficientPermissionsException();
    }

    if (required?.length) {
      // Lazily populate permissions from the DB resolver if the Set is empty
      // and the user is tenant-scoped and a resolver is wired in.
      if (
        user.permissions.size === 0 &&
        (user.scope === SessionScope.TENANT || user.scope === SessionScope.IMPERSONATION)
      ) {
        const resolver = this.getResolver();
        if (resolver) {
          const tenantUser = user as TenantAuthenticatedUser | ImpersonationAuthenticatedUser;
          const resolved = await resolver.resolve(tenantUser.userId, tenantUser.tenantId);
          // Mutate in-place so subsequent guards/handlers see the same Set
          for (const perm of resolved) {
            user.permissions.add(perm);
          }
        }
      }

      const missing = required.filter((perm) => !user.permissions.has(perm));
      if (missing.length > 0) {
        throw new InsufficientPermissionsException(missing);
      }
    }

    return true;
  }

  /**
   * Lazily resolves PERMISSION_RESOLVER from the full app context on first use.
   * strict: false searches all modules, bypassing the scoping limitation that
   * would make @Optional() @Inject() return undefined when the provider lives
   * in a different module than where the guard was instantiated.
   *
   * Result is cached in-instance (null = confirmed absent, instance = present).
   */
  private getResolver(): IPermissionResolver | null {
    if (this.resolver === undefined) {
      try {
        this.resolver = this.moduleRef.get<IPermissionResolver>(PERMISSION_RESOLVER, { strict: false });
        this.logger.log(`Permission resolver found: ${this.resolver.constructor.name}`);
      } catch {
        this.resolver = null;
        this.logger.warn('No PERMISSION_RESOLVER registered — permission checks will always fail for tenant routes');
      }
    }
    return this.resolver;
  }
}
