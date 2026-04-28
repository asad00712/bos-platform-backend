import { ModuleKey } from '@bos-prisma/core';

export class ModuleSuggestionResponseDto {
  declare recommended: ModuleKey[];
  declare alwaysOn: ModuleKey[];
  declare all: ModuleKey[];
}
