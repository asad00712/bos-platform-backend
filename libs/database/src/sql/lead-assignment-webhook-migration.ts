/**
 * Incremental migration — adds round-robin lead assignment and webhook ingestion
 * infrastructure to existing tenant schemas.
 *
 * Adds:
 *   - UserBranchMembership.roundRobinAvailable (column)
 *   - LeadAssignmentMode enum
 *   - LeadAssignmentConfig table (per-branch assignment config)
 *   - LeadWebhook table (webhook tokens for external lead ingestion)
 *   - New permissions: tenant:leads:configure, tenant:staff:round_robin
 *
 * All statements are idempotent — safe to re-run.
 */
export const LEAD_ASSIGNMENT_WEBHOOK_MIGRATION_SQL = `
ALTER TABLE "UserBranchMembership" ADD COLUMN IF NOT EXISTS "roundRobinAvailable" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  CREATE TYPE "LeadAssignmentMode" AS ENUM ('ROUND_ROBIN', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LeadAssignmentConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "assignmentMode" "LeadAssignmentMode" NOT NULL DEFAULT 'ROUND_ROBIN',
    "eligibleRoleIds" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "LeadAssignmentConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadWebhook" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "sourceId" UUID,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "LeadWebhook_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadAssignmentConfig_branchId_key" ON "LeadAssignmentConfig"("branchId");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadWebhook_token_key" ON "LeadWebhook"("token");
CREATE INDEX IF NOT EXISTS "LeadWebhook_token_idx" ON "LeadWebhook"("token");
CREATE INDEX IF NOT EXISTS "LeadWebhook_branchId_idx" ON "LeadWebhook"("branchId");

DO $$ BEGIN
  ALTER TABLE "LeadAssignmentConfig" ADD CONSTRAINT "LeadAssignmentConfig_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadWebhook" ADD CONSTRAINT "LeadWebhook_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "Permission" (slug, scope, resource, action, description, "isSystem")
VALUES
  ('tenant:leads:configure',   'tenant', 'leads', 'configure',   'Configure lead assignment rules and webhooks', true),
  ('tenant:staff:round_robin', 'tenant', 'staff', 'round_robin', 'Toggle staff round-robin availability',        true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug IN ('owner', 'admin')
  AND p.slug IN ('tenant:leads:configure', 'tenant:staff:round_robin')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug = 'manager'
  AND p.slug IN ('tenant:leads:configure', 'tenant:staff:round_robin')
ON CONFLICT DO NOTHING;
`;
