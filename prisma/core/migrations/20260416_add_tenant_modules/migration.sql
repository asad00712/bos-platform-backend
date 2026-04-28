-- Add ModuleKey enum
CREATE TYPE "public"."ModuleKey" AS ENUM (
  'CONTACTS', 'STAFF', 'BRANCHES', 'ROLES_PERMISSIONS',
  'NOTES_ACTIVITIES', 'DOCUMENTS', 'DEALS_PIPELINE',
  'APPOINTMENTS', 'CALENDAR', 'BILLING', 'INVENTORY',
  'AI_LEADS', 'CAMPAIGNS', 'WORKFLOWS', 'MEDIA_LIBRARY', 'WHATSAPP'
);

-- Add onboarding + profile fields to Tenant
ALTER TABLE "public"."Tenant"
  ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "goals"               TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "businessPhone"        TEXT,
  ADD COLUMN IF NOT EXISTS "businessCity"         TEXT,
  ADD COLUMN IF NOT EXISTS "websiteUrl"           TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl"              TEXT;

-- TenantModule
CREATE TABLE IF NOT EXISTS "public"."TenantModule" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"  UUID        NOT NULL,
  "moduleKey" "public"."ModuleKey" NOT NULL,
  "isEnabled" BOOLEAN     NOT NULL DEFAULT true,
  "config"    JSONB       NOT NULL DEFAULT '{}',
  "enabledAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "enabledBy" UUID,
  CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantModule_tenantId_moduleKey_key" UNIQUE ("tenantId", "moduleKey"),
  CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "public"."Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "TenantModule_tenantId_idx" ON "public"."TenantModule"("tenantId");

-- ModulePreset
CREATE TABLE IF NOT EXISTS "public"."ModulePreset" (
  "id"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "vertical" "public"."VerticalType" NOT NULL,
  "modules"  "public"."ModuleKey"[] NOT NULL DEFAULT '{}',
  CONSTRAINT "ModulePreset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ModulePreset_vertical_key" UNIQUE ("vertical")
);

-- VerticalTerminology
CREATE TABLE IF NOT EXISTS "public"."VerticalTerminology" (
  "id"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "vertical" "public"."VerticalType" NOT NULL,
  "termKey"  TEXT        NOT NULL,
  "singular" TEXT        NOT NULL,
  "plural"   TEXT        NOT NULL,
  "icon"     TEXT,
  CONSTRAINT "VerticalTerminology_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VerticalTerminology_vertical_termKey_key" UNIQUE ("vertical", "termKey")
);
