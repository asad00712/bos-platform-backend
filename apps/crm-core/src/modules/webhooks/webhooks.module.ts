import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { LeadWebhooksController } from './lead-webhooks.controller';
import { WebhookIngestionController } from './webhook-ingestion.controller';
import { LeadWebhookService } from './services/lead-webhook.service';
import { LeadWebhookRepository } from './repositories/lead-webhook.repository';

@Module({
  imports: [LeadsModule],
  controllers: [LeadWebhooksController, WebhookIngestionController],
  providers: [LeadWebhookService, LeadWebhookRepository],
})
export class WebhooksModule {}
