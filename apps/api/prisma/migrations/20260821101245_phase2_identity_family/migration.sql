-- EnableExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'GUARDIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETION_PENDING');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'DELETION_PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InvitationMode" AS ENUM ('NEW_FAMILY', 'JOIN_FAMILY');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "loginId" VARCHAR(120) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(60) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMembership" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "accessLevel" "AccessLevel",
    "activeAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianStudentRelation" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "guardianUserId" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "GuardianStudentRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "grade" INTEGER NOT NULL,
    "dailyMinutes" INTEGER NOT NULL DEFAULT 40,
    "schoolName" VARCHAR(120),
    "cohortYear" INTEGER,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "mode" "InvitationMode" NOT NULL,
    "targetRole" "Role" NOT NULL DEFAULT 'GUARDIAN',
    "familyId" UUID,
    "createdByUserId" UUID NOT NULL,
    "linkedStudentIds" JSONB,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" UUID NOT NULL,
    "guardianUserId" UUID NOT NULL,
    "studentUserId" UUID NOT NULL,
    "policyVersion" VARCHAR(40) NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "familyId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resourceType" VARCHAR(80) NOT NULL,
    "resourceId" VARCHAR(120),
    "reason" VARCHAR(240),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "familyId" UUID,
    "kind" VARCHAR(80) NOT NULL,
    "dedupeKey" VARCHAR(160) NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMPTZ(6),
    "lastErrorCode" VARCHAR(80),
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "Session"
    ADD CONSTRAINT "Session_token_hash_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "FamilyMembership"
    ADD CONSTRAINT "FamilyMembership_role_access_check"
    CHECK (
        ("role" = 'GUARDIAN' AND "accessLevel" IS NOT NULL)
        OR ("role" <> 'GUARDIAN' AND "accessLevel" IS NULL)
    );

ALTER TABLE "StudentProfile"
    ADD CONSTRAINT "StudentProfile_grade_check"
    CHECK ("grade" IN (7, 8, 9)),
    ADD CONSTRAINT "StudentProfile_daily_minutes_check"
    CHECK ("dailyMinutes" BETWEEN 10 AND 180);

ALTER TABLE "Invitation"
    ADD CONSTRAINT "Invitation_token_hash_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "Invitation_target_guardian_check"
    CHECK ("targetRole" = 'GUARDIAN'),
    ADD CONSTRAINT "Invitation_mode_scope_check"
    CHECK (
        ("mode" = 'NEW_FAMILY' AND "familyId" IS NULL AND "linkedStudentIds" IS NULL)
        OR ("mode" = 'JOIN_FAMILY' AND "familyId" IS NOT NULL AND "linkedStudentIds" IS NOT NULL)
    );

ALTER TABLE "Operation"
    ADD CONSTRAINT "Operation_attempt_count_check"
    CHECK ("attemptCount" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_expiresAt_idx" ON "Session"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "FamilyMembership_userId_revokedAt_idx" ON "FamilyMembership"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMembership_familyId_userId_role_key" ON "FamilyMembership"("familyId", "userId", "role");

-- EnforceOneActiveOwnerPerFamily
CREATE UNIQUE INDEX "FamilyMembership_one_active_owner_per_family"
ON "FamilyMembership"("familyId")
WHERE "accessLevel" = 'OWNER' AND "revokedAt" IS NULL;

-- CreateIndex
CREATE INDEX "GuardianStudentRelation_guardianUserId_studentUserId_revoke_idx" ON "GuardianStudentRelation"("guardianUserId", "studentUserId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianStudentRelation_familyId_guardianUserId_studentUser_key" ON "GuardianStudentRelation"("familyId", "guardianUserId", "studentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_familyId_status_idx" ON "StudentProfile"("familyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_familyId_expiresAt_idx" ON "Invitation"("familyId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_guardianUserId_studentUserId_policyVersion_key" ON "Consent"("guardianUserId", "studentUserId", "policyVersion");

-- CreateIndex
CREATE INDEX "AuditEvent_familyId_createdAt_idx" ON "AuditEvent"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Operation_status_nextRunAt_idx" ON "Operation"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_kind_dedupeKey_key" ON "Operation"("kind", "dedupeKey");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudentRelation" ADD CONSTRAINT "GuardianStudentRelation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudentRelation" ADD CONSTRAINT "GuardianStudentRelation_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudentRelation" ADD CONSTRAINT "GuardianStudentRelation_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
