/**
 * Incremental migration — adds the full Task management system to existing
 * tenant schemas: Task, TaskAssignee, TaskChecklist, TaskChecklistItem tables
 * plus their enums and permissions.
 *
 * Also renames the ActivityTaskStatus enum (was TaskStatus in older schemas).
 *
 * Applied to existing tenant schemas via:
 *   POST /dev/run-tenant-migration  { "key": "tasks" }
 *
 * All statements are idempotent — safe to re-run.
 */
export const TASKS_MIGRATION_SQL = `
DO $$ BEGIN
  CREATE TYPE "TaskType" AS ENUM ('TODO', 'CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskEntityType" AS ENUM ('LEAD', 'CONTACT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Task" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "type"            "TaskType"       NOT NULL DEFAULT 'TODO',
    "status"          "TaskStatus"     NOT NULL DEFAULT 'TODO',
    "priority"        "TaskPriority"   NOT NULL DEFAULT 'NORMAL',
    "startDate"       TIMESTAMPTZ,
    "dueAt"           TIMESTAMPTZ,
    "completedAt"     TIMESTAMPTZ,
    "points"          INTEGER,
    "timeEstimate"    INTEGER,
    "recurrenceRule"  TEXT,
    "reminders"       JSONB,
    "entityType"      "TaskEntityType",
    "entityId"        UUID,
    "parentTaskId"    UUID,
    "watchers"        JSONB,
    "createdByUserId" UUID NOT NULL,
    "metadata"        JSONB,
    "deletedAt"       TIMESTAMPTZ,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMPTZ NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TaskAssignee" (
    "taskId"           UUID NOT NULL,
    "userId"           UUID NOT NULL,
    "assignedAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" UUID,
    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId", "userId")
);

CREATE TABLE IF NOT EXISTS "TaskChecklist" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "taskId"       UUID NOT NULL,
    "title"        TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMPTZ NOT NULL,
    CONSTRAINT "TaskChecklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TaskChecklistItem" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "checklistId"     UUID NOT NULL,
    "title"           TEXT NOT NULL,
    "isChecked"       BOOLEAN NOT NULL DEFAULT false,
    "checkedAt"       TIMESTAMPTZ,
    "checkedByUserId" UUID,
    "displayOrder"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMPTZ NOT NULL,
    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Task_entityType_entityId_idx"   ON "Task"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Task_createdByUserId_idx"        ON "Task"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Task_status_dueAt_idx"           ON "Task"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "Task_parentTaskId_idx"           ON "Task"("parentTaskId");
CREATE INDEX IF NOT EXISTS "Task_dueAt_idx"                  ON "Task"("dueAt");
CREATE INDEX IF NOT EXISTS "TaskAssignee_userId_idx"         ON "TaskAssignee"("userId");
CREATE INDEX IF NOT EXISTS "TaskChecklist_taskId_idx"        ON "TaskChecklist"("taskId");
CREATE INDEX IF NOT EXISTS "TaskChecklistItem_checklistId_idx" ON "TaskChecklistItem"("checklistId");

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey"
    FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskChecklist" ADD CONSTRAINT "TaskChecklist_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_checklistId_fkey"
    FOREIGN KEY ("checklistId") REFERENCES "TaskChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "Permission" (slug, scope, resource, action, description, "isSystem")
VALUES
  ('tenant:tasks:view',             'tenant', 'tasks', 'view',             'View tasks',                       true),
  ('tenant:tasks:create',           'tenant', 'tasks', 'create',           'Create tasks',                     true),
  ('tenant:tasks:update',           'tenant', 'tasks', 'update',           'Update tasks',                     true),
  ('tenant:tasks:delete',           'tenant', 'tasks', 'delete',           'Delete tasks',                     true),
  ('tenant:tasks:manage_checklist', 'tenant', 'tasks', 'manage_checklist', 'Manage checklists on tasks',       true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug IN ('owner', 'admin', 'manager')
  AND p.slug IN ('tenant:tasks:view', 'tenant:tasks:create', 'tenant:tasks:update', 'tenant:tasks:delete', 'tenant:tasks:manage_checklist')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug = 'staff'
  AND p.slug IN ('tenant:tasks:view', 'tenant:tasks:create', 'tenant:tasks:update', 'tenant:tasks:manage_checklist')
ON CONFLICT DO NOTHING;
`;
