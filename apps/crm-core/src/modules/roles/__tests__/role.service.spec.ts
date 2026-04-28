import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleInUseException } from '@bos/errors';
import { RoleService } from '../services/role.service';
import type { RoleRepository } from '../repositories/role.repository';
import type { CreateRoleDto } from '../dto/create-role.dto';
import { RoleScopeTypeDto } from '../dto/create-role.dto';
import type { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID   = 'tenant-uuid-001';
const ROLE_ID     = 'role-uuid-001';
const SCHEMA_NAME = 'tenant_aabbcc1122334455';

const mockCustomRole = {
  id: ROLE_ID,
  slug: 'senior-doctor',
  name: 'Senior Doctor',
  description: null,
  scopeType: 'branch',
  isSystem: false,
  verticalSlug: 'medical',
  permissions: [],
  createdAt: new Date('2024-01-01'),
};

const mockSystemOwner = {
  ...mockCustomRole,
  id: 'role-owner',
  slug: 'owner',
  isSystem: true,
  scopeType: 'tenant',
};

const mockRepository: jest.Mocked<RoleRepository> = {
  findAll:             jest.fn(),
  findAllPermissions:  jest.fn(),
  findById:            jest.fn(),
  findBySlug:          jest.fn(),
  create:              jest.fn(),
  replacePermissions:  jest.fn(),
  delete:              jest.fn(),
  countUsersWithRole:  jest.fn(),
  permissionsExist:    jest.fn(),
} as unknown as jest.Mocked<RoleRepository>;

const mockCorePrisma = {
  tenant: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({ schemaName: SCHEMA_NAME }),
  },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('RoleService', () => {
  let service: RoleService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockCorePrisma.tenant.findUniqueOrThrow.mockResolvedValue({ schemaName: SCHEMA_NAME });

    service = new RoleService(
      mockRepository as unknown as ConstructorParameters<typeof RoleService>[0],
      mockCorePrisma as unknown as ConstructorParameters<typeof RoleService>[1],
    );
  });

  // -------------------------------------------------------------------------
  // listRoles
  // -------------------------------------------------------------------------

  describe('listRoles', () => {
    it('returns all roles with total count', async () => {
      mockRepository.findAll.mockResolvedValueOnce([mockCustomRole, mockSystemOwner]);

      const result = await service.listRoles(TENANT_ID);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // getRole
  // -------------------------------------------------------------------------

  describe('getRole', () => {
    it('returns the role when found', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockCustomRole);

      const result = await service.getRole(TENANT_ID, ROLE_ID);

      expect(result.slug).toBe('senior-doctor');
    });

    it('throws NotFoundException when role does not exist', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getRole(TENANT_ID, ROLE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // createRole
  // -------------------------------------------------------------------------

  describe('createRole', () => {
    const dto: CreateRoleDto = {
      slug: 'senior-doctor',
      name: 'Senior Doctor',
      scopeType: RoleScopeTypeDto.BRANCH,
    };

    it('creates a custom role when slug is unique', async () => {
      mockRepository.findBySlug.mockResolvedValueOnce(null);
      mockRepository.permissionsExist.mockResolvedValueOnce(true);
      mockRepository.create.mockResolvedValueOnce(mockCustomRole);

      const result = await service.createRole(TENANT_ID, dto);

      expect(result.slug).toBe('senior-doctor');
      expect(mockRepository.create).toHaveBeenCalledWith(SCHEMA_NAME, dto);
    });

    it('throws ConflictException when slug already exists', async () => {
      mockRepository.findBySlug.mockResolvedValueOnce(mockCustomRole);

      await expect(service.createRole(TENANT_ID, dto)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a permissionId does not exist', async () => {
      mockRepository.findBySlug.mockResolvedValueOnce(null);
      mockRepository.permissionsExist.mockResolvedValueOnce(false);

      const dtoWithPerms: CreateRoleDto = { ...dto, permissionIds: ['bad-uuid'] };
      await expect(service.createRole(TENANT_ID, dtoWithPerms)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // updateRolePermissions
  // -------------------------------------------------------------------------

  describe('updateRolePermissions', () => {
    const dto: UpdateRolePermissionsDto = { permissionIds: ['perm-001'] };

    it('replaces permissions for a custom role', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockCustomRole);
      mockRepository.permissionsExist.mockResolvedValueOnce(true);
      mockRepository.replacePermissions.mockResolvedValueOnce({
        ...mockCustomRole,
        permissions: [{ id: 'perm-001', slug: 'tenant:contacts:create', scope: 'tenant', resource: 'contacts', action: 'create', description: 'Create contacts', isSystem: true }],
      });

      const result = await service.updateRolePermissions(TENANT_ID, ROLE_ID, dto);

      expect(result.permissions).toHaveLength(1);
    });

    it('throws ForbiddenException for owner role', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockSystemOwner);

      await expect(service.updateRolePermissions(TENANT_ID, ROLE_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when role does not exist', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.updateRolePermissions(TENANT_ID, ROLE_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteRole
  // -------------------------------------------------------------------------

  describe('deleteRole', () => {
    it('deletes a custom role with no active users', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockCustomRole);
      mockRepository.countUsersWithRole.mockResolvedValueOnce(0);
      mockRepository.delete.mockResolvedValueOnce(undefined);

      await expect(service.deleteRole(TENANT_ID, ROLE_ID)).resolves.toBeUndefined();
      expect(mockRepository.delete).toHaveBeenCalledWith(SCHEMA_NAME, ROLE_ID);
    });

    it('throws ForbiddenException for a system role', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockSystemOwner);

      await expect(service.deleteRole(TENANT_ID, ROLE_ID)).rejects.toThrow(ForbiddenException);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('throws RoleInUseException when users are assigned to the role', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockCustomRole);
      mockRepository.countUsersWithRole.mockResolvedValueOnce(3);

      await expect(service.deleteRole(TENANT_ID, ROLE_ID)).rejects.toThrow(RoleInUseException);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when role does not exist', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.deleteRole(TENANT_ID, ROLE_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
