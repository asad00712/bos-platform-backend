import { SetMetadata } from '@nestjs/common';

/**
 * Metadata flag for endpoints that require `scope=platform` JWTs only.
 * Enforced by PermissionsGuard / PlatformGuard — tenant-scoped users are
 * rejected even if they have matching permissions.
 *
 * Use for super-admin-only endpoints under `/api/v1/platform/*`.
 */
export const PLATFORM_ONLY_KEY = 'bos:auth:platformOnly';

export const PlatformOnly = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(PLATFORM_ONLY_KEY, true);
