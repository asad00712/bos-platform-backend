import { Inject, Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  EmailTemplateId,
  type SendEmailJobPayload,
  type VerifyEmailTemplateData,
  type PasswordResetTemplateData,
} from '@bos/queue';
import { RESEND_CLIENT, DEFAULT_FROM_NAME, DEFAULT_FROM_ADDRESS } from './mailer.constants';
import { renderVerifyEmail } from './templates/verify-email.template';
import { renderPasswordReset } from './templates/password-reset.template';

export interface SendResult {
  /** Provider-assigned message ID — store in OutboundMessage.providerId */
  providerId: string;
}

/**
 * Thin wrapper around the Resend client.
 *
 * Responsible for:
 *   1. Selecting the correct template renderer based on `templateId`
 *   2. Calling the Resend API
 *   3. Returning the provider message ID
 *
 * Does NOT write to the database — that's the mail processor's job.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly fromAddress: string;

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend,
  ) {
    this.fromAddress = `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`;
  }

  async send(job: SendEmailJobPayload): Promise<SendResult> {
    const { subject, html, text } = this.renderTemplate(job);

    const { data, error } = await this.resend.emails.send({
      from:    this.fromAddress,
      to:      job.recipientEmail,
      subject,
      html,
      text,
    });

    if (error || !data) {
      const message = error?.message ?? 'Unknown Resend error';
      this.logger.error(`Resend send failed for ${job.recipientEmail} [${job.templateId}]: ${message}`);
      throw new Error(`Resend send failed: ${message}`);
    }

    this.logger.log(`Email sent to ${job.recipientEmail} [${job.templateId}] providerId=${data.id}`);
    return { providerId: data.id };
  }

  // ---------------------------------------------------------------------------
  // Private: template dispatch
  // ---------------------------------------------------------------------------

  private renderTemplate(job: SendEmailJobPayload): { subject: string; html: string; text: string } {
    switch (job.templateId) {
      case EmailTemplateId.VERIFY_EMAIL:
        return renderVerifyEmail(job.templateData as unknown as VerifyEmailTemplateData);

      case EmailTemplateId.PASSWORD_RESET:
        return renderPasswordReset(job.templateData as unknown as PasswordResetTemplateData);

      default:
        throw new Error(`Unknown email templateId: ${job.templateId}`);
    }
  }
}
