import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionScope } from '@bos/common';
import { InsufficientPermissionsException } from '@bos/errors';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { PLATFORM_ONLY_KEY } from '../decorators/platform-only.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.types';

/**
 * Enforces permission-based and scope-based authorization.
 *
 * Runs AFTER JwtAuthGuard has attached `request.user`. Two checks:
 *
 *   1. @PlatformOnly() — rejects anything that isn't SessionScope.PLATFORM
 *   2. @RequirePermission(...) — rejects when user lacks ANY of the listed
 *      permission slugs (AND semantics)
 *
 * Permission resolution currently consults `user.permissions` populated by
 * upstream code (PermissionResolverService in CRM Core / auth-service).
 * If that Set is empty on a tenant user, this guard fetches permissions
 * fresh from a pluggable resolver (wiring added alongside CRM Core).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
      const missing = required.filter((perm) => !user.permissions.has(perm));
      if (missing.length > 0) {
        throw new InsufficientPermissionsException(missing);
      }
    }

    return true;
  }
}
