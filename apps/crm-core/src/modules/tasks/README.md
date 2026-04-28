# Tasks Module

Full-featured task management system built into BOS CRM Core.
Designed to match ClickUp-level functionality in a CRM context — tasks can be standalone or linked to any CRM entity (Lead, Contact, and Deal in future phases).

---

## What makes this better than ClickUp / HubSpot Tasks

| Feature | ClickUp | HubSpot | BOS |
|---|---|---|---|
| Multiple assignees | ✅ | ❌ (single) | ✅ |
| Task type (CALL/EMAIL/MEETING) | ❌ | ✅ | ✅ |
| BLOCKED status | ✅ | ❌ | ✅ |
| URGENT priority | ✅ | ❌ | ✅ |
| Subtasks | ✅ | ❌ | ✅ |
| Checklists per task | ✅ | ❌ | ✅ |
| Recurrence rule (iCal RRULE) | ✅ | ❌ | ✅ |
| Story points | ✅ | ❌ | ✅ |
| Time estimate (minutes) | ✅ | ❌ | ✅ |
| Reminders | ❌ | ✅ | ✅ |
| CRM entity link | ❌ | ✅ | ✅ |
| Auto-stamp completedAt on DONE | ❌ | ❌ | ✅ |
| Checklist item: who checked + when | ❌ | ❌ | ✅ |

---

## Task Lifecycle

```
TODO ──→ IN_PROGRESS ──→ DONE
  │           │
  └──→ BLOCKED ──→ IN_PROGRESS
  │
  └──→ CANCELLED
```

When `status` is set to `DONE`, `completedAt` is automatically stamped if not already set.

---

## Priority Levels

```
URGENT  →  P0, same-day resolution required
HIGH    →  Important, this sprint/week
NORMAL  →  Default
LOW     →  Nice to have
```

---

## API Endpoints

### Core CRUD

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/tasks` | `tenant:tasks:create` | Create a task |
| `GET` | `/tasks` | `tenant:tasks:view` | List tasks (filterable) |
| `GET` | `/tasks/:taskId` | `tenant:tasks:view` | Get task detail (includes subtasks) |
| `PATCH` | `/tasks/:taskId` | `tenant:tasks:update` | Partial update |
| `DELETE` | `/tasks/:taskId` | `tenant:tasks:delete` | Soft-delete |

### Assignees

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/tasks/:taskId/assignees` | `tenant:tasks:update` | Add assignee |
| `DELETE` | `/tasks/:taskId/assignees/:userId` | `tenant:tasks:update` | Remove assignee |

### Checklists

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/tasks/:taskId/checklists` | `tenant:tasks:manage_checklist` | Create a named checklist |
| `DELETE` | `/tasks/:taskId/checklists/:checklistId` | `tenant:tasks:manage_checklist` | Delete checklist + all items |

### Checklist Items

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/tasks/:taskId/checklists/:checklistId/items` | `tenant:tasks:manage_checklist` | Add item |
| `PATCH` | `/tasks/:taskId/checklists/:checklistId/items/:itemId` | `tenant:tasks:manage_checklist` | Toggle checked / rename / reorder |
| `DELETE` | `/tasks/:taskId/checklists/:checklistId/items/:itemId` | `tenant:tasks:manage_checklist` | Remove item |

---

## Query Filters (`GET /tasks`)

| Param | Type | Description |
|---|---|---|
| `status` | enum | TODO / IN_PROGRESS / BLOCKED / DONE / CANCELLED |
| `priority` | enum | URGENT / HIGH / NORMAL / LOW |
| `type` | enum | TODO / CALL / EMAIL / MEETING / FOLLOW_UP |
| `assigneeId` | UUID | Tasks assigned to this user |
| `entityType` | enum | LEAD / CONTACT |
| `entityId` | UUID | Tasks linked to this specific entity |
| `parentTaskId` | UUID | Subtasks of a specific parent |
| `topLevel` | boolean | `true` = root tasks only, `false` = subtasks only |
| `dueFrom` | ISO8601 | Tasks due on or after |
| `dueTo` | ISO8601 | Tasks due on or before |
| `overdue` | boolean | `true` = dueAt < now AND status not DONE/CANCELLED |
| `page` / `limit` | int | Pagination (max 100) |

---

## Recurrence

`recurrenceRule` accepts iCal RRULE strings:

```
FREQ=DAILY;COUNT=5            # Daily for 5 days
FREQ=WEEKLY;BYDAY=MO,WE,FR   # Every Mon/Wed/Fri
FREQ=MONTHLY;BYMONTHDAY=1    # First of every month
```

> Note: recurrence **expansion** (creating the next task instance on completion) is not yet implemented — the rule is stored for the frontend or a future background job to consume.

---

## Data Model

```
Task
├── TaskAssignee[]   (junction: taskId + userId)
├── TaskChecklist[]
│   └── TaskChecklistItem[]
└── subtasks: Task[] (self-referential via parentTaskId)
```

All four tables live in the per-tenant schema (`tenant_{hex}`).
Relationships to `User`, `Lead`, `Contact` are **soft references** (UUID stored, no FK) to avoid cross-schema constraints.

---

## Schema

Defined in `prisma/tenant-template/schema.prisma`.
Incremental migration for existing tenants:

```bash
POST /dev/run-tenant-migration  { "key": "tasks" }
```

---

## Permissions Seeded

| Permission slug | owner | admin | manager | staff |
|---|---|---|---|---|
| `tenant:tasks:view` | ✅ | ✅ | ✅ | ✅ |
| `tenant:tasks:create` | ✅ | ✅ | ✅ | ✅ |
| `tenant:tasks:update` | ✅ | ✅ | ✅ | ✅ |
| `tenant:tasks:delete` | ✅ | ✅ | ✅ | ❌ |
| `tenant:tasks:manage_checklist` | ✅ | ✅ | ✅ | ✅ |
