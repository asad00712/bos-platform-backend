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
