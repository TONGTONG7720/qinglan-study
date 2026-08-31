-- Existing reviewed-content rows are backfilled below before the new columns
-- become required. Legacy rows remain LICENSE_REVIEW_REQUIRED until re-reviewed.
-- CreateEnum
CREATE TYPE "KnowledgeAbilityLevel" AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE');

-- CreateEnum
CREATE TYPE "QuestionBankType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'CALCULATION', 'EXPERIMENT_DESIGN', 'ERROR_DIAGNOSIS', 'GRAPHING');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('DEFINITION', 'CONCEPT', 'FORMULA', 'EXPERIMENT', 'EXAMPLE', 'ILLUSTRATION', 'SUMMARY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentLicenseStatus" AS ENUM ('AUTHORIZED', 'HOUSEHOLD_PRIVATE', 'PUBLIC_DOMAIN', 'LICENSE_REVIEW_REQUIRED', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "TextbookAssetStatus" AS ENUM ('REGISTERED', 'AVAILABLE', 'QUARANTINED', 'RETIRED');

-- CreateEnum
CREATE TYPE "QuestionBankStatus" AS ENUM ('DRAFT', 'SOLVER_VALIDATED', 'DEDUPLICATED', 'FACT_CHECKED', 'REVIEWED', 'PUBLISHED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "QuestionBankSourceType" AS ENUM ('ORIGINAL_HUMAN', 'ORIGINAL_AI', 'AUTHORIZED_ADAPTATION');

-- CreateEnum
CREATE TYPE "QuestionBankValidationKind" AS ENUM ('AUTO_SOLVE', 'DEDUPLICATION', 'SUBJECT_FACT_CHECK');

-- CreateEnum
CREATE TYPE "QuestionBankValidationStatus" AS ENUM ('PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuestionBankReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- DropIndex
DROP INDEX "ReviewedContent_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "ReviewedContent_subjectCode_textbookEditionId_unitId_status_idx";

-- AlterTable
ALTER TABLE "KnowledgeNode" ADD COLUMN     "abilityLevels" "KnowledgeAbilityLevel"[] DEFAULT ARRAY[]::"KnowledgeAbilityLevel"[],
ADD COLUMN     "commonErrors" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "contentVersion" VARCHAR(40) NOT NULL DEFAULT '1',
ADD COLUMN     "pageEnd" INTEGER,
ADD COLUMN     "pageStart" INTEGER,
ADD COLUMN     "prerequisiteKnowledge" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "questionTypes" "QuestionBankType"[] DEFAULT ARRAY[]::"QuestionBankType"[];

ALTER TABLE "KnowledgeNode"
ADD CONSTRAINT "KnowledgeNode_page_range_check"
CHECK (("pageStart" IS NULL AND "pageEnd" IS NULL) OR ("pageStart" > 0 AND "pageEnd" >= "pageStart"));

-- AlterTable
ALTER TABLE "ReviewedContent" ADD COLUMN     "contentType" "ContentType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "contentVersion" VARCHAR(40) NOT NULL DEFAULT '1',
ADD COLUMN     "knowledgeNodeId" UUID,
ADD COLUMN     "licenseStatus" "ContentLicenseStatus" NOT NULL DEFAULT 'LICENSE_REVIEW_REQUIRED',
ADD COLUMN     "pageEnd" INTEGER,
ADD COLUMN     "pageStart" INTEGER,
ADD COLUMN     "sourceHash" CHAR(64),
ADD COLUMN     "textbookAssetId" UUID;

UPDATE "ReviewedContent" AS reviewed
SET
  "knowledgeNodeId" = (
    SELECT node."id"
    FROM "KnowledgeNode" AS node
    WHERE node."unitId" = reviewed."unitId"
    ORDER BY node."createdAt", node."id"
    LIMIT 1
  ),
  "pageStart" = 1,
  "pageEnd" = 1,
  "sourceHash" = md5(reviewed."sourceReference" || E'\n' || reviewed."excerpt")
    || md5('legacy:' || reviewed."sourceReference" || E'\n' || reviewed."excerpt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ReviewedContent"
    WHERE "knowledgeNodeId" IS NULL OR "pageStart" IS NULL OR "pageEnd" IS NULL OR "sourceHash" IS NULL
  ) THEN
    RAISE EXCEPTION 'Unable to backfill legacy ReviewedContent safely';
  END IF;
END $$;

ALTER TABLE "ReviewedContent"
ALTER COLUMN "knowledgeNodeId" SET NOT NULL,
ALTER COLUMN "pageStart" SET NOT NULL,
ALTER COLUMN "pageEnd" SET NOT NULL,
ALTER COLUMN "sourceHash" SET NOT NULL,
ADD CONSTRAINT "ReviewedContent_page_range_check" CHECK ("pageStart" > 0 AND "pageEnd" >= "pageStart");

-- CreateTable
CREATE TABLE "TextbookAsset" (
    "id" UUID NOT NULL,
    "textbookEditionId" UUID NOT NULL,
    "objectKey" VARCHAR(300) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "licenseStatus" "ContentLicenseStatus" NOT NULL,
    "licenseReference" VARCHAR(500) NOT NULL,
    "sourceVersion" VARCHAR(80) NOT NULL,
    "status" "TextbookAssetStatus" NOT NULL DEFAULT 'REGISTERED',
    "scanPassed" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" UUID NOT NULL,
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TextbookAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TextbookAsset"
ADD CONSTRAINT "TextbookAsset_private_pdf_check"
CHECK (
  "mimeType" = 'application/pdf'
  AND "sizeBytes" > 0
  AND "pageCount" > 0
  AND "objectKey" NOT LIKE '%://%'
  AND "objectKey" LIKE 'textbooks/%'
);

-- CreateTable
CREATE TABLE "QuestionBankItem" (
    "id" UUID NOT NULL,
    "stableKey" VARCHAR(120) NOT NULL,
    "subjectCode" "SubjectCode" NOT NULL,
    "grade" INTEGER NOT NULL,
    "textbookEditionId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "type" "QuestionBankType" NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "abilityLevel" "KnowledgeAbilityLevel" NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "answer" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "hints" JSONB NOT NULL,
    "commonErrorTargets" JSONB NOT NULL DEFAULT '[]',
    "sourceType" "QuestionBankSourceType" NOT NULL,
    "licenseStatus" "ContentLicenseStatus" NOT NULL,
    "sourceReferences" JSONB NOT NULL DEFAULT '[]',
    "generationModel" VARCHAR(120),
    "promptVersion" VARCHAR(80),
    "contentHash" CHAR(64) NOT NULL,
    "dedupeHash" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuestionBankStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID NOT NULL,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuestionBankItem"
ADD CONSTRAINT "QuestionBankItem_grade_difficulty_version_check"
CHECK ("grade" BETWEEN 7 AND 9 AND "difficulty" BETWEEN 1 AND 5 AND "version" > 0);

-- CreateTable
CREATE TABLE "QuestionBankItemKnowledgeNode" (
    "questionBankItemId" UUID NOT NULL,
    "knowledgeNodeId" UUID NOT NULL,

    CONSTRAINT "QuestionBankItemKnowledgeNode_pkey" PRIMARY KEY ("questionBankItemId","knowledgeNodeId")
);

-- CreateTable
CREATE TABLE "QuestionBankValidation" (
    "id" UUID NOT NULL,
    "questionBankItemId" UUID NOT NULL,
    "kind" "QuestionBankValidationKind" NOT NULL,
    "status" "QuestionBankValidationStatus" NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBankReview" (
    "id" UUID NOT NULL,
    "questionBankItemId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "decision" "QuestionBankReviewDecision" NOT NULL,
    "comment" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TextbookAsset_objectKey_key" ON "TextbookAsset"("objectKey");

-- CreateIndex
CREATE INDEX "TextbookAsset_textbookEditionId_status_idx" ON "TextbookAsset"("textbookEditionId", "status");

-- CreateIndex
CREATE INDEX "TextbookAsset_sha256_idx" ON "TextbookAsset"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBankItem_stableKey_key" ON "QuestionBankItem"("stableKey");

-- CreateIndex
CREATE INDEX "QuestionBankItem_subjectCode_grade_textbookEditionId_unitId_idx" ON "QuestionBankItem"("subjectCode", "grade", "textbookEditionId", "unitId", "status");

-- CreateIndex
CREATE INDEX "QuestionBankItem_dedupeHash_status_idx" ON "QuestionBankItem"("dedupeHash", "status");

-- CreateIndex
CREATE INDEX "QuestionBankItemKnowledgeNode_knowledgeNodeId_questionBankI_idx" ON "QuestionBankItemKnowledgeNode"("knowledgeNodeId", "questionBankItemId");

-- CreateIndex
CREATE INDEX "QuestionBankValidation_questionBankItemId_kind_createdAt_idx" ON "QuestionBankValidation"("questionBankItemId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionBankReview_questionBankItemId_createdAt_idx" ON "QuestionBankReview"("questionBankItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewedContent_subjectCode_textbookEditionId_unitId_knowle_idx" ON "ReviewedContent"("subjectCode", "textbookEditionId", "unitId", "knowledgeNodeId", "status");

-- CreateIndex
CREATE INDEX "ReviewedContent_textbookAssetId_pageStart_pageEnd_idx" ON "ReviewedContent"("textbookAssetId", "pageStart", "pageEnd");

-- Prisma cannot express the pgvector HNSW index, so preserve it explicitly.
CREATE INDEX "ReviewedContent_embedding_hnsw_idx" ON "ReviewedContent" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "TextbookAsset" ADD CONSTRAINT "TextbookAsset_textbookEditionId_fkey" FOREIGN KEY ("textbookEditionId") REFERENCES "TextbookEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextbookAsset" ADD CONSTRAINT "TextbookAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextbookAsset" ADD CONSTRAINT "TextbookAsset_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewedContent" ADD CONSTRAINT "ReviewedContent_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewedContent" ADD CONSTRAINT "ReviewedContent_textbookAssetId_fkey" FOREIGN KEY ("textbookAssetId") REFERENCES "TextbookAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_textbookEditionId_fkey" FOREIGN KEY ("textbookEditionId") REFERENCES "TextbookEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItemKnowledgeNode" ADD CONSTRAINT "QuestionBankItemKnowledgeNode_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItemKnowledgeNode" ADD CONSTRAINT "QuestionBankItemKnowledgeNode_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankValidation" ADD CONSTRAINT "QuestionBankValidation_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankReview" ADD CONSTRAINT "QuestionBankReview_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankReview" ADD CONSTRAINT "QuestionBankReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
