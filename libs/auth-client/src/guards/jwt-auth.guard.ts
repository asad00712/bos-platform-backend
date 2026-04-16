import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  AUTH_HEADER,
  BEARER_PREFIX,
  SessionScope,
} from '@bos/common';
import {
  InvalidTokenException,
  TokenRevokedException,
} from '@bos/errors';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtVerifierService } from '../services/jwt-verifier.service';
import { TokenRevocationService } from '../services/token-revocation.service';
import type {
  AuthenticatedUser,
  PlatformAuthenticatedUser,
  TenantAuthenticatedUser,
  ImpersonationAuthenticatedUser,
} from '../types/authenticated-user.types';
import type { BosJwtClaims } from '../types/jwt-claims.types';

/**
 * Global authentication guard. Applied to every route by default; routes
 * marked `@Public()` are allowed through without a token.
 *
 * Flow:
 *   1. Skip if route is `@Public()`
 *   2. Extract Bearer token from Authorization header
 *   3. Verify signature/expiry via JwtVerifierService
 *   4. Check Redis revocation list via TokenRevocationService
 *   5. Attach typed `AuthenticatedUser` to `request.user`
 *
 * Permissions are NOT enforced here — see PermissionsGuard for that.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifierService,
    private readonly revocation: TokenRevocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser }
    >();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new InvalidTokenException('Missing bearer token');
    }

    const claims = await this.verifier.verify(token);

    const revoked = await this.revocation.isRevoked(claims.jti);
    if (revoked) {
      throw new TokenRevokedException();
    }

    request.user = this.toAuthenticatedUser(claims);
    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers[AUTH_HEADER];
    if (typeof header !== 'string' || !header.startsWith(BEARER_PREFIX)) {
      return null;
    }
    const token = header.slice(BEARER_PREFIX.length).trim();
    return token.length > 0 ? token : null;
  }

  private toAuthenticatedUser(claims: BosJwtClaims): AuthenticatedUser {
    // Permissions enum resolution happens lazily — PermissionsGuard will
    // populate the Set when a route actually checks one.
    const basePermissions = new Set<string>();

    switch (claims.scope) {
      case SessionScope.TENANT: {
        const user: TenantAuthenticatedUser = {
          scope: SessionScope.TENANT,
          userId: claims.sub,
          sessionId: claims.sessionId,
          jti: claims.jti,
          tenantId: claims.tenantId,
          activeBranchId: claims.activeBranchId,
          accessibleBranchIds: claims.accessibleBranchIds,
          hasTenantWideAccess: claims.hasTenantWideAccess,
          roles: claims.roles,
          permissions: basePermissions,
        };
        return user;
      }
      case SessionScope.PLATFORM: {
        const user: PlatformAuthenticatedUser = {
          scope: SessionScope.PLATFORM,
          userId: claims.sub,
          sessionId: claims.sessionId,
          jti: claims.jti,
          platformRoles: claims.platformRoles,
          permissions: basePermissions,
        };
        return user;
      }
      case SessionScope.IMPERSONATION: {
        const user: ImpersonationAuthenticatedUser = {
          scope: SessionScope.IMPERSONATION,
          userId: claims.sub,
          sessionId: claims.sessionId,
          jti: claims.jti,
          tenantId: claims.tenantId,
          activeBranchId: claims.activeBranchId,
          accessibleBranchIds: claims.accessibleBranchIds,
          hasTenantWideAccess: claims.hasTenantWideAccess,
          roles: claims.roles,
          impersonatedByUserId: claims.impersonatedByUserId,
          impersonationReason: claims.impersonationReason,
          permissions: basePermissions,
        };
        return user;
      }
      default:
        throw new InvalidTokenException(`Unsupported scope in JWT`);
    }
  }
}
