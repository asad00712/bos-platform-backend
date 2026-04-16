import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-user.types';

/**
 * Param decorator that resolves to the currently-authenticated user
 * (attached by JwtAuthGuard). Throws clearly in development if accessed
 * on a public route where no user is attached.
 *
 * @example
 *   @Get('me')
 *   me(@CurrentUser() user: AuthenticatedUser) { return user; }
 *
 *   @Get('tenant-id')
 *   tenantId(@CurrentUser('scope') scope: SessionScope) { return scope; }
 */
export const CurrentUser = createParamDecorator(
  (
    property: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    if (property === undefined) {
      return user;
    }
    return user[property];
  },
);
