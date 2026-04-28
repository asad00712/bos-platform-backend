import { Module } from '@nestjs/common';
import { BosQueueModule, QUEUE_NAMES } from '@bos/queue';
import { StaffController } from './staff.controller';
import { StaffService } from './services/staff.service';
import { StaffRepository } from './repositories/staff.repository';

@Module({
  imports: [BosQueueModule.forFeature([{ name: QUEUE_NAMES.MAIL }])],
  controllers: [StaffController],
  providers: [StaffService, StaffRepository],
  exports: [StaffService],
})
export class StaffModule {}
