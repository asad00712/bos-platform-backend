import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '@bos/database';
import type { RoleDto, PermissionDto } from '../dto/role.response.dto';
import type { CreateRoleDto } from '../dto/create-role.dto';

@Injectable()
export class RoleRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // ---------------------------------------------------------------------------
  // List all roles
  // ---------------------------------------------------------------------------

  async findAll(schemaName: string): Promise<RoleDto[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { scopeType: 'asc' }, { name: 'asc' }],
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
    return roles.map(this.toDto);
  }

  // ---------------------------------------------------------------------------
  // List all permissions (for role builder UI)
  // ---------------------------------------------------------------------------

  async findAllPermissions(schemaName: string): Promise<PermissionDto[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const perms = await prisma.permission.findMany({
      orderBy: [{ scope: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    });
    return perms.map((p) => ({
      id: p.id,
      slug: p.slug,
      scope: p.scope,
      resource: p.resource,
      action: p.action,
      description: p.description,
      isSystem: p.isSystem,
    }));
  }

  // ---------------------------------------------------------------------------
  // Single role
  // ---------------------------------------------------------------------------

  async findById(schemaName: string, roleId: string): Promise<RoleDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    return role ? this.toDto(role) : null;
  }

  async findBySlug(schemaName: string, slug: string): Promise<RoleDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const role = await prisma.role.findUnique({
      where: { slug },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    return role ? this.toDto(role) : null;
  }

  // ---------------------------------------------------------------------------
  // Create custom role
  // ---------------------------------------------------------------------------

  async create(schemaName: string, dto: CreateRoleDto): Promise<RoleDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const role = await prisma.role.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        scopeType: dto.scopeType,
        isSystem: false,
        rolePermissions: dto.permissionIds?.length
          ? {
              createMany: {
                data: dto.permissionIds.map((permId) => ({ permissionId: permId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    return this.toDto(role);
  }

  // ---------------------------------------------------------------------------
  // Replace permissions (full replace, not patch)
  // ---------------------------------------------------------------------------

  async replacePermissions(
    schemaName: string,
    roleId: string,
    permissionIds: string[],
  ): Promise<RoleDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const role = await prisma.$transaction(async (tx) => {
      // Delete all existing assignments
      await tx.rolePermission.deleteMany({ where: { roleId } });

      // Create new ones
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permId) => ({ roleId, permissionId: permId })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
    return this.toDto(role);
  }

  // ---------------------------------------------------------------------------
  // Delete custom role
  // ---------------------------------------------------------------------------

  async delete(schemaName: string, roleId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.role.delete({ where: { id: roleId } });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async countUsersWithRole(schemaName: string, roleId: string): Promise<number> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    return prisma.userBranchMembership.count({
      where: { roleId, revokedAt: null },
    });
  }

  async permissionsExist(schemaName: string, permissionIds: string[]): Promise<boolean> {
    if (permissionIds.length === 0) return true;
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const count = await prisma.permission.count({
      where: { id: { in: permissionIds } },
    });
    return count === permissionIds.length;
  }

  // ---------------------------------------------------------------------------
  // Private mapper
  // ---------------------------------------------------------------------------

  private toDto(role: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    scopeType: string;
    isSystem: boolean;
    verticalSlug: string | null;
    createdAt: Date;
    rolePermissions: {
      permission: {
        id: string;
        slug: string;
        scope: string;
        resource: string;
        action: string;
        description: string;
        isSystem: boolean;
      };
    }[];
  }): RoleDto {
    return {
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      scopeType: role.scopeType,
      isSystem: role.isSystem,
      verticalSlug: role.verticalSlug,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        slug: rp.permission.slug,
        scope: rp.permission.scope,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
        isSystem: rp.permission.isSystem,
      })),
      createdAt: role.createdAt,
    };
  }
}
