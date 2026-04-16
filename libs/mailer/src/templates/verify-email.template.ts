import type { VerifyEmailTemplateData } from '@bos/queue';
import { baseLayout, ctaButton } from './base.template';

export interface VerifyEmailTemplate {
  subject: string;
  html:    string;
  text:    string;
}

export function renderVerifyEmail(data: VerifyEmailTemplateData): VerifyEmailTemplate {
  const subject = 'Verify your email address — BOS Platform';

  const html = baseLayout(
    `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;">Verify your email</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${escapeHtml(data.firstName)}, thanks for signing up.<br/>
      Click the button below to verify your email address and activate your account.
    </p>
    ${ctaButton('Verify Email Address', data.verifyUrl)}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      This link expires in ${data.expiresHours} hours. If you did not create an account, ignore this email.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
      Or copy this link: ${escapeHtml(data.verifyUrl)}
    </p>
    `,
    `Verify your BOS Platform account — link expires in ${data.expiresHours}h`,
  );

  const text = [
    `Hi ${data.firstName},`,
    '',
    'Verify your email address to activate your BOS Platform account:',
    '',
    data.verifyUrl,
    '',
    `This link expires in ${data.expiresHours} hours.`,
    'If you did not create an account, ignore this email.',
  ].join('\n');

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
