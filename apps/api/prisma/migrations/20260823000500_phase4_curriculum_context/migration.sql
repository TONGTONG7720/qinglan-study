CREATE TYPE "SubjectCode" AS ENUM (
  'CHINESE', 'MATH', 'ENGLISH', 'MORALITY', 'HISTORY', 'PHYSICS', 'CHEMISTRY'
);
CREATE TYPE "ContentVerificationStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'RETIRED');
CREATE TYPE "StudentTextbookAlignmentStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMED');

CREATE TABLE "Subject" (
  "code" "SubjectCode" NOT NULL,
  "displayName" VARCHAR(40) NOT NULL,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "SubjectAvailability" (
  "id" UUID NOT NULL,
  "grade" INTEGER NOT NULL,
  "subjectCode" "SubjectCode" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "SubjectAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TextbookEdition" (
  "id" UUID NOT NULL,
  "subjectCode" "SubjectCode" NOT NULL,
  "grade" INTEGER NOT NULL,
  "publisher" VARCHAR(120) NOT NULL,
  "editionName" VARCHAR(120) NOT NULL,
  "volume" VARCHAR(80) NOT NULL,
  "status" "ContentVerificationStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceReference" VARCHAR(500),
  "verifiedByUserId" UUID,
  "verifiedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "TextbookEdition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Unit" (
  "id" UUID NOT NULL,
  "textbookEditionId" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "status" "ContentVerificationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeNode" (
  "id" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "objective" VARCHAR(500) NOT NULL,
  "status" "ContentVerificationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "KnowledgeNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentTextbookContext" (
  "id" UUID NOT NULL,
  "studentUserId" UUID NOT NULL,
  "subjectCode" "SubjectCode" NOT NULL,
  "reportedPublisher" VARCHAR(120),
  "reportedEdition" VARCHAR(120),
  "reportedVolume" VARCHAR(80),
  "reportedDirectory" JSONB,
  "textbookEditionId" UUID,
  "currentUnitId" UUID,
  "status" "StudentTextbookAlignmentStatus" NOT NULL DEFAULT 'UNCONFIRMED',
  "submittedByUserId" UUID NOT NULL,
  "verifiedByUserId" UUID,
  "verifiedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "StudentTextbookContext_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SubjectAvailability"
  ADD CONSTRAINT "SubjectAvailability_grade_check" CHECK ("grade" IN (7, 8, 9)),
  ADD CONSTRAINT "SubjectAvailability_matrix_check" CHECK (
    NOT "enabled"
    OR ("grade" = 7 AND "subjectCode" IN ('CHINESE', 'MATH', 'ENGLISH', 'MORALITY', 'HISTORY'))
    OR ("grade" = 8 AND "subjectCode" IN ('CHINESE', 'MATH', 'ENGLISH', 'MORALITY', 'HISTORY', 'PHYSICS'))
    OR ("grade" = 9 AND "subjectCode" IN ('CHINESE', 'MATH', 'ENGLISH', 'MORALITY', 'HISTORY', 'PHYSICS', 'CHEMISTRY'))
  );

ALTER TABLE "TextbookEdition"
  ADD CONSTRAINT "TextbookEdition_grade_subject_check" CHECK (
    ("grade" = 7 AND "subjectCode" IN ('CHINESE', 'MATH', 'ENGLISH', 'MORALITY', 'HISTORY'))
    OR ("grade" = 8 AND "subjectCode" IN ('CHINESE', 'MATH', 'ENGLISH', 'MORALITY', 'HISTORY', 'PHYSICS'))
    OR ("grade" = 9 AND "subjectCode" IN ('CHINESE', 'MATH', 'ENGLISH', 'MORALITY', 'HISTORY', 'PHYSICS', 'CHEMISTRY'))
  ),
  ADD CONSTRAINT "TextbookEdition_verification_check" CHECK (
    ("status" = 'DRAFT' AND "sourceReference" IS NULL AND "verifiedByUserId" IS NULL AND "verifiedAt" IS NULL)
    OR ("status" IN ('CONFIRMED', 'RETIRED') AND "sourceReference" IS NOT NULL AND "verifiedByUserId" IS NOT NULL AND "verifiedAt" IS NOT NULL)
  );

ALTER TABLE "Unit"
  ADD CONSTRAINT "Unit_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 200);

ALTER TABLE "StudentTextbookContext"
  ADD CONSTRAINT "StudentTextbookContext_report_check" CHECK (
    "reportedPublisher" IS NOT NULL
    AND "reportedEdition" IS NOT NULL
    AND "reportedVolume" IS NOT NULL
    AND jsonb_typeof("reportedDirectory") = 'array'
    AND jsonb_array_length("reportedDirectory") BETWEEN 1 AND 100
  ),
  ADD CONSTRAINT "StudentTextbookContext_alignment_check" CHECK (
    ("status" = 'UNCONFIRMED' AND "textbookEditionId" IS NULL AND "currentUnitId" IS NULL AND "verifiedByUserId" IS NULL AND "verifiedAt" IS NULL)
    OR ("status" = 'CONFIRMED' AND "textbookEditionId" IS NOT NULL AND "verifiedByUserId" IS NOT NULL AND "verifiedAt" IS NOT NULL)
  );

CREATE UNIQUE INDEX "SubjectAvailability_grade_subjectCode_key"
  ON "SubjectAvailability"("grade", "subjectCode");
CREATE INDEX "SubjectAvailability_grade_enabled_idx" ON "SubjectAvailability"("grade", "enabled");
CREATE UNIQUE INDEX "TextbookEdition_identity_key"
  ON "TextbookEdition"("subjectCode", "grade", "publisher", "editionName", "volume");
CREATE INDEX "TextbookEdition_subjectCode_grade_status_idx"
  ON "TextbookEdition"("subjectCode", "grade", "status");
CREATE UNIQUE INDEX "Unit_textbookEditionId_ordinal_key" ON "Unit"("textbookEditionId", "ordinal");
CREATE INDEX "Unit_textbookEditionId_status_idx" ON "Unit"("textbookEditionId", "status");
CREATE INDEX "KnowledgeNode_unitId_status_idx" ON "KnowledgeNode"("unitId", "status");
CREATE UNIQUE INDEX "StudentTextbookContext_studentUserId_subjectCode_key"
  ON "StudentTextbookContext"("studentUserId", "subjectCode");
CREATE INDEX "StudentTextbookContext_textbookEditionId_status_idx"
  ON "StudentTextbookContext"("textbookEditionId", "status");

ALTER TABLE "SubjectAvailability" ADD CONSTRAINT "SubjectAvailability_subjectCode_fkey"
  FOREIGN KEY ("subjectCode") REFERENCES "Subject"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TextbookEdition" ADD CONSTRAINT "TextbookEdition_subjectCode_fkey"
  FOREIGN KEY ("subjectCode") REFERENCES "Subject"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TextbookEdition" ADD CONSTRAINT "TextbookEdition_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_textbookEditionId_fkey"
  FOREIGN KEY ("textbookEditionId") REFERENCES "TextbookEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeNode" ADD CONSTRAINT "KnowledgeNode_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTextbookContext" ADD CONSTRAINT "StudentTextbookContext_studentUserId_fkey"
  FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTextbookContext" ADD CONSTRAINT "StudentTextbookContext_subjectCode_fkey"
  FOREIGN KEY ("subjectCode") REFERENCES "Subject"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTextbookContext" ADD CONSTRAINT "StudentTextbookContext_textbookEditionId_fkey"
  FOREIGN KEY ("textbookEditionId") REFERENCES "TextbookEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTextbookContext" ADD CONSTRAINT "StudentTextbookContext_currentUnitId_fkey"
  FOREIGN KEY ("currentUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentTextbookContext" ADD CONSTRAINT "StudentTextbookContext_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentTextbookContext" ADD CONSTRAINT "StudentTextbookContext_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Subject" ("code", "displayName") VALUES
  ('CHINESE', '语文'), ('MATH', '数学'), ('ENGLISH', '英语'),
  ('MORALITY', '道德与法治'), ('HISTORY', '历史'), ('PHYSICS', '物理'), ('CHEMISTRY', '化学');

INSERT INTO "SubjectAvailability" ("id", "grade", "subjectCode", "enabled")
SELECT gen_random_uuid(), grade, subject_code::"SubjectCode", enabled
FROM (VALUES
  (7, 'CHINESE', true), (7, 'MATH', true), (7, 'ENGLISH', true), (7, 'MORALITY', true), (7, 'HISTORY', true), (7, 'PHYSICS', false), (7, 'CHEMISTRY', false),
  (8, 'CHINESE', true), (8, 'MATH', true), (8, 'ENGLISH', true), (8, 'MORALITY', true), (8, 'HISTORY', true), (8, 'PHYSICS', true), (8, 'CHEMISTRY', false),
  (9, 'CHINESE', true), (9, 'MATH', true), (9, 'ENGLISH', true), (9, 'MORALITY', true), (9, 'HISTORY', true), (9, 'PHYSICS', true), (9, 'CHEMISTRY', true)
) AS matrix(grade, subject_code, enabled);
