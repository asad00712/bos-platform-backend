export const RESEND_CLIENT    = Symbol('RESEND_CLIENT');
export const MAILER_FROM_NAME = Symbol('MAILER_FROM_NAME');
export const MAILER_FROM_ADDR = Symbol('MAILER_FROM_ADDR');

/** Fallback values when env vars are not set. */
export const DEFAULT_FROM_NAME    = 'BOS Platform';
/** Use onboarding@resend.dev for dev (no domain verification needed).
 *  Set MAILER_FROM_ADDRESS in .env to your verified domain in production. */
export const DEFAULT_FROM_ADDRESS = 'onboarding@resend.dev';
