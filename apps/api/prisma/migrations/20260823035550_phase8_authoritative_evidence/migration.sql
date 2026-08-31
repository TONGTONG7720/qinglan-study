-- AlterTable
ALTER TABLE "LearningEvidence" ADD COLUMN     "independent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valid" BOOLEAN NOT NULL DEFAULT false;
