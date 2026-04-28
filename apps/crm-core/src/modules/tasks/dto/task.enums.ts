/**
 * Task module enums — mirror the Prisma schema enums so controllers/DTOs
 * stay decoupled from the generated client.
 */

export enum TaskType {
  TODO      = 'TODO',
  CALL      = 'CALL',
  EMAIL     = 'EMAIL',
  MEETING   = 'MEETING',
  FOLLOW_UP = 'FOLLOW_UP',
}

/**
 * Task lifecycle:
 *   TODO → IN_PROGRESS → DONE
 *                      → CANCELLED
 *   TODO / IN_PROGRESS → BLOCKED (waiting on something external)
 *   BLOCKED → IN_PROGRESS (unblocked)
 */
export enum TaskStatus {
  TODO        = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED     = 'BLOCKED',
  DONE        = 'DONE',
  CANCELLED   = 'CANCELLED',
}

/**
 * URGENT is intentional and distinct from HIGH.
 * Use URGENT for P0 issues that need same-day resolution.
 */
export enum TaskPriority {
  URGENT = 'URGENT',
  HIGH   = 'HIGH',
  NORMAL = 'NORMAL',
  LOW    = 'LOW',
}

/**
 * CRM entity types a task can be linked to (soft reference — no FK).
 * DEAL will be added when the Deals module is built.
 */
export enum TaskEntityType {
  LEAD    = 'LEAD',
  CONTACT = 'CONTACT',
}
