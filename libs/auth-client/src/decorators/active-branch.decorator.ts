import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { SessionScope } from '@bos/common';
import type { AuthenticatedUser } from '../types/authenticated-user.types';

/**
 * Param decorator that returns the currently-active branch ID for a
 * multi-branch tenant user. Null for platform users and for tenant-wide
 * (owner/admin) users who haven't selected a specific branch.
 *
 * Repositories that scope data to branches should use this together with
 * `user.accessibleBranchIds` + `user.hasTenantWideAccess`.
 */
export const ActiveBranch = createParamDecorator(
  (_unused: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || user.scope === SessionScope.PLATFORM) {
      return null;
    }
    return user.activeBranchId;
  },
);
