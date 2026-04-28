import { Inject, Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  EmailTemplateId,
  type SendEmailJobPayload,
  type VerifyEmailTemplateData,
  type PasswordResetTemplateData,
  type StaffInviteTemplateData,
  type TaskAssignedTemplateData,
} from '@bos/queue';
import { RESEND_CLIENT, MAILER_FROM_NAME, MAILER_FROM_ADDR } from './mailer.constants';
import { renderVerifyEmail } from './templates/verify-email.template';
import { renderPasswordReset } from './templates/password-reset.template';
import { renderStaffInvite } from './templates/staff-invite.template';
import { renderTaskAssigned } from './templates/task-assigned.template';

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
    @Inject(MAILER_FROM_NAME) fromName: string,
    @Inject(MAILER_FROM_ADDR) fromAddr: string,
  ) {
    this.fromAddress = `${fromName} <${fromAddr}>`;
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

      case EmailTemplateId.STAFF_INVITE:
        return renderStaffInvite(job.templateData as unknown as StaffInviteTemplateData);

      case EmailTemplateId.TASK_ASSIGNED:
        return renderTaskAssigned(job.templateData as unknown as TaskAssignedTemplateData);

      default:
        throw new Error(`Unknown email templateId: ${job.templateId}`);
    }
  }
}
