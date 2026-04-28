import { Module } from '@nestjs/common';
import { BosQueueModule, QUEUE_NAMES } from '@bos/queue';
import { LeadAssignmentController } from './lead-assignment.controller';
import { LeadAssignmentConfigService } from './services/lead-assignment-config.service';
import { LeadAssignmentConfigRepository } from './repositories/lead-assignment-config.repository';
import { LeadAssignmentProcessor } from './processors/lead-assignment.processor';

@Module({
  imports: [BosQueueModule.forFeature([{ name: QUEUE_NAMES.WORKFLOW }])],
  controllers: [LeadAssignmentController],
  providers: [
    LeadAssignmentConfigService,
    LeadAssignmentConfigRepository,
    LeadAssignmentProcessor,
  ],
})
export class LeadAssignmentModule {}
