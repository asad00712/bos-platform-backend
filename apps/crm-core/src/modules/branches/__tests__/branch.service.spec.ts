import { ConflictException, NotFoundException } from '@nestjs/common';
import { BranchService } from '../services/branch.service';
import type { BranchRepository } from '../repositories/branch.repository';
import type { CreateBranchDto } from '../dto/create-branch.dto';
import type { UpdateBranchDto } from '../dto/update-branch.dto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID   = 'tenant-uuid-001';
const BRANCH_ID   = 'branch-uuid-001';
const SCHEMA_NAME = 'tenant_aabbcc1122334455';

const mockBranch = {
  id: BRANCH_ID,
  name: 'Karachi Main Clinic',
  code: 'KHI-01',
  address: '123 Main St',
  city: 'Karachi',
  state: 'Sindh',
  country: 'Pakistan',
  postalCode: '75500',
  phone: '+92-21-1234567',
  email: 'khi@clinic.com',
  timezone: 'Asia/Karachi',
  parentBranchId: null,
  isHeadOffice: true,
  isActive: true,
  children: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockRepository: jest.Mocked<BranchRepository> = {
  findAll:            jest.fn(),
  findById:           jest.fn(),
  findByCode:         jest.fn(),
  create:             jest.fn(),
  update:             jest.fn(),
  deactivate:         jest.fn(),
  countActive:        jest.fn(),
  countStaffInBranch: jest.fn(),
} as unknown as jest.Mocked<BranchRepository>;

const mockCorePrisma = {
  tenant: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({ schemaName: SCHEMA_NAME }),
  },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('BranchService', () => {
  let service: BranchService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCorePrisma.tenant.findUniqueOrThrow.mockResolvedValue({ schemaName: SCHEMA_NAME });

    service = new BranchService(
      mockRepository as unknown as ConstructorParameters<typeof BranchService>[0],
      mockCorePrisma as unknown as ConstructorParameters<typeof BranchService>[1],
    );
  });

  // -------------------------------------------------------------------------
  // listBranches
  // -------------------------------------------------------------------------

  describe('listBranches', () => {
    it('returns paginated branch list', async () => {
      mockRepository.findAll.mockResolvedValueOnce({ data: [mockBranch], total: 1 });

      const result = await service.listBranches(TENANT_ID, { page: 1, limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(mockRepository.findAll).toHaveBeenCalledWith(SCHEMA_NAME, {
        page: 1,
        limit: 50,
        includeInactive: undefined,
      });
    });
  });

  // -------------------------------------------------------------------------
  // getBranch
  // -------------------------------------------------------------------------

  describe('getBranch', () => {
    it('returns branch when found', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockBranch);

      const result = await service.getBranch(TENANT_ID, BRANCH_ID);

      expect(result.id).toBe(BRANCH_ID);
      expect(result.code).toBe('KHI-01');
    });

    it('throws NotFoundException when branch does not exist', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getBranch(TENANT_ID, BRANCH_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // createBranch
  // -------------------------------------------------------------------------

  describe('createBranch', () => {
    const dto: CreateBranchDto = {
      name: 'Lahore Branch',
      code: 'LHR-01',
    };

    it('creates a branch when code is unique', async () => {
      mockRepository.findByCode.mockResolvedValueOnce(null);
      mockRepository.create.mockResolvedValueOnce({ ...mockBranch, id: 'branch-lhr', code: 'LHR-01' });

      const result = await service.createBranch(TENANT_ID, dto);

      expect(result.code).toBe('LHR-01');
      expect(mockRepository.create).toHaveBeenCalledWith(SCHEMA_NAME, dto);
    });

    it('throws ConflictException when code is already in use', async () => {
      mockRepository.findByCode.mockResolvedValueOnce(mockBranch);

      await expect(service.createBranch(TENANT_ID, dto)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // updateBranch
  // -------------------------------------------------------------------------

  describe('updateBranch', () => {
    const dto: UpdateBranchDto = { city: 'Karachi North' };

    it('updates branch when found', async () => {
      mockRepository.findById.mockResolvedValueOnce(mockBranch);
      mockRepository.update.mockResolvedValueOnce({ ...mockBranch, city: 'Karachi North' });

      const result = await service.updateBranch(TENANT_ID, BRANCH_ID, dto);

      expect(result.city).toBe('Karachi North');
      expect(mockRepository.update).toHaveBeenCalledWith(SCHEMA_NAME, BRANCH_ID, dto);
    });

    it('throws NotFoundException when branch does not exist', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.updateBranch(TENANT_ID, BRANCH_ID, dto)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // deactivateBranch
  // -------------------------------------------------------------------------

  describe('deactivateBranch', () => {
    it('deactivates a non-head-office branch with no staff', async () => {
      const nonHQ = { ...mockBranch, isHeadOffice: false };
      mockRepository.findById.mockResolvedValueOnce(nonHQ);
      mockRepository.countStaffInBranch.mockResolvedValueOnce(0);
      mockRepository.deactivate.mockResolvedValueOnce(undefined);

      await expect(service.deactivateBranch(TENANT_ID, BRANCH_ID)).resolves.toBeUndefined();
      expect(mockRepository.deactivate).toHaveBeenCalledWith(SCHEMA_NAME, BRANCH_ID);
    });

    it('throws NotFoundException when branch does not exist', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.deactivateBranch(TENANT_ID, BRANCH_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when deactivating the last active branch', async () => {
      const hqBranch = { ...mockBranch, isHeadOffice: true };
      mockRepository.findById.mockResolvedValueOnce(hqBranch);
      mockRepository.countActive.mockResolvedValueOnce(1); // only 1 active

      await expect(service.deactivateBranch(TENANT_ID, BRANCH_ID)).rejects.toThrow(ConflictException);
      expect(mockRepository.deactivate).not.toHaveBeenCalled();
    });

    it('deactivates head office when other active branches exist', async () => {
      const hqBranch = { ...mockBranch, isHeadOffice: true };
      mockRepository.findById.mockResolvedValueOnce(hqBranch);
      mockRepository.countActive.mockResolvedValueOnce(3);
      mockRepository.countStaffInBranch.mockResolvedValueOnce(0);
      mockRepository.deactivate.mockResolvedValueOnce(undefined);

      await expect(service.deactivateBranch(TENANT_ID, BRANCH_ID)).resolves.toBeUndefined();
    });
  });
});
