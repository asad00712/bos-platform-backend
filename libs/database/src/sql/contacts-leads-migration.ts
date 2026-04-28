/**
 * Incremental migration — adds Tags, ContactSource, LeadStatusConfig,
 * Contact, Lead, ContactList, ContactListMember tables and their enums
 * to an existing tenant schema, plus adds 'LEAD' to CustomFieldEntityType.
 *
 * Applied via TenantSchemaManager.applyMigrationToAllTenants() for tenant
 * schemas provisioned before this DDL was added to TENANT_TEMPLATE_SQL.
 *
 * All statements use IF NOT EXISTS / ON CONFLICT guards so the migration
 * is fully idempotent and safe to re-run.
 */
export const CONTACTS_LEADS_MIGRATION_SQL = `
ALTER TYPE "CustomFieldEntityType" ADD VALUE IF NOT EXISTS 'LEAD';

DO $$ BEGIN
  CREATE TYPE "TagEntityType" AS ENUM ('CONTACT', 'LEAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContactListType" AS ENUM ('STATIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EntityTag" (
    "tagId" UUID NOT NULL,
    "entityType" "TagEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntityTag_pkey" PRIMARY KEY ("tagId","entityType","entityId")
);

CREATE TABLE IF NOT EXISTS "ContactSource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ContactSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadStatusConfig" (
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

CREATE TABLE IF NOT EXISTS "Contact" (
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

CREATE TABLE IF NOT EXISTS "Lead" (
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

CREATE TABLE IF NOT EXISTS "ContactList" (
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

CREATE TABLE IF NOT EXISTS "ContactListMember" (
    "listId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "addedByUserId" UUID,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactListMember_pkey" PRIMARY KEY ("listId","contactId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");
CREATE INDEX IF NOT EXISTS "EntityTag_entityType_entityId_idx" ON "EntityTag"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "EntityTag_tagId_idx" ON "EntityTag"("tagId");
CREATE UNIQUE INDEX IF NOT EXISTS "ContactSource_branchId_name_key" ON "ContactSource"("branchId", "name");
CREATE INDEX IF NOT EXISTS "ContactSource_branchId_isActive_idx" ON "ContactSource"("branchId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadStatusConfig_branchId_name_key" ON "LeadStatusConfig"("branchId", "name");
CREATE INDEX IF NOT EXISTS "LeadStatusConfig_branchId_isActive_idx" ON "LeadStatusConfig"("branchId", "isActive");
CREATE INDEX IF NOT EXISTS "Contact_branchId_status_idx" ON "Contact"("branchId", "status");
CREATE INDEX IF NOT EXISTS "Contact_branchId_deletedAt_idx" ON "Contact"("branchId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Contact_email_idx" ON "Contact"("email");
CREATE INDEX IF NOT EXISTS "Contact_phone_idx" ON "Contact"("phone");
CREATE INDEX IF NOT EXISTS "Contact_sourceId_idx" ON "Contact"("sourceId");
CREATE INDEX IF NOT EXISTS "Contact_ownedByUserId_idx" ON "Contact"("ownedByUserId");
CREATE INDEX IF NOT EXISTS "Lead_branchId_idx" ON "Lead"("branchId");
CREATE INDEX IF NOT EXISTS "Lead_branchId_deletedAt_idx" ON "Lead"("branchId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Lead_contactId_idx" ON "Lead"("contactId");
CREATE INDEX IF NOT EXISTS "Lead_sourceId_idx" ON "Lead"("sourceId");
CREATE INDEX IF NOT EXISTS "Lead_statusId_idx" ON "Lead"("statusId");
CREATE INDEX IF NOT EXISTS "Lead_ownedByUserId_idx" ON "Lead"("ownedByUserId");
CREATE INDEX IF NOT EXISTS "Lead_convertedAt_idx" ON "Lead"("convertedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ContactList_branchId_name_key" ON "ContactList"("branchId", "name");
CREATE INDEX IF NOT EXISTS "ContactList_branchId_isActive_idx" ON "ContactList"("branchId", "isActive");
CREATE INDEX IF NOT EXISTS "ContactListMember_contactId_idx" ON "ContactListMember"("contactId");
CREATE INDEX IF NOT EXISTS "ContactListMember_listId_idx" ON "ContactListMember"("listId");

DO $$ BEGIN
  ALTER TABLE "EntityTag" ADD CONSTRAINT "EntityTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ContactSource" ADD CONSTRAINT "ContactSource_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadStatusConfig" ADD CONSTRAINT "LeadStatusConfig_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Contact" ADD CONSTRAINT "Contact_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Contact" ADD CONSTRAINT "Contact_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "ContactSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "ContactSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_statusId_fkey"
    FOREIGN KEY ("statusId") REFERENCES "LeadStatusConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ContactList" ADD CONSTRAINT "ContactList_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ContactListMember" ADD CONSTRAINT "ContactListMember_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ContactListMember" ADD CONSTRAINT "ContactListMember_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "Permission" (slug, scope, resource, action, description, "isSystem")
VALUES
  ('tenant:leads:delete',         'tenant', 'leads',         'delete',         'Delete leads',                                         true),
  ('tenant:leads:view_all',        'tenant', 'leads',         'view_all',        'View all leads across tenant',                         true),
  ('tenant:leads:view_own',        'tenant', 'leads',         'view_own',        'View leads assigned to me',                            true),
  ('tenant:leads:convert',         'tenant', 'leads',         'convert',         'Convert a lead to a contact',                          true),
  ('tenant:tags:manage',           'tenant', 'tags',          'manage',          'Create, update, and delete tags',                      true),
  ('tenant:contact_lists:manage',  'tenant', 'contact_lists', 'manage',          'Create and manage contact lists',                      true),
  ('tenant:sources:manage',        'tenant', 'sources',       'manage',          'Create and manage contact sources and lead statuses',   true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug IN ('owner', 'admin')
  AND p.slug IN (
    'tenant:leads:delete', 'tenant:leads:view_all', 'tenant:leads:view_own',
    'tenant:leads:convert', 'tenant:tags:manage', 'tenant:contact_lists:manage',
    'tenant:sources:manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug = 'manager'
  AND p.slug IN (
    'tenant:leads:delete', 'tenant:leads:convert',
    'tenant:tags:manage', 'tenant:contact_lists:manage', 'tenant:sources:manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug = 'staff'
  AND p.slug IN (
    'tenant:contacts:update', 'tenant:leads:view_branch',
    'tenant:leads:create', 'tenant:leads:update'
  )
ON CONFLICT DO NOTHING;
`;
