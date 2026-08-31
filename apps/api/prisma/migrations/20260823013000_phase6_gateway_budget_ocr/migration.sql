-- CreateEnum
CREATE TYPE "BudgetReservationStatus" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PrivateObjectStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('UPLOADING', 'OCR_PENDING', 'OCR_REVIEW', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ModelCallStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "AiBudgetPolicy" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    "systemMonthlyCapFen" INTEGER NOT NULL,
    "defaultFamilyCapFen" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AiBudgetPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyAiBudget" (
    "familyId" UUID NOT NULL,
    "monthlyCapFen" INTEGER NOT NULL,

    CONSTRAINT "FamilyAiBudget_pkey" PRIMARY KEY ("familyId")
);

-- CreateTable
CREATE TABLE "BudgetPeriodUsage" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "period" CHAR(7) NOT NULL,
    "reservedFen" INTEGER NOT NULL DEFAULT 0,
    "settledFen" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetPeriodUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetReservation" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "amountFen" INTEGER NOT NULL,
    "status" "BudgetReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "dedupeKey" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BudgetReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "costFen" INTEGER NOT NULL,
    "redactedMetadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateObject" (
    "id" UUID NOT NULL,
    "ownerStudentUserId" UUID NOT NULL,
    "storageKey" VARCHAR(240) NOT NULL,
    "mimeType" VARCHAR(40) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "status" "PrivateObjectStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "scanPassed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "objectId" UUID,
    "status" "QuestionStatus" NOT NULL DEFAULT 'UPLOADING',
    "ocrText" TEXT,
    "confidence" DOUBLE PRECISION,
    "confirmedText" TEXT,
    "providerCallId" VARCHAR(120),
    "errorCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelCall" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" VARCHAR(40) NOT NULL,
    "dedupeKey" VARCHAR(160) NOT NULL,
    "status" "ModelCallStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(60) NOT NULL,
    "output" JSONB,
    "costFen" INTEGER,
    "errorCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ModelCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPeriodUsage_familyId_period_key" ON "BudgetPeriodUsage"("familyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetReservation_dedupeKey_key" ON "BudgetReservation"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLedger_reservationId_key" ON "UsageLedger"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateObject_storageKey_key" ON "PrivateObject"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Question_objectId_key" ON "Question"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelCall_purpose_dedupeKey_key" ON "ModelCall"("purpose", "dedupeKey");

-- AddForeignKey
ALTER TABLE "FamilyAiBudget" ADD CONSTRAINT "FamilyAiBudget_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPeriodUsage" ADD CONSTRAINT "BudgetPeriodUsage_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetReservation" ADD CONSTRAINT "BudgetReservation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetReservation" ADD CONSTRAINT "BudgetReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "BudgetReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateObject" ADD CONSTRAINT "PrivateObject_ownerStudentUserId_fkey" FOREIGN KEY ("ownerStudentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "PrivateObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelCall" ADD CONSTRAINT "ModelCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DailyPlan_student_generated_idx" RENAME TO "DailyPlan_studentUserId_generatedAt_idx";

-- RenameIndex
ALTER INDEX "DailyPlan_student_learning_day_key" RENAME TO "DailyPlan_studentUserId_learningDay_key";

-- RenameIndex
ALTER INDEX "LearningEvidence_student_type_occurred_idx" RENAME TO "LearningEvidence_studentUserId_type_occurredAt_idx";

-- RenameIndex
ALTER INDEX "PlanCandidate_student_active_available_idx" RENAME TO "PlanCandidate_studentUserId_active_availableAt_idx";

-- RenameIndex
ALTER INDEX "PlanCandidate_student_source_key" RENAME TO "PlanCandidate_studentUserId_sourceType_sourceId_key";

-- RenameIndex
ALTER INDEX "PlanTask_plan_ordinal_key" RENAME TO "PlanTask_dailyPlanId_ordinal_key";

-- RenameIndex
ALTER INDEX "PlanTask_plan_source_key" RENAME TO "PlanTask_dailyPlanId_sourceType_sourceId_key";

-- RenameIndex
ALTER INDEX "TextbookEdition_identity_key" RENAME TO "TextbookEdition_subjectCode_grade_publisher_editionName_vol_key";

-- Phase6SafetyConstraints
ALTER TABLE "AiBudgetPolicy" ADD CONSTRAINT "AiBudgetPolicy_positive_caps_check" CHECK ("systemMonthlyCapFen" > 0 AND "defaultFamilyCapFen" > 0);
ALTER TABLE "FamilyAiBudget" ADD CONSTRAINT "FamilyAiBudget_positive_cap_check" CHECK ("monthlyCapFen" > 0);
ALTER TABLE "BudgetPeriodUsage" ADD CONSTRAINT "BudgetPeriodUsage_nonnegative_check" CHECK ("reservedFen" >= 0 AND "settledFen" >= 0), ADD CONSTRAINT "BudgetPeriodUsage_period_check" CHECK ("period" ~ '^[0-9]{4}-[0-9]{2}$');
ALTER TABLE "BudgetReservation" ADD CONSTRAINT "BudgetReservation_positive_amount_check" CHECK ("amountFen" > 0);
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_nonnegative_cost_check" CHECK ("costFen" >= 0);
ALTER TABLE "PrivateObject" ADD CONSTRAINT "PrivateObject_metadata_check" CHECK ("mimeType" IN ('image/jpeg','image/png','image/webp') AND "sizeBytes" BETWEEN 1 AND 10000000 AND "width" BETWEEN 32 AND 12000 AND "height" BETWEEN 32 AND 12000 AND "width" * "height" <= 40000000 AND "sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "Question" ADD CONSTRAINT "Question_confidence_check" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1), ADD CONSTRAINT "Question_ready_confirmation_check" CHECK ("status" <> 'READY' OR "confirmedText" IS NOT NULL);
INSERT INTO "AiBudgetPolicy" ("id","systemMonthlyCapFen","defaultFamilyCapFen","updatedAt") VALUES ('SYSTEM',10000,5000,CURRENT_TIMESTAMP);
