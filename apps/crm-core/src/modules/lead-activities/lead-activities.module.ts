import { Module } from '@nestjs/common';
import { LeadActivityController, MyTasksController } from './controllers/lead-activity.controller';
import { LeadActivityService } from './services/lead-activity.service';
import { LeadActivityRepository } from './repositories/lead-activity.repository';

@Module({
  controllers: [LeadActivityController, MyTasksController],
  providers:   [LeadActivityService, LeadActivityRepository],
  exports:     [LeadActivityService],
})
export class LeadActivitiesModule {}
