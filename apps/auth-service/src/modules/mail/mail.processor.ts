import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Prisma } from '@bos-prisma/volatile';
import { VolatilePrismaService } from '@bos/database';
import { MailerService } from '@bos/mailer';
import { QUEUE_NAMES, QUEUE_CONN_MAP, MAIL_JOB_NAMES, type SendEmailJobPayload } from '@bos/queue';

/**
 * BullMQ worker that processes outbound email jobs from the `bos.mail` queue.
 *
 * For each job it:
 *   1. Creates an OutboundMessage row (status = sending) for traceability
 *   2. Calls MailerService to send via Resend
 *   3. Updates the row with providerId + status = sent
 *   4. On failure: marks status = failed + stores errorMessage
 *
 * BullMQ handles retries automatically (3 attempts, exponential backoff)
 * based on the defaultJobOptions configured in BosQueueModule.forRoot().
 */
@Processor({ name: QUEUE_NAMES.MAIL, configKey: QUEUE_CONN_MAP[QUEUE_NAMES.MAIL] })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly volatile: VolatilePrismaService,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobPayload>): Promise<void> {
    if (job.name !== MAIL_JOB_NAMES.SEND_EMAIL) {
      this.logger.warn(`Unknown job name: ${job.name} — skipping`);
      return;
    }

    const payload = job.data;
    this.logger.log(`Processing email job ${job.id} [${payload.templateId}] → ${payload.recipientEmail}`);

    // 1. Record the attempt in bos_volatile
    const record = await this.volatile.outboundMessage.create({
      data: {
        tenantId:          payload.tenantId ?? undefined,
        channel:           'email',
        messageType:       'transactional',
        recipientEmail:    payload.recipientEmail,
        subject:           payload.subject,
        templateId:        payload.templateId,
        templateData:      payload.templateData as unknown as Prisma.InputJsonValue,
        status:            'sending',
        retryCount:        job.attemptsMade,
        triggeredByUserId: payload.triggeredByUserId ?? undefined,
        correlationId:     payload.correlationId ?? undefined,
      },
    });

    try {
      // 2. Send via Resend
      const { providerId } = await this.mailer.send(payload);

      // 3. Mark sent
      await this.volatile.outboundMessage.update({
        where: { id: record.id },
        data:  { status: 'sent', providerId, sentAt: new Date() },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // 4. Mark failed — BullMQ will retry based on job options
      await this.volatile.outboundMessage.update({
        where: { id: record.id },
        data:  {
          status:       'failed',
          errorMessage: message,
          retryCount:   job.attemptsMade,
        },
      });

      // Re-throw so BullMQ knows the job failed and can retry
      throw err;
    }
  }
}
