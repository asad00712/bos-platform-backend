import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key read by PermissionsGuard to enforce RBAC on a route.
 * Each element is a permission slug (`<scope>:<resource>:<action>`).
 */
export const REQUIRED_PERMISSIONS_KEY = 'bos:auth:requiredPermissions';

/**
 * Declares one or more permission slugs required to invoke the route.
 * User must possess ALL listed permissions (logical AND).
 *
 * @example
 *   @Post()
 *   @RequirePermission('tenant:contacts:create')
 *   create(@Body() dto: CreateContactDto) { ... }
 *
 *   @Delete(':id')
 *   @RequirePermission('tenant:contacts:delete', 'tenant:contacts:view_all')
 *   remove(@Param('id') id: string) { ... }
 */
export const RequirePermission = (
  ...permissions: string[]
): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
