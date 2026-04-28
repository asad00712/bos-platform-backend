import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RoleService } from './services/role.service';
import { RoleRepository } from './repositories/role.repository';

@Module({
  controllers: [RolesController],
  providers: [RoleService, RoleRepository],
  exports: [RoleService],
})
export class RolesModule {}
