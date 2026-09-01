-- This migration deliberately refuses to reinterpret an already-published legacy
-- item. Such an installation needs an explicit operator-reviewed withdrawal plan.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "QuestionBankItem" WHERE "status" = 'PUBLISHED') THEN
    RAISE EXCEPTION 'Legacy published question-bank items must be withdrawn explicitly before enabling release gates';
  END IF;
END $$;

-- Existing REVIEWED rows do not carry the new independent, semantic, subject,
-- license, and final-review evidence. Return them to the last honest boundary.
UPDATE "QuestionBankItem"
SET
  "status" = 'FACT_CHECKED',
  "reviewedByUserId" = NULL,
  "reviewedAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'REVIEWED';

ALTER TYPE "QuestionBankValidationKind" ADD VALUE 'INDEPENDENT_SOLVE';
ALTER TYPE "QuestionBankValidationKind" ADD VALUE 'SEMANTIC_DEDUPLICATION';
ALTER TYPE "QuestionBankValidationKind" ADD VALUE 'HUMAN_SUBJECT_REVIEW';
ALTER TYPE "QuestionBankValidationKind" ADD VALUE 'LICENSE_REVIEW';
ALTER TYPE "QuestionBankValidationStatus" ADD VALUE 'PENDING' BEFORE 'PASSED';

CREATE TYPE "QuestionBankSemanticDuplicateDecision" AS ENUM ('PENDING', 'DISTINCT', 'DUPLICATE');
CREATE TYPE "QuestionBankReleaseStatus" AS ENUM ('ACTIVE', 'ROLLED_BACK');

ALTER TABLE "QuestionBankItem"
ADD COLUMN "semanticEmbedding" vector,
ADD COLUMN "semanticEmbeddingModel" VARCHAR(120),
ADD COLUMN "semanticEmbeddingDimensions" INTEGER,
ADD COLUMN "semanticSourceHash" CHAR(64),
ADD COLUMN "semanticEmbeddingHash" CHAR(64),
ADD COLUMN "semanticEmbeddedAt" TIMESTAMPTZ(6),
ADD COLUMN "retiredAt" TIMESTAMPTZ(6),
ADD COLUMN "retirementReason" VARCHAR(1000);

ALTER TABLE "QuestionBankItem"
ADD CONSTRAINT "QuestionBankItem_semantic_embedding_metadata_check"
CHECK (
  (
    "semanticEmbedding" IS NULL
    AND "semanticEmbeddingModel" IS NULL
    AND "semanticEmbeddingDimensions" IS NULL
    AND "semanticSourceHash" IS NULL
    AND "semanticEmbeddingHash" IS NULL
    AND "semanticEmbeddedAt" IS NULL
  )
  OR
  (
    "semanticEmbedding" IS NOT NULL
    AND "semanticEmbeddingModel" IS NOT NULL
    AND "semanticEmbeddingDimensions" BETWEEN 8 AND 4096
    AND vector_dims("semanticEmbedding") = "semanticEmbeddingDimensions"
    AND "semanticSourceHash" IS NOT NULL
    AND "semanticEmbeddingHash" IS NOT NULL
    AND "semanticEmbeddedAt" IS NOT NULL
  )
),
ADD CONSTRAINT "QuestionBankItem_retirement_metadata_check"
CHECK (
  ("status" <> 'RETIRED' AND "retiredAt" IS NULL AND "retirementReason" IS NULL)
  OR
  ("status" = 'RETIRED' AND "retiredAt" IS NOT NULL AND "retirementReason" IS NOT NULL)
);

ALTER TABLE "QuestionBankValidation"
ADD COLUMN "contentHash" CHAR(64),
ADD COLUMN "performedByUserId" UUID;

UPDATE "QuestionBankValidation" AS validation
SET "contentHash" = item."contentHash"
FROM "QuestionBankItem" AS item
WHERE item."id" = validation."questionBankItemId";

ALTER TABLE "QuestionBankValidation"
ALTER COLUMN "contentHash" SET NOT NULL;

ALTER TABLE "QuestionBankReview"
ADD COLUMN "contentHash" CHAR(64),
ADD COLUMN "attestation" VARCHAR(80);

UPDATE "QuestionBankReview" AS review
SET
  "contentHash" = item."contentHash",
  "attestation" = 'LEGACY_UNVERIFIED_REVIEW'
FROM "QuestionBankItem" AS item
WHERE item."id" = review."questionBankItemId";

ALTER TABLE "QuestionBankReview"
ALTER COLUMN "contentHash" SET NOT NULL,
ALTER COLUMN "attestation" SET NOT NULL;

