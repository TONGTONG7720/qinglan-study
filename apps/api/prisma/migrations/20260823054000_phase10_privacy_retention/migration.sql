-- CreateEnum
CREATE TYPE "FamilyExportStatus" AS ENUM ('READY', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeletionRequestType" AS ENUM ('PERSONAL_GUARDIAN', 'FAMILY');

-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RetentionJobKind" AS ENUM ('TEMP_OBJECT_PURGE', 'AI_DEBUG_PURGE', 'EXPORT_EXPIRE', 'PERSONAL_PURGE', 'FAMILY_PURGE');

-- CreateEnum
CREATE TYPE "RetentionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "FamilyExportRequest" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "status" "FamilyExportStatus" NOT NULL DEFAULT 'READY',
    "archive" JSONB,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyExportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "targetUserId" UUID,
    "type" "DeletionRequestType" NOT NULL,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "executeAfter" TIMESTAMPTZ(6) NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "lastErrorCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionJob" (
    "id" UUID NOT NULL,
    "kind" "RetentionJobKind" NOT NULL,
    "dedupeKey" VARCHAR(160) NOT NULL,
    "status" "RetentionJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" VARCHAR(120),
    "leaseExpiresAt" TIMESTAMPTZ(6),
    "lastErrorCode" VARCHAR(80),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RetentionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyExportRequest_familyId_status_expiresAt_idx" ON "FamilyExportRequest"("familyId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "DeletionRequest_familyId_type_status_idx" ON "DeletionRequest"("familyId", "type", "status");

-- CreateIndex
CREATE INDEX "DeletionRequest_targetUserId_status_idx" ON "DeletionRequest"("targetUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionJob_dedupeKey_key" ON "RetentionJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "RetentionJob_status_nextRunAt_idx" ON "RetentionJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "RetentionJob_leaseExpiresAt_idx" ON "RetentionJob"("leaseExpiresAt");
-- Privacy request and job-state invariants
ALTER TABLE "FamilyExportRequest"
  ADD CONSTRAINT "FamilyExportRequest_state_check"
  CHECK (("status" = 'READY' AND "archive" IS NOT NULL) OR ("status" IN ('EXPIRED', 'FAILED') AND "archive" IS NULL)),
  ADD CONSTRAINT "FamilyExportRequest_expiry_check"
  CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '7 days');

ALTER TABLE "DeletionRequest"
  ADD CONSTRAINT "DeletionRequest_scope_check"
  CHECK (("type" = 'PERSONAL_GUARDIAN' AND "targetUserId" IS NOT NULL) OR ("type" = 'FAMILY' AND "targetUserId" IS NULL)),
  ADD CONSTRAINT "DeletionRequest_state_check"
  CHECK (("status" = 'PENDING' AND "completedAt" IS NULL) OR ("status" IN ('COMPLETED', 'FAILED') AND "completedAt" IS NOT NULL)),
  ADD CONSTRAINT "DeletionRequest_deadline_check"
  CHECK ("executeAfter" >= "createdAt" AND "executeAfter" <= "createdAt" + INTERVAL '30 days');

CREATE UNIQUE INDEX "DeletionRequest_one_pending_personal"
  ON "DeletionRequest" ("targetUserId")
  WHERE "type" = 'PERSONAL_GUARDIAN' AND "status" = 'PENDING';
CREATE UNIQUE INDEX "DeletionRequest_one_pending_family"
  ON "DeletionRequest" ("familyId")
  WHERE "type" = 'FAMILY' AND "status" = 'PENDING';

ALTER TABLE "RetentionJob"
  ADD CONSTRAINT "RetentionJob_attempt_check" CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "RetentionJob_payload_check" CHECK (jsonb_typeof("payload") = 'object'),
  ADD CONSTRAINT "RetentionJob_lease_check"
  CHECK (("status" = 'RUNNING' AND "leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL) OR ("status" <> 'RUNNING' AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL));
