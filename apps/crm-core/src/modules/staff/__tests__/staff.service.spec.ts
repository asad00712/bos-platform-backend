import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CannotRemoveLastOwnerException, RoleNotFoundException } from '@bos/errors';
import { StaffService } from '../services/staff.service';
import type { StaffRepository } from '../repositories/staff.repository';
import type { InviteStaffDto } from '../dto/invite-staff.dto';
import type { UpdateStaffRoleDto } from '../dto/update-staff-role.dto';

// ---------------------------------------------------------------------------
// Mock fixtures
// ---------------------------------------------------------------------------

const TENANT_ID   = 'tenant-uuid-001';
const USER_ID     = 'user-uuid-001';
const TARGET_ID   = 'user-uuid-002';
const SCHEMA_NAME = 'tenant_aabbcc1122334455';

const mockStaffMember = {
  userId: TARGET_ID,
  email: 'ali@clinic.com',
  firstName: 'Ali',
  lastName: 'Khan',
  avatarUrl: null,
  phone: null,
  membershipStatus: 'active',
  joinedAt: new Date('2024-01-10'),
  roles: [
    {
      membershipId: 'mbr-001',
      roleId: 'role-001',
      roleSlug: 'staff',
      roleName: 'Staff',
      branchId: 'branch-001',
      branchName: 'Main Branch',
      assignedAt: new Date('2024-01-10'),
    },
  ],
};

const mockRepository: jest.Mocked<StaffRepository> = {
  findAll:              jest.fn(),
  findById:             jest.fn(),
  findPendingInvites:   jest.fn(),
  createInvite:         jest.fn(),
  revokeInvite:         jest.fn(),
  updateRoleAssignment: jest.fn(),
  deactivateStaff:      jest.fn(),
  getTenantSchemaName:  jest.fn(),
  isOwner:              jest.fn(),
} as unknown as jest.Mocked<StaffRepository>;

const mockCorePrisma = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  tenant: {
    findUniqueOrThrow: jest.fn(),
  },
  tenantMembership: {
    findUnique: jest.fn(),
  },
};

const mockTenantPrisma = {
  forSchema: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('http://localhost:3000'),
} as unknown as ConfigService;

