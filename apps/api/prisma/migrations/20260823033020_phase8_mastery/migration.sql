-- CreateEnum
CREATE TYPE "MistakeCause" AS ENUM ('KNOWLEDGE_GAP', 'CALCULATION_ERROR', 'MISREAD', 'METHOD_ERROR', 'CARELESS', 'ANSWER_SEEKING');

-- CreateEnum
CREATE TYPE "MasteryEvidenceKind" AS ENUM ('INDEPENDENT_ANSWER', 'REVIEW_RESULT', 'EXAM_RESULT');

-- CreateEnum
CREATE TYPE "MasteryEvidenceStatus" AS ENUM ('ACCEPTED', 'REVIEW_REQUIRED');

-- CreateTable
CREATE TABLE "Mistake" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "subjectCode" "SubjectCode" NOT NULL,
    "knowledgeNodeId" UUID,
    "cause" "MistakeCause" NOT NULL,
    "promptSummary" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryAttempt" (
    "id" UUID NOT NULL,
    "mistakeId" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "sourceAttemptId" UUID NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "independent" BOOLEAN NOT NULL,
    "completedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryEvidence" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "subjectCode" "SubjectCode" NOT NULL,
    "knowledgeNodeId" UUID,
    "scopeKey" VARCHAR(80) NOT NULL,
    "sourceAttemptId" UUID NOT NULL,
    "type" "MasteryEvidenceKind" NOT NULL,
    "scoreDelta" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "MasteryEvidenceStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasteryEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryState" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "subjectCode" "SubjectCode" NOT NULL,
    "knowledgeNodeId" UUID,
    "scopeKey" VARCHAR(80) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MasteryState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSchedule" (
    "id" UUID NOT NULL,
    "masteryStateId" UUID NOT NULL,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReviewSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mistake_studentUserId_subjectCode_createdAt_idx" ON "Mistake"("studentUserId", "subjectCode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryAttempt_sourceAttemptId_key" ON "RecoveryAttempt"("sourceAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "MasteryEvidence_sourceAttemptId_key" ON "MasteryEvidence"("sourceAttemptId");

-- CreateIndex
CREATE INDEX "MasteryEvidence_studentUserId_subjectCode_scopeKey_status_c_idx" ON "MasteryEvidence"("studentUserId", "subjectCode", "scopeKey", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MasteryState_studentUserId_nextReviewAt_idx" ON "MasteryState"("studentUserId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "MasteryState_studentUserId_subjectCode_scopeKey_key" ON "MasteryState"("studentUserId", "subjectCode", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSchedule_masteryStateId_key" ON "ReviewSchedule"("masteryStateId");

-- CreateIndex
CREATE INDEX "ReviewSchedule_active_dueAt_idx" ON "ReviewSchedule"("active", "dueAt");

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAttempt" ADD CONSTRAINT "RecoveryAttempt_mistakeId_fkey" FOREIGN KEY ("mistakeId") REFERENCES "Mistake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAttempt" ADD CONSTRAINT "RecoveryAttempt_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAttempt" ADD CONSTRAINT "RecoveryAttempt_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "LearningEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryEvidence" ADD CONSTRAINT "MasteryEvidence_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryEvidence" ADD CONSTRAINT "MasteryEvidence_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryEvidence" ADD CONSTRAINT "MasteryEvidence_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "LearningEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryState" ADD CONSTRAINT "MasteryState_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasteryState" ADD CONSTRAINT "MasteryState_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_masteryStateId_fkey" FOREIGN KEY ("masteryStateId") REFERENCES "MasteryState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Evidence and scheduling invariants
ALTER TABLE "RecoveryAttempt"
    ADD CONSTRAINT "RecoveryAttempt_independent_correct_check"
    CHECK (NOT "correct" OR "independent");

ALTER TABLE "MasteryEvidence"
    ADD CONSTRAINT "MasteryEvidence_delta_check"
    CHECK ("scoreDelta" BETWEEN -20 AND 20),
    ADD CONSTRAINT "MasteryEvidence_confidence_check"
    CHECK ("confidence" BETWEEN 0.5 AND 1);

ALTER TABLE "MasteryState"
    ADD CONSTRAINT "MasteryState_score_check"
    CHECK ("score" BETWEEN 0 AND 100),
    ADD CONSTRAINT "MasteryState_confidence_check"
    CHECK ("confidence" BETWEEN 0 AND 1),
    ADD CONSTRAINT "MasteryState_evidence_count_check"
    CHECK ("evidenceCount" >= 0);

ALTER TABLE "ReviewSchedule"
    ADD CONSTRAINT "ReviewSchedule_interval_check"
    CHECK ("intervalDays" IN (1, 3, 7, 14, 30));
