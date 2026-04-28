# Lead Activities Module

Unified activity log for leads — tracks every customer interaction in a single timeline.
Exceeds standard CRM capabilities with transcript URLs, `IN_PROGRESS` task state, denormalized `nextFollowUpAt` for instant dashboard queries, and per-type call outcome tracking.

## Activity Types

| Type | Description |
|---|---|
| `NOTE` | Free-text note logged against the lead |
| `CALL` | Logged phone call with outcome, duration, recording URL |
| `EMAIL` | Outbound / inbound email reference |
| `SMS` | SMS interaction |
| `WHATSAPP` | WhatsApp message |
| `MEETING` | Scheduled or completed meeting |
| `TASK` | Follow-up task with a `dueAt` deadline and `taskStatus` lifecycle |

## API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/leads/:leadId/activities` | `tenant:leads:log_activity` | Log any activity |
| `GET` | `/leads/:leadId/activities` | `tenant:leads:view_branch` | Activity timeline (newest first) |
| `GET` | `/leads/:leadId/activities/summary` | `tenant:leads:view_branch` | Count per type + last/next dates |
| `PATCH` | `/leads/:leadId/activities/:activityId` | `tenant:leads:log_activity` | Edit activity / mark task done |
| `DELETE` | `/leads/:leadId/activities/:activityId` | `tenant:leads:log_activity` | Soft-delete activity |
| `GET` | `/lead-activities/tasks` | `tenant:leads:view_branch` | My upcoming tasks across all leads |

## Task Lifecycle

```
PENDING → IN_PROGRESS → COMPLETED
                       → CANCELLED
```

Marking a task `COMPLETED` or `CANCELLED` automatically removes it from the `nextFollowUpAt` recalculation so the Lead model reflects the next **actionable** follow-up.

## Denormalized Fields on Lead

Three fields on `Lead` are updated automatically by this module's repository:

| Field | Maintained by |
|---|---|
| `lastActivityAt` | Every activity create / soft-delete |
| `nextFollowUpAt` | Every TASK create / update (status or dueAt) / soft-delete |
| `touchpointCount` | Every activity create / soft-delete |

These fields enable O(1) dashboard queries ("show overdue leads", "sort by last touch") without aggregating the activities table on every request.

## Call Outcomes

`SPOKE` · `NO_ANSWER` · `VOICEMAIL` · `BUSY` · `WRONG_NUMBER` · `CALL_BACK_REQUESTED`

`CALL_BACK_REQUESTED` is unique to BOS — use it to auto-trigger a follow-up task suggestion in the future AI layer.

## Schema

Defined in `prisma/tenant-template/schema.prisma` — `LeadActivity` model.
Incremental migration for existing tenants: `POST /dev/run-tenant-migration` with body `{ "key": "lead_activities" }`.

## Permissions Seeded

| Permission slug | Granted to |
|---|---|
| `tenant:leads:log_activity` | owner, admin, manager, staff |
| `tenant:leads:view_branch` | already existed — covers GET endpoints |
