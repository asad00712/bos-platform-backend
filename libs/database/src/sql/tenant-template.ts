/**
 * Tenant schema DDL — generated from prisma/tenant-template/schema.prisma.
 *
 * To regenerate:
 *   pnpm exec prisma migrate diff \
 *     --config=prisma/tenant-template/prisma.config.ts \
 *     --from-empty \
 *     --to-schema prisma/tenant-template/schema.prisma \
 *     --script > libs/database/src/sql/tenant-template.sql
 *
 * Then copy the content into the template literal below (strip the Prisma header comment).
 *
 * Embedded as a TS constant so webpack bundles it correctly — no runtime fs.readFileSync needed.
 */
export const TENANT_TEMPLATE_SQL = `
-- CreateEnum
CREATE TYPE "RoleScopeType" AS ENUM ('tenant', 'branch');

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "parentBranchId" UUID,
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scopeType" "RoleScopeType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "verticalSlug" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserBranchMembership" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "branchId" UUID,
    "roleId" UUID NOT NULL,
    "assignedByUserId" UUID,
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ,
    "revokedReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "UserBranchMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");

-- CreateIndex
CREATE INDEX "Branch_parentBranchId_idx" ON "Branch"("parentBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateIndex
CREATE INDEX "Role_scopeType_isSystem_idx" ON "Role"("scopeType", "isSystem");

-- CreateIndex
CREATE INDEX "Role_verticalSlug_idx" ON "Role"("verticalSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_slug_key" ON "Permission"("slug");

-- CreateIndex
CREATE INDEX "Permission_scope_resource_idx" ON "Permission"("scope", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_scope_resource_action_key" ON "Permission"("scope", "resource", "action");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserBranchMembership_userId_idx" ON "UserBranchMembership"("userId");

-- CreateIndex
CREATE INDEX "UserBranchMembership_branchId_idx" ON "UserBranchMembership"("branchId");

-- CreateIndex
CREATE INDEX "UserBranchMembership_roleId_idx" ON "UserBranchMembership"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranchMembership_userId_branchId_roleId_key" ON "UserBranchMembership"("userId", "branchId", "roleId");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_parentBranchId_fkey" FOREIGN KEY ("parentBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CustomFieldEntityType" AS ENUM ('CONTACT', 'DEAL', 'LEAD');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'PHONE');

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entityType" "CustomFieldEntityType" NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "defaultValue" TEXT,
    "placeholder" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "definitionId" UUID NOT NULL,
    "entityType" "CustomFieldEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_entityType_key_key" ON "CustomFieldDefinition"("entityType", "key");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_entityType_isActive_idx" ON "CustomFieldDefinition"("entityType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_definitionId_entityId_key" ON "CustomFieldValue"("definitionId", "entityId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_entityType_entityId_idx" ON "CustomFieldValue"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CustomFieldValue_definitionId_idx" ON "CustomFieldValue"("definitionId");

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TagEntityType" AS ENUM ('CONTACT', 'LEAD');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ContactListType" AS ENUM ('STATIC');

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityTag" (
    "tagId" UUID NOT NULL,
    "entityType" "TagEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityTag_pkey" PRIMARY KEY ("tagId","entityType","entityId")
);

-- CreateTable
CREATE TABLE "ContactSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ContactSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStatusConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LeadStatusConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "sourceId" UUID,
    "originLeadId" UUID,
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownedByUserId" UUID,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdByUserId" UUID,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "contactId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "sourceId" UUID,
    "statusId" UUID,
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimatedValue" DOUBLE PRECISION,
    "ownedByUserId" UUID,
    "notes" TEXT,
    "convertedAt" TIMESTAMPTZ,
    "convertedByUserId" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdByUserId" UUID,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactList" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "listType" "ContactListType" NOT NULL DEFAULT 'STATIC',
    "createdByUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ContactList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactListMember" (
    "listId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "addedByUserId" UUID,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactListMember_pkey" PRIMARY KEY ("listId","contactId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "EntityTag_entityType_entityId_idx" ON "EntityTag"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EntityTag_tagId_idx" ON "EntityTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactSource_branchId_name_key" ON "ContactSource"("branchId", "name");

-- CreateIndex
CREATE INDEX "ContactSource_branchId_isActive_idx" ON "ContactSource"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LeadStatusConfig_branchId_name_key" ON "LeadStatusConfig"("branchId", "name");

-- CreateIndex
CREATE INDEX "LeadStatusConfig_branchId_isActive_idx" ON "LeadStatusConfig"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "Contact_branchId_status_idx" ON "Contact"("branchId", "status");

-- CreateIndex
CREATE INDEX "Contact_branchId_deletedAt_idx" ON "Contact"("branchId", "deletedAt");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Contact_sourceId_idx" ON "Contact"("sourceId");

-- CreateIndex
CREATE INDEX "Contact_ownedByUserId_idx" ON "Contact"("ownedByUserId");

-- CreateIndex
CREATE INDEX "Lead_branchId_idx" ON "Lead"("branchId");

-- CreateIndex
CREATE INDEX "Lead_branchId_deletedAt_idx" ON "Lead"("branchId", "deletedAt");

-- CreateIndex
CREATE INDEX "Lead_contactId_idx" ON "Lead"("contactId");

-- CreateIndex
CREATE INDEX "Lead_sourceId_idx" ON "Lead"("sourceId");

-- CreateIndex
CREATE INDEX "Lead_statusId_idx" ON "Lead"("statusId");

-- CreateIndex
CREATE INDEX "Lead_ownedByUserId_idx" ON "Lead"("ownedByUserId");

-- CreateIndex
CREATE INDEX "Lead_convertedAt_idx" ON "Lead"("convertedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactList_branchId_name_key" ON "ContactList"("branchId", "name");

-- CreateIndex
CREATE INDEX "ContactList_branchId_isActive_idx" ON "ContactList"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "ContactListMember_contactId_idx" ON "ContactListMember"("contactId");

-- CreateIndex
CREATE INDEX "ContactListMember_listId_idx" ON "ContactListMember"("listId");

-- AddForeignKey
ALTER TABLE "EntityTag" ADD CONSTRAINT "EntityTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSource" ADD CONSTRAINT "ContactSource_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStatusConfig" ADD CONSTRAINT "LeadStatusConfig_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContactSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContactSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "LeadStatusConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactList" ADD CONSTRAINT "ContactList_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactListMember" ADD CONSTRAINT "ContactListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactListMember" ADD CONSTRAINT "ContactListMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add roundRobinAvailable to UserBranchMembership
ALTER TABLE "UserBranchMembership" ADD COLUMN IF NOT EXISTS "roundRobinAvailable" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "LeadAssignmentMode" AS ENUM ('ROUND_ROBIN', 'MANUAL');

-- CreateTable
CREATE TABLE "LeadAssignmentConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "assignmentMode" "LeadAssignmentMode" NOT NULL DEFAULT 'ROUND_ROBIN',
    "eligibleRoleIds" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LeadAssignmentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadWebhook" (
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

-- CreateIndex
CREATE UNIQUE INDEX "LeadAssignmentConfig_branchId_key" ON "LeadAssignmentConfig"("branchId");
CREATE UNIQUE INDEX "LeadWebhook_token_key" ON "LeadWebhook"("token");
CREATE INDEX "LeadWebhook_token_idx" ON "LeadWebhook"("token");
CREATE INDEX "LeadWebhook_branchId_idx" ON "LeadWebhook"("branchId");

-- AddForeignKey
ALTER TABLE "LeadAssignmentConfig" ADD CONSTRAINT "LeadAssignmentConfig_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadWebhook" ADD CONSTRAINT "LeadWebhook_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add activity denorm columns to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastActivityAt"  TIMESTAMPTZ;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMPTZ;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "touchpointCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");

-- CreateEnum
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

-- CreateTable
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadActivity_assignedToUserId_dueAt_idx" ON "LeadActivity"("assignedToUserId", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadActivity_type_leadId_idx" ON "LeadActivity"("type", "leadId");
CREATE INDEX IF NOT EXISTS "LeadActivity_taskStatus_assignedToUserId_idx" ON "LeadActivity"("taskStatus", "assignedToUserId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- TASKS
-- =============================================================================

-- CreateEnum
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

-- CreateTable: Task
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

-- CreateTable: TaskAssignee
CREATE TABLE IF NOT EXISTS "TaskAssignee" (
    "taskId"           UUID NOT NULL,
    "userId"           UUID NOT NULL,
    "assignedAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" UUID,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId", "userId")
);

-- CreateTable: TaskChecklist
CREATE TABLE IF NOT EXISTS "TaskChecklist" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "taskId"       UUID NOT NULL,
    "title"        TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TaskChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TaskChecklistItem
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_entityType_entityId_idx" ON "Task"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Task_createdByUserId_idx" ON "Task"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Task_status_dueAt_idx" ON "Task"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "Task_parentTaskId_idx" ON "Task"("parentTaskId");
CREATE INDEX IF NOT EXISTS "Task_dueAt_idx" ON "Task"("dueAt");
CREATE INDEX IF NOT EXISTS "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");
CREATE INDEX IF NOT EXISTS "TaskChecklist_taskId_idx" ON "TaskChecklist"("taskId");
CREATE INDEX IF NOT EXISTS "TaskChecklistItem_checklistId_idx" ON "TaskChecklistItem"("checklistId");

-- AddForeignKey
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
`;
