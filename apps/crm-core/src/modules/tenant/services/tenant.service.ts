import { Injectable } from '@nestjs/common';
import { ModuleKey } from '@bos-prisma/core';
import { CorePrismaService } from '@bos/database';
import { TenantModuleRepository } from '../repositories/tenant-module.repository';
import { SelectModulesDto } from '../dto/select-modules.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ModuleSuggestionResponseDto } from '../dto/module-suggestion.response.dto';
import { TenantConfigResponseDto, TerminologyEntry } from '../dto/tenant-config.response.dto';

/** These modules are always on and cannot be disabled by tenants. */
export const ALWAYS_ON_MODULES: ModuleKey[] = [
  ModuleKey.CONTACTS,
  ModuleKey.STAFF,
  ModuleKey.BRANCHES,
  ModuleKey.ROLES_PERMISSIONS,
];

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: CorePrismaService,
    private readonly tenantModuleRepository: TenantModuleRepository,
  ) {}

  /**
   * Get module suggestions for a tenant based on their vertical.
   * If no vertical is set, all modules are returned as recommended.
   */
  async getModuleSuggestions(tenantId: string): Promise<ModuleSuggestionResponseDto> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { vertical: true },
    });

    const all = Object.values(ModuleKey);

    if (!tenant.vertical) {
      return {
        recommended: all,
        alwaysOn: ALWAYS_ON_MODULES,
        all,
      };
    }

    const preset = await this.prisma.modulePreset.findUnique({
      where: { vertical: tenant.vertical },
      select: { modules: true },
    });

    return {
      recommended: preset?.modules ?? all,
      alwaysOn: ALWAYS_ON_MODULES,
      all,
    };
  }

  /**
   * Save selected modules for a tenant.
   * Always-on modules are automatically merged in.
   * Marks onboarding as completed.
   */
  async selectModules(
    tenantId: string,
    dto: SelectModulesDto,
    userId: string,
  ): Promise<void> {
    // Merge always-on modules — deduplicate using Set
    const merged = Array.from(new Set([...ALWAYS_ON_MODULES, ...dto.moduleKeys]));

    await this.tenantModuleRepository.upsertMany(tenantId, merged, userId);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingCompleted: true },
    });
  }

  /**
   * Get the full tenant config: enabled modules + vertical terminology.
   */
  async getTenantConfig(tenantId: string): Promise<TenantConfigResponseDto> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, vertical: true, onboardingCompleted: true },
    });

    const enabledModules = await this.tenantModuleRepository.findEnabled(tenantId);

    const terminologyRows = tenant.vertical
      ? await this.prisma.verticalTerminology.findMany({
          where: { vertical: tenant.vertical },
          select: { termKey: true, singular: true, plural: true, icon: true },
        })
      : [];

    const terminology: Record<string, TerminologyEntry> = {};
    for (const row of terminologyRows) {
      terminology[row.termKey] = {
        singular: row.singular,
        plural: row.plural,
        icon: row.icon,
      };
    }

    return {
      tenantId: tenant.id,
      vertical: tenant.vertical,
      onboardingCompleted: tenant.onboardingCompleted,
      enabledModules,
      terminology,
    };
  }

  /**
   * Update tenant business profile fields.
   * Only updates fields that are explicitly provided (not undefined).
   */
  async updateProfile(tenantId: string, dto: UpdateProfileDto): Promise<void> {
    const data: Partial<{
      businessPhone: string | null;
      businessCity: string | null;
      websiteUrl: string | null;
      logoUrl: string | null;
      goals: string[];
    }> = {};

    if (dto.businessPhone !== undefined) data.businessPhone = dto.businessPhone;
    if (dto.businessCity !== undefined) data.businessCity = dto.businessCity;
    if (dto.websiteUrl !== undefined) data.websiteUrl = dto.websiteUrl;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.goals !== undefined) data.goals = dto.goals;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
  }
}
