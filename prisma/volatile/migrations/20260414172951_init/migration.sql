-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "campaign";

-- CreateTable
CREATE TABLE "audit"."AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "actorUserId" UUID,
    "actorIp" TEXT,
    "actorUserAgent" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" UUID,
    "beforeState" JSONB,
    "afterState" JSONB,
    "metadata" JSONB,
    "correlationId" UUID NOT NULL,
    "causationId" UUID,
    "impersonatedByUserId" UUID,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign"."CampaignRecipient" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "contactId" UUID,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorReason" TEXT,
    "batchIndex" INTEGER NOT NULL,
    "sentAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "failedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign"."CampaignEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "recipientId" UUID,
    "eventType" TEXT NOT NULL,
    "linkUrl" TEXT,
    "bounceType" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_occurredAt_idx" ON "audit"."AuditLog"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "audit"."AuditLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "audit"."AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "audit"."AuditLog"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "audit"."AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "CampaignRecipient_tenantId_campaignId_status_idx" ON "campaign"."CampaignRecipient"("tenantId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignRecipient_tenantId_createdAt_idx" ON "campaign"."CampaignRecipient"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "campaign"."CampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignEvent_tenantId_campaignId_occurredAt_idx" ON "campaign"."CampaignEvent"("tenantId", "campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "CampaignEvent_tenantId_campaignId_eventType_idx" ON "campaign"."CampaignEvent"("tenantId", "campaignId", "eventType");

-- CreateIndex
CREATE INDEX "CampaignEvent_recipientId_idx" ON "campaign"."CampaignEvent"("recipientId");

-- CreateIndex
CREATE INDEX "CampaignEvent_eventType_occurredAt_idx" ON "campaign"."CampaignEvent"("eventType", "occurredAt");

-- AddForeignKey
ALTER TABLE "campaign"."CampaignEvent" ADD CONSTRAINT "CampaignEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "campaign"."CampaignRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
