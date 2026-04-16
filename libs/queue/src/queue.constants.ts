/**
 * Canonical BullMQ queue names. Every queue used across BOS is declared here
 * so producers and workers always reference the same string.
 */
export const QUEUE_NAMES = {
  // Transactional — time-sensitive, low-volume
  MAIL:         'bos.mail',
  NOTIFICATION: 'bos.notification',
  WEBHOOK:      'bos.webhook',
  AI_LEAD:      'bos.ai-lead',

  // Heavy — high-volume, latency-tolerant
  CAMPAIGN:    'bos.campaign',
  WORKFLOW:    'bos.workflow',
  BULK_IMPORT: 'bos.bulk-import',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * BullMQ configKey — identifies which Redis connection a queue uses.
 * 'transactional' → REDIS_QUEUE_TRANSACTIONAL_* (auth emails, notifications, webhooks, AI)
 * 'heavy'         → REDIS_QUEUE_HEAVY_*         (campaigns, workflows, bulk imports)
 */
export type QueueConfigKey = 'transactional' | 'heavy';

/**
 * Maps every queue name to its BullMQ configKey (i.e. which Redis connection it uses).
 * This is the single source of truth — forFeature() and @Processor() both read from here.
 */
export const QUEUE_CONN_MAP: Record<QueueName, QueueConfigKey> = {
  [QUEUE_NAMES.MAIL]:         'transactional',
  [QUEUE_NAMES.NOTIFICATION]: 'transactional',
  [QUEUE_NAMES.WEBHOOK]:      'transactional',
  [QUEUE_NAMES.AI_LEAD]:      'transactional',
  [QUEUE_NAMES.CAMPAIGN]:     'heavy',
  [QUEUE_NAMES.WORKFLOW]:     'heavy',
  [QUEUE_NAMES.BULK_IMPORT]:  'heavy',
};

/**
 * BullMQ job names within each queue. Kept per-queue to avoid collisions
 * when a single queue handles multiple message types.
 */
export const MAIL_JOB_NAMES = {
  SEND_EMAIL: 'send-email',
} as const;

export type MailJobName = (typeof MAIL_JOB_NAMES)[keyof typeof MAIL_JOB_NAMES];
