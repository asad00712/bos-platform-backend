import { IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ModuleKey } from '@bos-prisma/core';

export class SelectModulesDto {
  @ApiProperty({ enum: ModuleKey, isArray: true })
  @IsArray()
  @IsEnum(ModuleKey, { each: true })
  declare moduleKeys: ModuleKey[];
}
