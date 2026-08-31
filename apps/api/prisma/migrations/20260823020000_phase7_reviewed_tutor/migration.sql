-- CreateEnum
CREATE TYPE "ReviewedContentStatus" AS ENUM ('DRAFT', 'REVIEWED', 'RETIRED');

-- CreateTable
CREATE TABLE "ReviewedContent" (
    "id" UUID NOT NULL,
    "subjectCode" "SubjectCode" NOT NULL,
    "textbookEditionId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "excerpt" VARCHAR(2000) NOT NULL,
    "sourceReference" VARCHAR(500) NOT NULL,
    "status" "ReviewedContentStatus" NOT NULL DEFAULT 'DRAFT',
    "embedding" vector(3),
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorSession" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "subjectCode" "SubjectCode" NOT NULL,
    "textbookEditionId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "stage" VARCHAR(40) NOT NULL,
    "promptVersion" VARCHAR(40) NOT NULL,
    "questionText" VARCHAR(5000) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TutorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorStep" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "stage" VARCHAR(40) NOT NULL,
    "action" VARCHAR(40),
    "content" VARCHAR(5000),
    "response" VARCHAR(5000) NOT NULL,
    "evidenceIds" JSONB NOT NULL,
    "modelCallId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ReviewedContentToTutorStep" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ReviewedContentToTutorStep_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ReviewedContent_subjectCode_textbookEditionId_unitId_status_idx" ON "ReviewedContent"("subjectCode", "textbookEditionId", "unitId", "status");

-- CreateIndex
CREATE INDEX "TutorSession_studentUserId_createdAt_idx" ON "TutorSession"("studentUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TutorStep_sessionId_ordinal_key" ON "TutorStep"("sessionId", "ordinal");

-- CreateIndex
CREATE INDEX "_ReviewedContentToTutorStep_B_index" ON "_ReviewedContentToTutorStep"("B");

-- AddForeignKey
ALTER TABLE "ReviewedContent" ADD CONSTRAINT "ReviewedContent_textbookEditionId_fkey" FOREIGN KEY ("textbookEditionId") REFERENCES "TextbookEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewedContent" ADD CONSTRAINT "ReviewedContent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewedContent" ADD CONSTRAINT "ReviewedContent_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorSession" ADD CONSTRAINT "TutorSession_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorStep" ADD CONSTRAINT "TutorStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TutorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReviewedContentToTutorStep" ADD CONSTRAINT "_ReviewedContentToTutorStep_A_fkey" FOREIGN KEY ("A") REFERENCES "ReviewedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReviewedContentToTutorStep" ADD CONSTRAINT "_ReviewedContentToTutorStep_B_fkey" FOREIGN KEY ("B") REFERENCES "TutorStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase7SafetyConstraints
ALTER TABLE "ReviewedContent" ADD CONSTRAINT "ReviewedContent_review_check" CHECK (("status" = 'DRAFT' AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL) OR ("status" IN ('REVIEWED','RETIRED') AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "TutorSession" ADD CONSTRAINT "TutorSession_stage_check" CHECK ("stage" IN ('ASK_ATTEMPT','HINT_ONE','HINT_TWO','EXPLANATION','INDEPENDENT_ANSWER','EVALUATION','COMPLETE','NEEDS_EVIDENCE'));
ALTER TABLE "TutorStep" ADD CONSTRAINT "TutorStep_ordinal_check" CHECK ("ordinal" > 0), ADD CONSTRAINT "TutorStep_evidence_array_check" CHECK (jsonb_typeof("evidenceIds") = 'array');
CREATE INDEX "ReviewedContent_excerpt_fts_idx" ON "ReviewedContent" USING GIN (to_tsvector('simple', "excerpt"));
CREATE INDEX "ReviewedContent_embedding_hnsw_idx" ON "ReviewedContent" USING hnsw ("embedding" vector_cosine_ops);
