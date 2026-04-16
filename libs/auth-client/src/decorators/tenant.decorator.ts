import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { SessionScope, type TenantId } from '@bos/common';
import type { AuthenticatedUser } from '../types/authenticated-user.types';

/**
 * Param decorator that extracts the tenantId from the authenticated user's
 * JWT. Returns null when the caller is a platform-scoped user — platform
 * endpoints should not depend on this decorator.
 *
 * @example
 *   @Get('contacts')
 *   list(@Tenant() tenantId: TenantId) { ... }
 */
export const Tenant = createParamDecorator(
  (_unused: unknown, ctx: ExecutionContext): TenantId | null => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return null;
    }
    if (user.scope === SessionScope.PLATFORM) {
      return null;
    }
    return user.tenantId;
  },
);
