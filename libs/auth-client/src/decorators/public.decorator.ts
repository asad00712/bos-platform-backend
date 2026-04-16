import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for publicly-accessible routes (no authentication required).
 * Read by `JwtAuthGuard` via `Reflector` to short-circuit authentication.
 */
export const IS_PUBLIC_KEY = 'bos:auth:isPublic';

/**
 * Marks a route (or whole controller) as public — JwtAuthGuard will skip
 * token validation. Use for signup, login, forgot-password, etc.
 *
 * @example
 *   @Public()
 *   @Post('login')
 *   async login(@Body() dto: LoginDto) { ... }
 */
export const Public = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(IS_PUBLIC_KEY, true);
