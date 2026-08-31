CREATE TYPE "PlanCandidateSource" AS ENUM ('OVERDUE_REVIEW', 'EXAM_REMEDIATION', 'CURRENT_UNIT', 'DIAGNOSTIC');
CREATE TYPE "PlanTaskStatus" AS ENUM ('PENDING', 'COMPLETED');
CREATE TYPE "CompletionEvidenceType" AS ENUM ('ANSWER_EVALUATED', 'REVIEW_SUCCEEDED', 'DIAGNOSTIC_COMPLETED', 'RECOVERY_ATTEMPT');

CREATE TABLE "PlanCandidate" (
  "id" UUID NOT NULL, "studentUserId" UUID NOT NULL,
  "sourceType" "PlanCandidateSource" NOT NULL, "sourceId" VARCHAR(120) NOT NULL,
  "title" VARCHAR(160) NOT NULL, "estimatedMinutes" INTEGER NOT NULL,
  "availableAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "PlanCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanCandidate_minutes_check" CHECK ("estimatedMinutes" BETWEEN 5 AND 180)
);
CREATE TABLE "DailyPlan" (
  "id" UUID NOT NULL, "studentUserId" UUID NOT NULL, "learningDay" DATE NOT NULL,
  "totalMinutes" INTEGER NOT NULL, "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyPlan_total_minutes_check" CHECK ("totalMinutes" BETWEEN 0 AND 180)
);
CREATE TABLE "PlanTask" (
  "id" UUID NOT NULL, "dailyPlanId" UUID NOT NULL, "sourceType" "PlanCandidateSource" NOT NULL,
  "sourceId" VARCHAR(120) NOT NULL, "title" VARCHAR(160) NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL, "ordinal" INTEGER NOT NULL,
  "status" "PlanTaskStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanTask_minutes_check" CHECK ("estimatedMinutes" BETWEEN 5 AND 180),
  CONSTRAINT "PlanTask_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 3)
);
CREATE TABLE "LearningEvidence" (
  "id" UUID NOT NULL, "studentUserId" UUID NOT NULL,
  "type" "CompletionEvidenceType" NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "LearningEvidence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlanTaskCompletion" (
  "id" UUID NOT NULL, "planTaskId" UUID NOT NULL, "evidenceId" UUID NOT NULL,
  "completedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanTaskCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanCandidate_student_source_key" ON "PlanCandidate"("studentUserId", "sourceType", "sourceId");
CREATE INDEX "PlanCandidate_student_active_available_idx" ON "PlanCandidate"("studentUserId", "active", "availableAt");
CREATE UNIQUE INDEX "DailyPlan_student_learning_day_key" ON "DailyPlan"("studentUserId", "learningDay");
CREATE INDEX "DailyPlan_student_generated_idx" ON "DailyPlan"("studentUserId", "generatedAt");
CREATE UNIQUE INDEX "PlanTask_plan_ordinal_key" ON "PlanTask"("dailyPlanId", "ordinal");
CREATE UNIQUE INDEX "PlanTask_plan_source_key" ON "PlanTask"("dailyPlanId", "sourceType", "sourceId");
CREATE INDEX "LearningEvidence_student_type_occurred_idx" ON "LearningEvidence"("studentUserId", "type", "occurredAt");
CREATE UNIQUE INDEX "PlanTaskCompletion_planTaskId_key" ON "PlanTaskCompletion"("planTaskId");
CREATE UNIQUE INDEX "PlanTaskCompletion_evidenceId_key" ON "PlanTaskCompletion"("evidenceId");

ALTER TABLE "PlanCandidate" ADD CONSTRAINT "PlanCandidate_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyPlan" ADD CONSTRAINT "DailyPlan_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_dailyPlanId_fkey" FOREIGN KEY ("dailyPlanId") REFERENCES "DailyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningEvidence" ADD CONSTRAINT "LearningEvidence_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanTaskCompletion" ADD CONSTRAINT "PlanTaskCompletion_planTaskId_fkey" FOREIGN KEY ("planTaskId") REFERENCES "PlanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanTaskCompletion" ADD CONSTRAINT "PlanTaskCompletion_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "LearningEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
