import { Module } from '@nestjs/common';
import { BosQueueModule, QUEUE_NAMES } from '@bos/queue';
import { TagsModule } from '../tags/tags.module';
import { ContactsModule } from '../contacts/contacts.module';
import { LeadsController } from './leads.controller';
import { LeadStatusesController } from './lead-statuses.controller';
import { LeadService } from './services/lead.service';
import { LeadStatusService } from './services/lead-status.service';
import { LeadRepository } from './repositories/lead.repository';
import { LeadStatusRepository } from './repositories/lead-status.repository';

@Module({
  imports: [TagsModule, ContactsModule, BosQueueModule.forFeature([{ name: QUEUE_NAMES.WORKFLOW }])],
  controllers: [LeadsController, LeadStatusesController],
  providers: [LeadService, LeadStatusService, LeadRepository, LeadStatusRepository],
  exports: [LeadService],
})
export class LeadsModule {}