const mockMailQueue = {
  add: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('StaffService', () => {
  let service: StaffService;

  // Tenant schema prisma mock (returned from forSchema)
  const mockTenantSchemaPrisma = {
    role: { findUnique: jest.fn() },
    userBranchMembership: { count: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.getTenantSchemaName.mockResolvedValue(SCHEMA_NAME);
    mockTenantPrisma.forSchema.mockReturnValue(mockTenantSchemaPrisma);

    service = new StaffService(
      mockRepository as unknown as ConstructorParameters<typeof StaffService>[0],
      mockCorePrisma as unknown as ConstructorParameters<typeof StaffService>[1],
      mockTenantPrisma as unknown as ConstructorParameters<typeof StaffService>[2],
      mockConfig,
      mockMailQueue as unknown as ConstructorParameters<typeof StaffService>[4],
    );
  });

  // -------------------------------------------------------------------------
  // listStaff
  // -------------------------------------------------------------------------

  describe('listStaff', () => {
    it('returns paginated staff list from repository', async () => {
      mockRepository.findAll.mockResolvedValueOnce({ data: [mockStaffMember], total: 1 });

      const result = await service.listStaff(TENANT_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockRepository.getTenantSchemaName).toHaveBeenCalledWith(TENANT_ID);
    });

    it('forwards schema name to repository', async () => {
      mockRepository.findAll.mockResolvedValueOnce({ data: [], total: 0 });

      await service.listStaff(TENANT_ID, { page: 2, limit: 10 });

      expect(mockRepository.findAll).toHaveBeenCalledWith(TENANT_ID, {
        schemaName: SCHEMA_NAME,
        page: 2,
        limit: 10,
      });
    });
  });

  // -------------------------------------------------------------------------
  // getStaffMember
  // -------------------------------------------------------------------------

  describe('getStaffMember', () => {
    it('returns the staff member when found', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockStaffMember);

      const result = await service.getStaffMember(TARGET_ID, TENANT_ID);

      expect(result.userId).toBe(TARGET_ID);
      expect(result.roles).toHaveLength(1);
    });

    it('throws NotFoundException when user is not a member', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getStaffMember(TARGET_ID, TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // inviteStaff
  // -------------------------------------------------------------------------

  describe('inviteStaff', () => {
    const dto: InviteStaffDto = {
      email: 'newstaff@clinic.com',
      firstName: 'Sara',
      roleId: 'role-001',
    };

    beforeEach(() => {
      mockTenantSchemaPrisma.role.findUnique.mockResolvedValue({ id: 'role-001', name: 'Staff' });
      mockCorePrisma.user.findUnique.mockResolvedValue(null); // new user
      mockCorePrisma.tenant.findUniqueOrThrow.mockResolvedValue({ name: 'Acme Clinic' });
      mockCorePrisma.user.findUniqueOrThrow.mockResolvedValue({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@clinic.com',
      });
      mockRepository.createInvite.mockResolvedValue('invite-001');
    });

    it('creates invite and queues email for a new user', async () => {
      await service.inviteStaff(TENANT_ID, USER_ID, dto);

      expect(mockRepository.createInvite).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newstaff@clinic.com',
          firstName: 'Sara',
          tenantId: TENANT_ID,
          roleId: 'role-001',
          invitedByUserId: USER_ID,
        }),
      );
      expect(mockMailQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          recipientEmail: 'newstaff@clinic.com',
          tenantId: TENANT_ID,
        }),
      );
    });

    it('throws RoleNotFoundException when role does not exist', async () => {
      mockTenantSchemaPrisma.role.findUnique.mockResolvedValueOnce(null);

      await expect(service.inviteStaff(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        RoleNotFoundException,
      );
      expect(mockRepository.createInvite).not.toHaveBeenCalled();
    });

    it('throws ConflictException when user is already an active member', async () => {
      mockCorePrisma.user.findUnique.mockResolvedValueOnce({ id: TARGET_ID });
      mockCorePrisma.tenantMembership.findUnique.mockResolvedValueOnce({ status: 'active' });

      await expect(service.inviteStaff(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepository.createInvite).not.toHaveBeenCalled();
    });

    it('does not throw when user exists but has no active membership', async () => {
      mockCorePrisma.user.findUnique.mockResolvedValueOnce({ id: TARGET_ID });
      mockCorePrisma.tenantMembership.findUnique.mockResolvedValueOnce({ status: 'invited' });

      await expect(service.inviteStaff(TENANT_ID, USER_ID, dto)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // updateStaffRole
  // -------------------------------------------------------------------------

  describe('updateStaffRole', () => {
    const dto: UpdateStaffRoleDto = { roleId: 'role-002' };

    beforeEach(() => {
      mockTenantSchemaPrisma.role.findUnique.mockResolvedValue({ id: 'role-002' });
      mockRepository.isOwner.mockResolvedValue(false);
      mockRepository.updateRoleAssignment.mockResolvedValue(undefined);
    });

    it('updates the role assignment', async () => {
      await service.updateStaffRole(TARGET_ID, TENANT_ID, USER_ID, dto);

      expect(mockRepository.updateRoleAssignment).toHaveBeenCalledWith(
        TARGET_ID,
        SCHEMA_NAME,
        USER_ID,
        'role-002',
        undefined,
      );
    });

    it('throws RoleNotFoundException when role does not exist', async () => {
      mockTenantSchemaPrisma.role.findUnique.mockResolvedValueOnce(null);

      await expect(service.updateStaffRole(TARGET_ID, TENANT_ID, USER_ID, dto)).rejects.toThrow(
        RoleNotFoundException,
      );
    });

    it('throws CannotRemoveLastOwnerException when demoting the only owner', async () => {
      mockRepository.isOwner.mockResolvedValueOnce(true);
      mockTenantSchemaPrisma.userBranchMembership = { count: jest.fn().mockResolvedValue(1) } as unknown as typeof mockTenantSchemaPrisma.userBranchMembership;

      await expect(service.updateStaffRole(TARGET_ID, TENANT_ID, USER_ID, dto)).rejects.toThrow(
        CannotRemoveLastOwnerException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // deactivateStaff
  // -------------------------------------------------------------------------

  describe('deactivateStaff', () => {
    beforeEach(() => {
      mockRepository.isOwner.mockResolvedValue(false);
      mockRepository.deactivateStaff.mockResolvedValue(undefined);
    });

    it('deactivates a non-owner staff member', async () => {
      await service.deactivateStaff(TARGET_ID, TENANT_ID, USER_ID);

      expect(mockRepository.deactivateStaff).toHaveBeenCalledWith(
        TARGET_ID,
        TENANT_ID,
        SCHEMA_NAME,
        USER_ID,
      );
    });

    it('throws CannotRemoveLastOwnerException when deactivating the only owner', async () => {
      mockRepository.isOwner.mockResolvedValueOnce(true);
      mockTenantSchemaPrisma.userBranchMembership = { count: jest.fn().mockResolvedValue(1) } as unknown as typeof mockTenantSchemaPrisma.userBranchMembership;

      await expect(service.deactivateStaff(TARGET_ID, TENANT_ID, USER_ID)).rejects.toThrow(
        CannotRemoveLastOwnerException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // revokeInvite
  // -------------------------------------------------------------------------

  describe('revokeInvite', () => {
    it('revokes a pending invite', async () => {
      mockRepository.revokeInvite.mockResolvedValueOnce(true);

      await expect(service.revokeInvite('invite-001', TENANT_ID)).resolves.toBeUndefined();
      expect(mockRepository.revokeInvite).toHaveBeenCalledWith('invite-001', TENANT_ID);
    });

    it('throws NotFoundException when invite is not found', async () => {
      mockRepository.revokeInvite.mockResolvedValueOnce(false);

      await expect(service.revokeInvite('invite-ghost', TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
