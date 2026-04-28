import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './services/tenant.service';
import { TenantModuleRepository } from './repositories/tenant-module.repository';

@Module({
  imports: [],
  controllers: [TenantController],
  providers: [TenantService, TenantModuleRepository],
  exports: [TenantService],
})
export class TenantModule {}
