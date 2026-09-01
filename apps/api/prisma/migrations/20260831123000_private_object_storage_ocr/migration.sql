-- Replace the private-object enum so every new state is available atomically.
ALTER TYPE "PrivateObjectStatus" RENAME TO "PrivateObjectStatus_legacy";
CREATE TYPE "PrivateObjectStatus" AS ENUM (
  'PENDING_UPLOAD',
  'VERIFYING',
  'READY',
  'QUARANTINED',
  'DELETE_PENDING',
  'DELETE_FAILED',
  'DELETED'
);
ALTER TABLE "PrivateObject" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PrivateObject"
  ALTER COLUMN "status" TYPE "PrivateObjectStatus"
  USING ("status"::text::"PrivateObjectStatus");
DROP TYPE "PrivateObjectStatus_legacy";
ALTER TABLE "PrivateObject" ALTER COLUMN "status" SET DEFAULT 'PENDING_UPLOAD';

CREATE TYPE "ObjectScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

ALTER TABLE "PrivateObject"
  ADD COLUMN "dedupeKey" CHAR(64),
  ADD COLUMN "uploadKey" VARCHAR(240),
  ADD COLUMN "scanStatus" "ObjectScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "uploadExpiresAt" TIMESTAMPTZ(6),
  ADD COLUMN "uploadedAt" TIMESTAMPTZ(6),
  ADD COLUMN "verifiedAt" TIMESTAMPTZ(6),
  ADD COLUMN "scanCompletedAt" TIMESTAMPTZ(6),
  ADD COLUMN "storageVersionId" VARCHAR(255),
  ADD COLUMN "storageETag" VARCHAR(255),
  ADD COLUMN "lastErrorCode" VARCHAR(80),
  ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
  ADD COLUMN "deletionReceipt" JSONB,
  ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "PrivateObject"
SET
  "dedupeKey" = md5("id"::text) || md5("storageKey"),
  "status" = 'QUARANTINED',
  "scanStatus" = 'FAILED',
  "scanPassed" = false,
  "scanCompletedAt" = CURRENT_TIMESTAMP,
  "lastErrorCode" = 'LEGACY_OBJECT_UNVERIFIED',
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "PrivateObject" ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX "PrivateObject_dedupeKey_key" ON "PrivateObject"("dedupeKey");
CREATE UNIQUE INDEX "PrivateObject_uploadKey_key" ON "PrivateObject"("uploadKey");
CREATE INDEX "PrivateObject_ownerStudentUserId_status_expiresAt_idx"
  ON "PrivateObject"("ownerStudentUserId", "status", "expiresAt");
CREATE INDEX "PrivateObject_status_uploadExpiresAt_idx"
  ON "PrivateObject"("status", "uploadExpiresAt");

ALTER TABLE "PrivateObject"
  ADD CONSTRAINT "PrivateObject_upload_window_check"
  CHECK (
    ("status" IN ('PENDING_UPLOAD', 'VERIFYING') AND "uploadKey" IS NOT NULL AND "uploadExpiresAt" IS NOT NULL)
    OR "status" NOT IN ('PENDING_UPLOAD', 'VERIFYING')
  ),
  ADD CONSTRAINT "PrivateObject_state_check"
  CHECK (
    ("status" = 'PENDING_UPLOAD' AND "verifiedAt" IS NULL AND "scanStatus" = 'PENDING' AND "scanPassed" = false AND "deletedAt" IS NULL)
    OR ("status" = 'VERIFYING' AND "verifiedAt" IS NULL AND "scanStatus" = 'PENDING' AND "scanPassed" = false AND "deletedAt" IS NULL)
    OR ("status" = 'READY' AND "verifiedAt" IS NOT NULL AND "scanStatus" = 'CLEAN' AND "scanPassed" = true AND "storageETag" IS NOT NULL AND "deletedAt" IS NULL)
    OR ("status" = 'QUARANTINED' AND "scanStatus" IN ('INFECTED', 'FAILED') AND "scanPassed" = false AND "deletedAt" IS NULL)
    OR ("status" IN ('DELETE_PENDING', 'DELETE_FAILED') AND "deletedAt" IS NULL)
    OR ("status" = 'DELETED' AND "deletedAt" IS NOT NULL AND "deletionReceipt" IS NOT NULL)
  ),
  ADD CONSTRAINT "PrivateObject_deletion_receipt_check"
  CHECK ("deletionReceipt" IS NULL OR jsonb_typeof("deletionReceipt") = 'object');

ALTER TABLE "Question"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMPTZ(6);

UPDATE "Question"
SET "attemptCount" = CASE WHEN "status" = 'UPLOADING' THEN 0 ELSE 1 END,
    "lastAttemptAt" = CASE WHEN "status" = 'UPLOADING' THEN NULL ELSE "updatedAt" END;

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_attempt_count_check" CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "Question_attempt_state_check"
  CHECK (("attemptCount" = 0 AND "lastAttemptAt" IS NULL) OR ("attemptCount" > 0 AND "lastAttemptAt" IS NOT NULL));