CREATE TABLE "QuestionBankSemanticDuplicate" (
  "id" UUID NOT NULL,
  "questionBankItemId" UUID NOT NULL,
  "candidateItemId" UUID NOT NULL,
  "contentHash" CHAR(64) NOT NULL,
  "candidateContentHash" CHAR(64) NOT NULL,
  "embeddingModel" VARCHAR(120) NOT NULL,
  "similarity" DOUBLE PRECISION NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "decision" "QuestionBankSemanticDuplicateDecision" NOT NULL DEFAULT 'PENDING',
  "reviewerUserId" UUID,
  "comment" VARCHAR(1000),
  "attestation" VARCHAR(80),
  "reviewedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "QuestionBankSemanticDuplicate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionBankSemanticDuplicate_pair_check" CHECK ("questionBankItemId" <> "candidateItemId"),
  CONSTRAINT "QuestionBankSemanticDuplicate_score_check" CHECK ("similarity" BETWEEN -1 AND 1 AND "threshold" BETWEEN 0 AND 1),
  CONSTRAINT "QuestionBankSemanticDuplicate_review_check" CHECK (
    ("decision" = 'PENDING' AND "reviewerUserId" IS NULL AND "comment" IS NULL AND "attestation" IS NULL AND "reviewedAt" IS NULL)
    OR
    ("decision" <> 'PENDING' AND "reviewerUserId" IS NOT NULL AND "comment" IS NOT NULL AND "attestation" = 'HUMAN_SEMANTIC_DUPLICATE_REVIEW_COMPLETED' AND "reviewedAt" IS NOT NULL)
  )
);

CREATE TABLE "QuestionBankLicenseReview" (
  "id" UUID NOT NULL,
  "questionBankItemId" UUID NOT NULL,
  "reviewerUserId" UUID NOT NULL,
  "contentHash" CHAR(64) NOT NULL,
  "decision" "ContentLicenseStatus" NOT NULL,
  "basis" VARCHAR(2000) NOT NULL,
  "evidenceReference" VARCHAR(500) NOT NULL,
  "evidenceSha256" CHAR(64) NOT NULL,
  "reviewerReference" VARCHAR(120) NOT NULL,
  "attestation" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuestionBankLicenseReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionBankLicenseReview_decision_check" CHECK ("decision" IN ('AUTHORIZED', 'PUBLIC_DOMAIN', 'PROHIBITED')),
  CONSTRAINT "QuestionBankLicenseReview_attestation_check" CHECK ("attestation" = 'HUMAN_LICENSE_REVIEW_COMPLETED')
);

CREATE TABLE "QuestionBankRelease" (
  "id" UUID NOT NULL,
  "questionBankItemId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "contentHash" CHAR(64) NOT NULL,
  "gateEvidenceHash" CHAR(64) NOT NULL,
  "status" "QuestionBankReleaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "publishedByUserId" UUID NOT NULL,
  "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rolledBackByUserId" UUID,
  "rolledBackAt" TIMESTAMPTZ(6),
  "rollbackReason" VARCHAR(1000),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "QuestionBankRelease_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionBankRelease_version_check" CHECK ("version" > 0),
  CONSTRAINT "QuestionBankRelease_rollback_check" CHECK (
    ("status" = 'ACTIVE' AND "rolledBackByUserId" IS NULL AND "rolledBackAt" IS NULL AND "rollbackReason" IS NULL)
    OR
    ("status" = 'ROLLED_BACK' AND "rolledBackByUserId" IS NOT NULL AND "rolledBackAt" IS NOT NULL AND "rollbackReason" IS NOT NULL)
  )
);

DROP INDEX "QuestionBankValidation_questionBankItemId_kind_createdAt_idx";

CREATE INDEX "QuestionBankValidation_item_content_kind_created_idx"
ON "QuestionBankValidation"("questionBankItemId", "contentHash", "kind", "createdAt");

CREATE UNIQUE INDEX "QuestionBankSemanticDuplicate_pair_content_model_key"
ON "QuestionBankSemanticDuplicate"("questionBankItemId", "candidateItemId", "contentHash", "candidateContentHash", "embeddingModel");

CREATE INDEX "QuestionBankSemanticDuplicate_source_decision_idx"
ON "QuestionBankSemanticDuplicate"("questionBankItemId", "contentHash", "embeddingModel", "decision");

CREATE INDEX "QuestionBankSemanticDuplicate_candidate_content_idx"
ON "QuestionBankSemanticDuplicate"("candidateItemId", "candidateContentHash");

CREATE INDEX "QuestionBankLicenseReview_item_content_created_idx"
ON "QuestionBankLicenseReview"("questionBankItemId", "contentHash", "createdAt");

CREATE UNIQUE INDEX "QuestionBankRelease_item_version_key"
ON "QuestionBankRelease"("questionBankItemId", "version");

CREATE INDEX "QuestionBankRelease_status_publishedAt_idx"
ON "QuestionBankRelease"("status", "publishedAt");

ALTER TABLE "QuestionBankValidation"
ADD CONSTRAINT "QuestionBankValidation_performedByUserId_fkey"
FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuestionBankSemanticDuplicate"
ADD CONSTRAINT "QuestionBankSemanticDuplicate_questionBankItemId_fkey"
FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "QuestionBankSemanticDuplicate_candidateItemId_fkey"
FOREIGN KEY ("candidateItemId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "QuestionBankSemanticDuplicate_reviewerUserId_fkey"
FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuestionBankLicenseReview"
ADD CONSTRAINT "QuestionBankLicenseReview_questionBankItemId_fkey"
FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "QuestionBankLicenseReview_reviewerUserId_fkey"
FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuestionBankRelease"
ADD CONSTRAINT "QuestionBankRelease_questionBankItemId_fkey"
FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "QuestionBankRelease_publishedByUserId_fkey"
FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "QuestionBankRelease_rolledBackByUserId_fkey"
FOREIGN KEY ("rolledBackByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
