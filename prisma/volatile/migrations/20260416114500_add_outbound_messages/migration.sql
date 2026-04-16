-- Migration: add messaging schema + OutboundMessage table
-- Platform-internal tracking of every outbound email/SMS/push.
-- Retention: 90 days (purged by scheduled cron job).

CREATE SCHEMA IF NOT EXISTS "messaging";

CREATE TYPE "messaging"."MessageChannel" AS ENUM ('email', 'sms', 'push');
CREATE TYPE "messaging"."MessageType"    AS ENUM ('transactional', 'campaign', 'notification');
CREATE TYPE "messaging"."MessageStatus"  AS ENUM ('queued', 'sending', 'sent', 'failed', 'cancelled');

CREATE TABLE "messaging"."OutboundMessage" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"            UUID,
  "channel"             "messaging"."MessageChannel"  NOT NULL DEFAULT 'email',
  "messageType"         "messaging"."MessageType"     NOT NULL,
  "recipientEmail"      TEXT,
  "recipientPhone"      TEXT,
  "subject"             TEXT,
  "templateId"          TEXT        NOT NULL,
  "templateData"        JSONB       NOT NULL DEFAULT '{}',
  "status"              "messaging"."MessageStatus"   NOT NULL DEFAULT 'queued',
  "providerId"          TEXT,
  "errorMessage"        TEXT,
  "retryCount"          INTEGER     NOT NULL DEFAULT 0,
  "triggeredByUserId"   UUID,
  "correlationId"       TEXT,
  "scheduledAt"         TIMESTAMPTZ,
  "sentAt"              TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboundMessage_tenantId_createdAt_idx"       ON "messaging"."OutboundMessage" ("tenantId", "createdAt");
CREATE INDEX "OutboundMessage_status_createdAt_idx"         ON "messaging"."OutboundMessage" ("status", "createdAt");
CREATE INDEX "OutboundMessage_templateId_createdAt_idx"     ON "messaging"."OutboundMessage" ("templateId", "createdAt");
CREATE INDEX "OutboundMessage_triggeredByUserId_createdAt_idx" ON "messaging"."OutboundMessage" ("triggeredByUserId", "createdAt");
