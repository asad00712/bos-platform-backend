import { Module } from '@nestjs/common';
import { BosQueueModule } from '@bos/queue';
import { QUEUE_NAMES } from '@bos/queue';
import { MailProcessor } from './mail.processor';

/**
 * Registers the mail BullMQ worker for the auth-service.
 * Picks up `bos.mail` queue jobs and sends emails via MailerService.
 */
@Module({
  imports: [
    BosQueueModule.forFeature([{ name: QUEUE_NAMES.MAIL }]),
  ],
  providers: [MailProcessor],
})
export class MailModule {}
