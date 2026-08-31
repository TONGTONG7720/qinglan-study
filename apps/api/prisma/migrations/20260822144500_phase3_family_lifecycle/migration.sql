-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "ownerAuthorizationId" UUID;

-- CreateTable
CREATE TABLE "JoinInvitationAuthorization" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "authorizedByOwnerUserId" UUID NOT NULL,
    "linkedStudentIds" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinInvitationAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "proposedByUserId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "Invitation"
    ADD CONSTRAINT "Invitation_owner_authorization_scope_check"
    CHECK (
        ("mode" = 'NEW_FAMILY' AND "ownerAuthorizationId" IS NULL)
        OR ("mode" = 'JOIN_FAMILY' AND "ownerAuthorizationId" IS NOT NULL)
    );

ALTER TABLE "JoinInvitationAuthorization"
    ADD CONSTRAINT "JoinInvitationAuthorization_students_check"
    CHECK (
        jsonb_typeof("linkedStudentIds") = 'array'
        AND jsonb_array_length("linkedStudentIds") BETWEEN 1 AND 30
    );

ALTER TABLE "OwnershipTransfer"
    ADD CONSTRAINT "OwnershipTransfer_distinct_users_check"
    CHECK ("proposedByUserId" <> "targetUserId"),
    ADD CONSTRAINT "OwnershipTransfer_terminal_timestamps_check"
    CHECK (
        ("status" = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "cancelledAt" IS NULL)
        OR ("status" = 'CANCELLED' AND "acceptedAt" IS NULL AND "cancelledAt" IS NOT NULL)
        OR ("status" IN ('PENDING', 'EXPIRED') AND "acceptedAt" IS NULL AND "cancelledAt" IS NULL)
    );

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_ownerAuthorizationId_key" ON "Invitation"("ownerAuthorizationId");
CREATE INDEX "JoinInvitationAuthorization_familyId_expiresAt_idx"
    ON "JoinInvitationAuthorization"("familyId", "expiresAt");
CREATE INDEX "OwnershipTransfer_familyId_status_expiresAt_idx"
    ON "OwnershipTransfer"("familyId", "status", "expiresAt");
CREATE INDEX "OwnershipTransfer_targetUserId_status_idx"
    ON "OwnershipTransfer"("targetUserId", "status");
CREATE UNIQUE INDEX "OwnershipTransfer_one_pending_per_family"
    ON "OwnershipTransfer"("familyId") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "JoinInvitationAuthorization"
    ADD CONSTRAINT "JoinInvitationAuthorization_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JoinInvitationAuthorization"
    ADD CONSTRAINT "JoinInvitationAuthorization_authorizedByOwnerUserId_fkey"
    FOREIGN KEY ("authorizedByOwnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation"
    ADD CONSTRAINT "Invitation_ownerAuthorizationId_fkey"
    FOREIGN KEY ("ownerAuthorizationId") REFERENCES "JoinInvitationAuthorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnershipTransfer"
    ADD CONSTRAINT "OwnershipTransfer_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnershipTransfer"
    ADD CONSTRAINT "OwnershipTransfer_proposedByUserId_fkey"
    FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnershipTransfer"
    ADD CONSTRAINT "OwnershipTransfer_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EnforceExactlyOneActiveOwner
CREATE FUNCTION "assert_family_has_exactly_one_active_owner"(target_family_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    active_owner_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Family"
        WHERE "id" = target_family_id AND "status" = 'ACTIVE'
    ) THEN
        SELECT COUNT(*) INTO active_owner_count
        FROM "FamilyMembership"
        WHERE "familyId" = target_family_id
          AND "accessLevel" = 'OWNER'
          AND "revokedAt" IS NULL;

        IF active_owner_count <> 1 THEN
            RAISE EXCEPTION 'active family must have exactly one active owner'
                USING ERRCODE = '23514',
                      CONSTRAINT = 'Family_exactly_one_active_owner_check';
        END IF;
    END IF;
END;
$$;

CREATE FUNCTION "enforce_family_owner_from_family"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM "assert_family_has_exactly_one_active_owner"(
        CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END
    );
    RETURN NULL;
END;
$$;

CREATE FUNCTION "enforce_family_owner_from_membership"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM "assert_family_has_exactly_one_active_owner"(
        CASE WHEN TG_OP = 'DELETE' THEN OLD."familyId" ELSE NEW."familyId" END
    );
    IF TG_OP = 'UPDATE' AND OLD."familyId" <> NEW."familyId" THEN
        PERFORM "assert_family_has_exactly_one_active_owner"(OLD."familyId");
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Family_exactly_one_active_owner"
AFTER INSERT OR UPDATE ON "Family"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_family_owner_from_family"();

CREATE CONSTRAINT TRIGGER "FamilyMembership_exactly_one_active_owner"
AFTER INSERT OR UPDATE OR DELETE ON "FamilyMembership"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_family_owner_from_membership"();
