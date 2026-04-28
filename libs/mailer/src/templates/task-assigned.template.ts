import type { TaskAssignedTemplateData } from '@bos/queue';
import { baseLayout, ctaButton } from './base.template';

export interface TaskAssignedTemplate {
  subject: string;
  html:    string;
  text:    string;
}

export function renderTaskAssigned(data: TaskAssignedTemplateData): TaskAssignedTemplate {
  const taskTitle = escapeHtml(data.taskTitle);
  const subject   = `You've been assigned a task: ${data.taskTitle}`;

  const dueLine = data.taskDueAt
    ? `<p style="margin:16px 0 0;font-size:14px;color:#374151;">
        <strong>Due:</strong> ${escapeHtml(data.taskDueAt)}
       </p>`
    : '';

  const html = baseLayout(
    `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;">New task assigned</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${escapeHtml(data.assigneeName)},<br/>
      <strong>${escapeHtml(data.assignerName)}</strong> has assigned you a task.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#18181b;">${taskTitle}</p>
      ${dueLine}
    </div>
    ${ctaButton('View Task', data.taskUrl)}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
      If you weren't expecting this assignment, contact your team admin.
    </p>
    `,
    `${data.assignerName} assigned you "${data.taskTitle}"`,
  );

  const lines = [
    `Hi ${data.assigneeName},`,
    '',
    `${data.assignerName} has assigned you a task: "${data.taskTitle}"`,
  ];
  if (data.taskDueAt) lines.push('', `Due: ${data.taskDueAt}`);
  lines.push('', 'View the task here:', '', data.taskUrl);

  return { subject, html, text: lines.join('\n') };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
