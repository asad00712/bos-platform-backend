import { ModuleKey } from '@bos-prisma/core';

export class TerminologyEntry {
  declare singular: string;
  declare plural: string;
  declare icon?: string | null;
}

export class TenantConfigResponseDto {
  declare tenantId: string;
  declare vertical: string | null;
  declare onboardingCompleted: boolean;
  declare enabledModules: ModuleKey[];
  declare terminology: Record<string, TerminologyEntry>;
}
