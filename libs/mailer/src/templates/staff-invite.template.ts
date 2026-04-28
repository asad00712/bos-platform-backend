import type { StaffInviteTemplateData } from '@bos/queue';
import { baseLayout, ctaButton } from './base.template';

export interface StaffInviteTemplate {
  subject: string;
  html:    string;
  text:    string;
}

export function renderStaffInvite(data: StaffInviteTemplateData): StaffInviteTemplate {
  const orgName = escapeHtml(data.orgName);
  const subject = `You've been invited to join ${orgName} on BOS`;

  const html = baseLayout(
    `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;">You're invited!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${escapeHtml(data.firstName)},<br/>
      <strong>${escapeHtml(data.inviterName)}</strong> has invited you to join
      <strong>${orgName}</strong> on BOS Platform.
      Click the button below to accept the invitation and set up your account.
    </p>
    ${ctaButton('Accept Invitation', data.inviteUrl)}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      This invitation expires in ${data.expiresHours} hours.
      If you weren't expecting this, you can safely ignore this email.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
      Or copy this link: ${escapeHtml(data.inviteUrl)}
    </p>
    `,
    `You've been invited to join ${data.orgName} on BOS Platform — accept within ${data.expiresHours}h`,
  );

  const text = [
    `Hi ${data.firstName},`,
    '',
    `${data.inviterName} has invited you to join ${data.orgName} on BOS Platform.`,
    '',
    'Accept the invitation here:',
    '',
    data.inviteUrl,
    '',
    `This invitation expires in ${data.expiresHours} hours.`,
    "If you weren't expecting this, you can safely ignore this email.",
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
