import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser,
  RequirePermission,
  TenantScopeGuard,
  type TenantAuthenticatedUser,
} from '@bos/auth-client';
import { RoleService } from './services/role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import type { RoleDto, PermissionDto, RoleListResponseDto } from './dto/role.response.dto';

@ApiTags('Roles & Permissions')
@ApiBearerAuth('bearer')
@Controller('roles')
@UseGuards(ThrottlerGuard, TenantScopeGuard)
export class RolesController {
  constructor(private readonly roleService: RoleService) {}

  // GET /roles — list all roles (tenant + branch scoped)
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List all roles (system + custom)' })
  listRoles(
    @CurrentUser() user: TenantAuthenticatedUser,
  ): Promise<RoleListResponseDto> {
    return this.roleService.listRoles(user.tenantId);
  }

  // GET /roles/permissions — all available permissions (for role-builder UI)
  @Get('permissions')
  @HttpCode(200)
  @RequirePermission('tenant:users:manage_roles')
  @ApiOperation({ summary: 'List all available permissions for this tenant' })
  listPermissions(
    @CurrentUser() user: TenantAuthenticatedUser,
  ): Promise<PermissionDto[]> {
    return this.roleService.listPermissions(user.tenantId);
  }

  // GET /roles/:roleId
  @Get(':roleId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a single role with its permissions' })
  getRole(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<RoleDto> {
    return this.roleService.getRole(user.tenantId, roleId);
  }

  // POST /roles — create custom role
  @Post()
  @HttpCode(201)
  @RequirePermission('tenant:users:manage_roles')
  @ApiOperation({ summary: 'Create a custom role' })
  createRole(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleDto> {
    return this.roleService.createRole(user.tenantId, dto);
  }

  // PUT /roles/:roleId/permissions — replace permission set
  @Put(':roleId/permissions')
  @HttpCode(200)
  @RequirePermission('tenant:users:manage_roles')
  @ApiOperation({ summary: 'Replace all permissions for a role' })
  updateRolePermissions(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ): Promise<RoleDto> {
    return this.roleService.updateRolePermissions(user.tenantId, roleId, dto);
  }

  // DELETE /roles/:roleId — delete custom role
  @Delete(':roleId')
  @HttpCode(204)
  @RequirePermission('tenant:users:manage_roles')
  @ApiOperation({ summary: 'Delete a custom role (only if not in use)' })
  async deleteRole(
    @CurrentUser() user: TenantAuthenticatedUser,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    await this.roleService.deleteRole(user.tenantId, roleId);
  }
}
