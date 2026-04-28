/**
 * Strongly-typed job payloads for every BullMQ queue in BOS.
 * Workers and producers share these interfaces — never use `any` or raw JSON.
 */

// ---------------------------------------------------------------------------
// Email template identifiers
// ---------------------------------------------------------------------------

export enum EmailTemplateId {
  VERIFY_EMAIL    = 'auth.verify-email',
  PASSWORD_RESET  = 'auth.password-reset',
  STAFF_INVITE    = 'auth.staff-invite',
  TASK_ASSIGNED   = 'crm.task-assigned',
}

// ---------------------------------------------------------------------------
// Mail queue job payloads
// ---------------------------------------------------------------------------

/**
 * Payload for a `send-email` job in the `bos.mail` queue.
 *
 * `templateData` is template-specific — see each template's interface below.
 * `correlationId` is the HTTP request ID, forwarded for end-to-end tracing.
 */
export interface SendEmailJobPayload {
  /** Soft ref → tenants.id. Null for platform-level sends (e.g. verify-email). */
  tenantId:          string | null;
  recipientEmail:    string;
  subject:           string;
  templateId:        EmailTemplateId;
  templateData:      Record<string, unknown>;
  /** Soft ref → users.id. Null when triggered by the system (no HTTP actor). */
  triggeredByUserId: string | null;
  /** HTTP request correlation ID — for tracing in logs and OutboundMessage rows. */
  correlationId:     string | null;
}

// ---------------------------------------------------------------------------
// Per-template data shapes (add a new interface for each new template)
// ---------------------------------------------------------------------------

export interface VerifyEmailTemplateData {
  firstName:    string;
  verifyUrl:    string;
  expiresHours: number;
}

export interface PasswordResetTemplateData {
  firstName:    string;
  resetUrl:     string;
  expiresHours: number;
}

export interface StaffInviteTemplateData {
  firstName:    string;
  inviterName:  string;
  orgName:      string;
  inviteUrl:    string;
  expiresHours: number;
}

export interface TaskAssignedTemplateData {
  assigneeName:   string;
  assignerName:   string;
  taskTitle:      string;
  taskDueAt:      string | null;
  taskUrl:        string;
}

// ---------------------------------------------------------------------------
// Workflow queue job names
// ---------------------------------------------------------------------------

export const WORKFLOW_JOB_NAMES = {
  LEAD_CREATED:        'crm.lead.created',
  LEAD_STATUS_CHANGED: 'crm.lead.status_changed',
  LEAD_ASSIGNED:       'crm.lead.assigned',
} as const;

export type WorkflowJobName = (typeof WORKFLOW_JOB_NAMES)[keyof typeof WORKFLOW_JOB_NAMES];

// ---------------------------------------------------------------------------
// CRM Lead workflow event payloads
// ---------------------------------------------------------------------------

export interface LeadCreatedJobPayload {
  tenantId:        string;
  schemaName:      string;
  leadId:          string;
  contactId:       string;
  branchId:        string;
  createdByUserId: string | null;
}

export interface LeadStatusChangedJobPayload {
  tenantId:        string;
  schemaName:      string;
  leadId:          string;
  contactId:       string | null;
  branchId:        string;
  oldStatusId:     string | null;
  newStatusId:     string | null;
  changedByUserId: string | null;
}

export interface LeadAssignedJobPayload {
  tenantId:         string;
  schemaName:       string;
  leadId:           string;
  contactId:        string | null;
  branchId:         string;
  assignedUserId:   string;
}
