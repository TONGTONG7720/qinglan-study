-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ExamLossCause" AS ENUM ('KNOWLEDGE_GAP', 'CALCULATION_ERROR', 'MISREAD', 'METHOD_ERROR', 'CARELESS', 'TIME_MANAGEMENT', 'UNANSWERED', 'OTHER');

-- CreateTable
CREATE TABLE "Exam" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "subjectCode" "SubjectCode" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "totalScoreHundredths" INTEGER,
    "totalMaxScoreHundredths" INTEGER,
    "confirmedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamItem" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "scoreHundredths" INTEGER NOT NULL,
    "maxScoreHundredths" INTEGER NOT NULL,
    "knowledgeNodeId" UUID,
    "lossCause" "ExamLossCause",

    CONSTRAINT "ExamItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationLink" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "examItemId" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "priority" INTEGER NOT NULL,
    "evidenceId" UUID,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "summary" JSONB NOT NULL,
    "narrative" VARCHAR(1000) NOT NULL,
    "suggestions" JSONB NOT NULL,
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exam_studentUserId_subjectCode_occurredAt_idx" ON "Exam"("studentUserId", "subjectCode", "occurredAt");

-- CreateIndex
CREATE INDEX "Exam_studentUserId_status_occurredAt_idx" ON "Exam"("studentUserId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "ExamItem_knowledgeNodeId_idx" ON "ExamItem"("knowledgeNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamItem_examId_ordinal_key" ON "ExamItem"("examId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationLink_examItemId_key" ON "RemediationLink"("examItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationLink_evidenceId_key" ON "RemediationLink"("evidenceId");

-- CreateIndex
CREATE INDEX "RemediationLink_studentUserId_completedAt_idx" ON "RemediationLink"("studentUserId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationLink_examId_priority_key" ON "RemediationLink"("examId", "priority");

-- CreateIndex
CREATE INDEX "WeeklyReport_studentUserId_generatedAt_idx" ON "WeeklyReport"("studentUserId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_studentUserId_weekStart_key" ON "WeeklyReport"("studentUserId", "weekStart");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_subjectCode_fkey" FOREIGN KEY ("subjectCode") REFERENCES "Subject"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamItem" ADD CONSTRAINT "ExamItem_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamItem" ADD CONSTRAINT "ExamItem_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationLink" ADD CONSTRAINT "RemediationLink_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationLink" ADD CONSTRAINT "RemediationLink_examItemId_fkey" FOREIGN KEY ("examItemId") REFERENCES "ExamItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationLink" ADD CONSTRAINT "RemediationLink_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationLink" ADD CONSTRAINT "RemediationLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "LearningEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Exam, remediation and aggregate-report invariants
ALTER TABLE "Exam"
  ADD CONSTRAINT "Exam_confirmation_state_check"
  CHECK (
    ("status" = 'DRAFT' AND "confirmedAt" IS NULL AND "totalScoreHundredths" IS NULL AND "totalMaxScoreHundredths" IS NULL)
    OR
    ("status" = 'CONFIRMED' AND "confirmedAt" IS NOT NULL AND "totalScoreHundredths" IS NOT NULL AND "totalMaxScoreHundredths" IS NOT NULL)
  ),
  ADD CONSTRAINT "Exam_confirmed_totals_check"
  CHECK (
    "status" = 'DRAFT'
    OR ("totalScoreHundredths" >= 0 AND "totalMaxScoreHundredths" > 0 AND "totalScoreHundredths" <= "totalMaxScoreHundredths")
  );

ALTER TABLE "ExamItem"
  ADD CONSTRAINT "ExamItem_score_check"
  CHECK ("ordinal" > 0 AND "scoreHundredths" >= 0 AND "maxScoreHundredths" > 0 AND "scoreHundredths" <= "maxScoreHundredths"),
  ADD CONSTRAINT "ExamItem_loss_cause_check"
  CHECK (
    ("scoreHundredths" < "maxScoreHundredths" AND "lossCause" IS NOT NULL)
    OR ("scoreHundredths" = "maxScoreHundredths" AND "lossCause" IS NULL)
  );

ALTER TABLE "RemediationLink"
  ADD CONSTRAINT "RemediationLink_priority_check"
  CHECK ("priority" IN (1, 2)),
  ADD CONSTRAINT "RemediationLink_completion_check"
  CHECK (("evidenceId" IS NULL) = ("completedAt" IS NULL));

ALTER TABLE "WeeklyReport"
  ADD CONSTRAINT "WeeklyReport_week_range_check"
  CHECK ("weekEnd" = "weekStart" + 6),
  ADD CONSTRAINT "WeeklyReport_summary_shape_check"
  CHECK (jsonb_typeof("summary") = 'object'),
  ADD CONSTRAINT "WeeklyReport_suggestions_check"
  CHECK (jsonb_typeof("suggestions") = 'array' AND jsonb_array_length("suggestions") <= 3);

CREATE FUNCTION prevent_confirmed_exam_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'CONFIRMED' AND (
    NEW."studentUserId" IS DISTINCT FROM OLD."studentUserId"
    OR NEW."subjectCode" IS DISTINCT FROM OLD."subjectCode"
    OR NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."occurredAt" IS DISTINCT FROM OLD."occurredAt"
    OR NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."totalScoreHundredths" IS DISTINCT FROM OLD."totalScoreHundredths"
    OR NEW."totalMaxScoreHundredths" IS DISTINCT FROM OLD."totalMaxScoreHundredths"
    OR NEW."confirmedAt" IS DISTINCT FROM OLD."confirmedAt"
  ) THEN
    RAISE EXCEPTION 'confirmed exam fields are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Exam_confirmed_immutable"
BEFORE UPDATE ON "Exam"
FOR EACH ROW EXECUTE FUNCTION prevent_confirmed_exam_update();

CREATE FUNCTION prevent_confirmed_exam_item_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Exam" WHERE "id" = NEW."examId" AND "status" = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'confirmed exam items are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ExamItem_confirmed_immutable"
BEFORE INSERT OR UPDATE ON "ExamItem"
FOR EACH ROW EXECUTE FUNCTION prevent_confirmed_exam_item_write();

CREATE FUNCTION assert_remediation_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ExamItem" item
    JOIN "Exam" exam ON exam."id" = item."examId"
    WHERE item."id" = NEW."examItemId"
      AND exam."id" = NEW."examId"
      AND exam."studentUserId" = NEW."studentUserId"
      AND exam."status" = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'remediation scope mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW."evidenceId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "LearningEvidence"
    WHERE "id" = NEW."evidenceId" AND "studentUserId" = NEW."studentUserId"
  ) THEN
    RAISE EXCEPTION 'remediation evidence mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "RemediationLink_scope_check"
BEFORE INSERT OR UPDATE ON "RemediationLink"
FOR EACH ROW EXECUTE FUNCTION assert_remediation_scope();
