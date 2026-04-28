-- Custom Fields migration for all tenant schemas
-- Run once for each schema:
--   SET search_path TO "tenant_xxxx", public;
--   \i this_file.sql

DO $$ BEGIN
  CREATE TYPE "CustomFieldEntityType" AS ENUM ('CONTACT', 'DEAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'PHONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CustomFieldDefinition" (
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

CREATE TABLE IF NOT EXISTS "CustomFieldValue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "definitionId" UUID NOT NULL,
    "entityType" "CustomFieldEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomFieldDefinition_entityType_key_key" ON "CustomFieldDefinition"("entityType", "key");
CREATE INDEX IF NOT EXISTS "CustomFieldDefinition_entityType_isActive_idx" ON "CustomFieldDefinition"("entityType", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomFieldValue_definitionId_entityId_key" ON "CustomFieldValue"("definitionId", "entityId");
CREATE INDEX IF NOT EXISTS "CustomFieldValue_entityType_entityId_idx" ON "CustomFieldValue"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "CustomFieldValue_definitionId_idx" ON "CustomFieldValue"("definitionId");

DO $$ BEGIN
  ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "Permission" (slug, scope, resource, action, description, "isSystem")
VALUES ('tenant:custom_fields:manage', 'tenant', 'custom_fields', 'manage', 'Create and manage custom field definitions', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r, "Permission" p
WHERE r.slug IN ('owner', 'admin') AND p.slug = 'tenant:custom_fields:manage'
ON CONFLICT DO NOTHING;
