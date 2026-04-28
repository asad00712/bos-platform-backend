/**
 * Incremental migration — adds the LeadActivity table and supporting enums,
 * plus three denorm columns on Lead (lastActivityAt, nextFollowUpAt, touchpointCount).
 *
 * Applied to existing tenant schemas via:
 *   POST /dev/run-tenant-migration  { "key": "lead_activities" }
 *
 * All statements are idempotent — safe to re-run.
 */
export const LEAD_ACTIVITIES_MIGRATION_SQL = `
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastActivityAt"  TIMESTAMPTZ;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMPTZ;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "touchpointCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");

DO $$ BEGIN
  CREATE TYPE "LeadActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'SMS', 'WHATSAPP', 'MEETING', 'TASK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ActivityDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CallOutcome" AS ENUM ('SPOKE', 'NO_ANSWER', 'VOICEMAIL', 'BUSY', 'WRONG_NUMBER', 'CALL_BACK_REQUESTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ActivityTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LeadActivity" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "leadId"           UUID NOT NULL,
    "type"             "LeadActivityType" NOT NULL,
    "direction"        "ActivityDirection",
    "subject"          TEXT,
    "body"             TEXT,
    "outcome"          "CallOutcome",
    "durationSeconds"  INTEGER,
    "recordingUrl"     TEXT,
    "transcriptUrl"    TEXT,
    "scheduledAt"      TIMESTAMPTZ,
    "completedAt"      TIMESTAMPTZ,
    "dueAt"            TIMESTAMPTZ,
    "taskStatus"       "ActivityTaskStatus",
    "createdByUserId"  UUID NOT NULL,
    "assignedToUserId" UUID,
    "metadata"         JSONB,
    "deletedAt"        TIMESTAMPTZ,
    "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ NOT NULL,
    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadActivity_assignedToUserId_dueAt_idx" ON "LeadActivity"("assignedToUserId", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadActivity_type_leadId_idx" ON "LeadActivity"("type", "leadId");
CREATE INDEX IF NOT EXISTS "LeadActivity_taskStatus_assignedToUserId_idx" ON "LeadActivity"("taskStatus", "assignedToUserId");

DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "Permission" (slug, scope, resource, action, description, "isSystem")
VALUES
  ('tenant:leads:log_activity', 'tenant', 'leads', 'log_activity', 'Create, update, and delete lead activity entries', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug IN ('owner', 'admin', 'manager')
  AND p.slug = 'tenant:leads:log_activity'
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug = 'staff'
  AND p.slug = 'tenant:leads:log_activity'
ON CONFLICT DO NOTHING;
`;
