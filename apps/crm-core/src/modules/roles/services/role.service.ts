import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CorePrismaService } from '@bos/database';
import { RoleInUseException } from '@bos/errors';
import { RoleRepository } from '../repositories/role.repository';
import type { CreateRoleDto } from '../dto/create-role.dto';
import type { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';
import type { RoleDto, PermissionDto, RoleListResponseDto } from '../dto/role.response.dto';

@Injectable()
export class RoleService {
  constructor(
    private readonly repository: RoleRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // List roles
  // ---------------------------------------------------------------------------

  async listRoles(tenantId: string): Promise<RoleListResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const data = await this.repository.findAll(schemaName);
    return { data, total: data.length };
  }

  // ---------------------------------------------------------------------------
  // List all permissions (for role-builder UI checkboxes)
  // ---------------------------------------------------------------------------

  async listPermissions(tenantId: string): Promise<PermissionDto[]> {
    const schemaName = await this.getSchemaName(tenantId);
    return this.repository.findAllPermissions(schemaName);
  }

  // ---------------------------------------------------------------------------
  // Get single role
  // ---------------------------------------------------------------------------

  async getRole(tenantId: string, roleId: string): Promise<RoleDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const role = await this.repository.findById(schemaName, roleId);
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    return role;
  }

  // ---------------------------------------------------------------------------
  // Create custom role
  // ---------------------------------------------------------------------------

  async createRole(tenantId: string, dto: CreateRoleDto): Promise<RoleDto> {
    const schemaName = await this.getSchemaName(tenantId);

    // Slug uniqueness check
    const existing = await this.repository.findBySlug(schemaName, dto.slug);
    if (existing) {
      throw new ConflictException(`Role slug '${dto.slug}' is already in use`);
    }

    // Validate all permission IDs exist
    if (dto.permissionIds?.length) {
      const allExist = await this.repository.permissionsExist(schemaName, dto.permissionIds);
      if (!allExist) {
        throw new NotFoundException(`One or more permission IDs not found`);
      }
    }

    return this.repository.create(schemaName, dto);
  }

  // ---------------------------------------------------------------------------
  // Update role permissions
  // ---------------------------------------------------------------------------

  async updateRolePermissions(
    tenantId: string,
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ): Promise<RoleDto> {
    const schemaName = await this.getSchemaName(tenantId);

    const role = await this.repository.findById(schemaName, roleId);
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    // System roles: owner and admin get all permissions — prevent manual override
    if (role.isSystem && ['owner', 'admin'].includes(role.slug)) {
      throw new ForbiddenException(
        `Cannot modify permissions for system role '${role.slug}' — it has full access by design`,
      );
    }

    // Validate permission IDs
    if (dto.permissionIds.length > 0) {
      const allExist = await this.repository.permissionsExist(schemaName, dto.permissionIds);
      if (!allExist) {
        throw new NotFoundException(`One or more permission IDs not found`);
      }
    }

    return this.repository.replacePermissions(schemaName, roleId, dto.permissionIds);
  }

  // ---------------------------------------------------------------------------
  // Delete custom role
  // ---------------------------------------------------------------------------

  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);

    const role = await this.repository.findById(schemaName, roleId);
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    // System roles (seeded on tenant provisioning) cannot be deleted
    if (role.isSystem) {
      throw new ForbiddenException(`System role '${role.slug}' cannot be deleted`);
    }

    // Role in use check
    const userCount = await this.repository.countUsersWithRole(schemaName, roleId);
    if (userCount > 0) {
      throw new RoleInUseException(userCount);
    }

    await this.repository.delete(schemaName, roleId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}
