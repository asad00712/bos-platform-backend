import { ModuleKey, VerticalType } from '@bos-prisma/core';
import { TenantService, ALWAYS_ON_MODULES } from '../services/tenant.service';
import type { TenantModuleRepository } from '../repositories/tenant-module.repository';
import type { SelectModulesDto } from '../dto/select-modules.dto';
import type { UpdateProfileDto } from '../dto/update-profile.dto';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  tenant: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  modulePreset: {
    findUnique: jest.fn(),
  },
  verticalTerminology: {
    findMany: jest.fn(),
  },
};

const mockRepository: Partial<TenantModuleRepository> = {
  upsertMany: jest.fn(),
  findEnabled: jest.fn(),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('TenantService', () => {
  let service: TenantService;

  const TENANT_ID = 'tenant-uuid-001';
  const USER_ID   = 'user-uuid-001';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantService(
      mockPrisma as unknown as ConstructorParameters<typeof TenantService>[0],
      mockRepository as TenantModuleRepository,
    );
  });

  // -------------------------------------------------------------------------
  // getModuleSuggestions
  // -------------------------------------------------------------------------

  describe('getModuleSuggestions', () => {
    it('returns preset recommended modules when tenant has a vertical', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({ vertical: VerticalType.medical });
      mockPrisma.modulePreset.findUnique.mockResolvedValueOnce({
        modules: [ModuleKey.CONTACTS, ModuleKey.APPOINTMENTS, ModuleKey.BILLING],
      });

      const result = await service.getModuleSuggestions(TENANT_ID);

      expect(result.recommended).toEqual([ModuleKey.CONTACTS, ModuleKey.APPOINTMENTS, ModuleKey.BILLING]);
      expect(result.alwaysOn).toEqual(ALWAYS_ON_MODULES);
      expect(result.all).toEqual(expect.arrayContaining(Object.values(ModuleKey)));
      expect(mockPrisma.modulePreset.findUnique).toHaveBeenCalledWith({
        where: { vertical: VerticalType.medical },
        select: { modules: true },
      });
    });

    it('returns all modules as recommended when tenant has no vertical', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({ vertical: null });

      const result = await service.getModuleSuggestions(TENANT_ID);

      expect(result.recommended).toEqual(Object.values(ModuleKey));
      expect(result.alwaysOn).toEqual(ALWAYS_ON_MODULES);
      expect(mockPrisma.modulePreset.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to all modules when no preset exists for vertical', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({ vertical: VerticalType.gym });
      mockPrisma.modulePreset.findUnique.mockResolvedValueOnce(null);

      const result = await service.getModuleSuggestions(TENANT_ID);

      expect(result.recommended).toEqual(Object.values(ModuleKey));
    });
  });

  // -------------------------------------------------------------------------
  // selectModules
  // -------------------------------------------------------------------------

  describe('selectModules', () => {
    it('always includes always-on modules regardless of input', async () => {
      (mockRepository.upsertMany as jest.Mock).mockResolvedValueOnce(undefined);
      mockPrisma.tenant.update.mockResolvedValueOnce({});

      const dto: SelectModulesDto = { moduleKeys: [ModuleKey.CAMPAIGNS] };
      await service.selectModules(TENANT_ID, dto, USER_ID);

      const [, calledModules] = (mockRepository.upsertMany as jest.Mock).mock.calls[0] as [string, ModuleKey[], string];
      for (const m of ALWAYS_ON_MODULES) {
        expect(calledModules).toContain(m);
      }
      expect(calledModules).toContain(ModuleKey.CAMPAIGNS);
    });

    it('deduplicates modules when always-on keys are passed explicitly', async () => {
      (mockRepository.upsertMany as jest.Mock).mockResolvedValueOnce(undefined);
      mockPrisma.tenant.update.mockResolvedValueOnce({});

      // Pass CONTACTS which is already always-on
      const dto: SelectModulesDto = { moduleKeys: [ModuleKey.CONTACTS, ModuleKey.BILLING] };
      await service.selectModules(TENANT_ID, dto, USER_ID);

      const [, calledModules] = (mockRepository.upsertMany as jest.Mock).mock.calls[0] as [string, ModuleKey[], string];
      const contactsCount = calledModules.filter((k) => k === ModuleKey.CONTACTS).length;
      expect(contactsCount).toBe(1);
    });

    it('marks onboarding as completed', async () => {
      (mockRepository.upsertMany as jest.Mock).mockResolvedValueOnce(undefined);
      mockPrisma.tenant.update.mockResolvedValueOnce({});

      const dto: SelectModulesDto = { moduleKeys: [] };
      await service.selectModules(TENANT_ID, dto, USER_ID);

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { onboardingCompleted: true },
      });
    });

    it('passes userId as enabledBy to the repository', async () => {
      (mockRepository.upsertMany as jest.Mock).mockResolvedValueOnce(undefined);
      mockPrisma.tenant.update.mockResolvedValueOnce({});

      const dto: SelectModulesDto = { moduleKeys: [ModuleKey.DOCUMENTS] };
      await service.selectModules(TENANT_ID, dto, USER_ID);

      const [, , enabledBy] = (mockRepository.upsertMany as jest.Mock).mock.calls[0] as [string, ModuleKey[], string];
      expect(enabledBy).toBe(USER_ID);
    });
  });

  // -------------------------------------------------------------------------
  // getTenantConfig
  // -------------------------------------------------------------------------

  describe('getTenantConfig', () => {
    it('returns correct terminology mapping for tenant with vertical', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        id: TENANT_ID,
        vertical: VerticalType.medical,
        onboardingCompleted: true,
      });
      (mockRepository.findEnabled as jest.Mock).mockResolvedValueOnce([
        ModuleKey.CONTACTS,
        ModuleKey.APPOINTMENTS,
      ]);
      mockPrisma.verticalTerminology.findMany.mockResolvedValueOnce([
        { termKey: 'contact',     singular: 'Patient',     plural: 'Patients',     icon: null },
        { termKey: 'appointment', singular: 'Appointment', plural: 'Appointments', icon: null },
      ]);

      const result = await service.getTenantConfig(TENANT_ID);

      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.vertical).toBe(VerticalType.medical);
      expect(result.onboardingCompleted).toBe(true);
      expect(result.enabledModules).toEqual([ModuleKey.CONTACTS, ModuleKey.APPOINTMENTS]);
      expect(result.terminology['contact']).toEqual({ singular: 'Patient', plural: 'Patients', icon: null });
      expect(result.terminology['appointment']).toEqual({ singular: 'Appointment', plural: 'Appointments', icon: null });
    });

    it('returns empty terminology when tenant has no vertical', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        id: TENANT_ID,
        vertical: null,
        onboardingCompleted: false,
      });
      (mockRepository.findEnabled as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getTenantConfig(TENANT_ID);

      expect(result.terminology).toEqual({});
      expect(mockPrisma.verticalTerminology.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // updateProfile
  // -------------------------------------------------------------------------

  describe('updateProfile', () => {
    it('only updates fields that are provided', async () => {
      mockPrisma.tenant.update.mockResolvedValueOnce({});

      const dto: UpdateProfileDto = { businessPhone: '+1234567890' };
      await service.updateProfile(TENANT_ID, dto);

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { businessPhone: '+1234567890' },
      });

      // businessCity, websiteUrl, logoUrl, goals must NOT be in the update payload
      const firstCallArg = ((mockPrisma.tenant.update as jest.Mock).mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(firstCallArg.data).not.toHaveProperty('businessCity');
      expect(firstCallArg.data).not.toHaveProperty('websiteUrl');
      expect(firstCallArg.data).not.toHaveProperty('logoUrl');
      expect(firstCallArg.data).not.toHaveProperty('goals');
    });

    it('updates multiple fields when provided', async () => {
      mockPrisma.tenant.update.mockResolvedValueOnce({});

      const dto: UpdateProfileDto = {
        businessCity: 'Dubai',
        websiteUrl: 'https://example.com',
        goals: ['grow_revenue', 'automate_tasks'],
      };
      await service.updateProfile(TENANT_ID, dto);

      const firstCallArg = ((mockPrisma.tenant.update as jest.Mock).mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(firstCallArg.data).toEqual({
        businessCity: 'Dubai',
        websiteUrl: 'https://example.com',
        goals: ['grow_revenue', 'automate_tasks'],
      });
    });

    it('sends an empty update payload when no fields are provided', async () => {
      mockPrisma.tenant.update.mockResolvedValueOnce({});

      await service.updateProfile(TENANT_ID, {});

      const firstCallArg = ((mockPrisma.tenant.update as jest.Mock).mock.calls[0] as [{ data: Record<string, unknown> }])[0];
      expect(firstCallArg.data).toEqual({});
    });
  });
});
