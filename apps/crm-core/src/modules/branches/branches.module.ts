import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchService } from './services/branch.service';
import { BranchRepository } from './repositories/branch.repository';

@Module({
  controllers: [BranchesController],
  providers: [BranchService, BranchRepository],
  exports: [BranchService],
})
export class BranchesModule {}
