import type { PasswordResetTemplateData } from '@bos/queue';
import { baseLayout, ctaButton } from './base.template';

export interface PasswordResetTemplate {
  subject: string;
  html:    string;
  text:    string;
}

export function renderPasswordReset(data: PasswordResetTemplateData): PasswordResetTemplate {
  const subject = 'Reset your password — BOS Platform';

  const html = baseLayout(
    `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${escapeHtml(data.firstName)}, we received a request to reset your password.<br/>
      Click the button below to choose a new one.
    </p>
    ${ctaButton('Reset Password', data.resetUrl)}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      This link expires in ${data.expiresHours} hours. If you did not request a password reset, you can safely ignore this email — your password will not change.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
      Or copy this link: ${escapeHtml(data.resetUrl)}
    </p>
    `,
    `Reset your BOS Platform password — link expires in ${data.expiresHours}h`,
  );

  const text = [
    `Hi ${data.firstName},`,
    '',
    'Reset your BOS Platform password using the link below:',
    '',
    data.resetUrl,
    '',
    `This link expires in ${data.expiresHours} hours.`,
    'If you did not request a password reset, ignore this email.',
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
