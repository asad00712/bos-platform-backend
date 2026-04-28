import { Injectable } from '@nestjs/common';
import { ModuleKey, TenantModule } from '@bos-prisma/core';
import { CorePrismaService } from '@bos/database';

@Injectable()
export class TenantModuleRepository {
  constructor(private readonly prisma: CorePrismaService) {}

  async findAllForTenant(tenantId: string): Promise<TenantModule[]> {
    return this.prisma.tenantModule.findMany({
      where: { tenantId },
    });
  }

  async upsertMany(
    tenantId: string,
    moduleKeys: ModuleKey[],
    enabledBy: string | null,
  ): Promise<void> {
    await Promise.all(
      moduleKeys.map((moduleKey) =>
        this.prisma.tenantModule.upsert({
          where: { tenantId_moduleKey: { tenantId, moduleKey } },
          create: {
            tenantId,
            moduleKey,
            isEnabled: true,
            enabledBy: enabledBy ?? null,
          },
          update: {
            isEnabled: true,
            enabledBy: enabledBy ?? null,
          },
        }),
      ),
    );
  }

  async findEnabled(tenantId: string): Promise<ModuleKey[]> {
    const rows = await this.prisma.tenantModule.findMany({
      where: { tenantId, isEnabled: true },
      select: { moduleKey: true },
    });
    return rows.map((r) => r.moduleKey);
  }
}
