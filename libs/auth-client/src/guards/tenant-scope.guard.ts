import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionScope } from '@bos/common';
import { InsufficientPermissionsException } from '@bos/errors';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.types';

/**
 * Enforces that only tenant-scoped or impersonation-scoped JWTs can reach
 * tenant-specific endpoints.
 *
 * Register as an APP_GUARD in any service whose routes are tenant-scoped
 * (e.g. crm-core). It runs after JwtAuthGuard (which attaches request.user)
 * and rejects platform-scoped tokens before they can reach handlers that
 * call getSchemaName(tenantId) or any other tenant-context operation.
 *
 * Public routes (@Public()) are skipped.
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const user = request.user;
    if (!user) {
      // JwtAuthGuard should have rejected this already; be defensive.
      throw new InsufficientPermissionsException();
    }

    if (
      user.scope !== SessionScope.TENANT &&
      user.scope !== SessionScope.IMPERSONATION
    ) {
      throw new InsufficientPermissionsException();
    }

    return true;
  }
}
