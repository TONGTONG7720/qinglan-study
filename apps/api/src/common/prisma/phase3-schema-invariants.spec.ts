import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(
  resolve(import.meta.dirname, "../../../prisma/schema.prisma"),
  "utf8",
);
const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../prisma/migrations/20260822144500_phase3_family_lifecycle/migration.sql",
  ),
  "utf8",
);

describe("Phase 3 schema and migration invariants", () => {
  it("models owner-authorized JOIN signing and ownership acceptance", () => {
    expect(schema).toContain("model JoinInvitationAuthorization {");
    expect(schema).toContain("ownerAuthorizationId String?");
    expect(schema).toContain("model OwnershipTransfer {");
    expect(schema).toContain("enum OwnershipTransferStatus {");
  });

  it("enforces JOIN authorization scope and one pending transfer", () => {
    expect(migration).toContain("Invitation_owner_authorization_scope_check");
    expect(migration).toContain("JoinInvitationAuthorization_students_check");
    expect(migration).toContain("OwnershipTransfer_one_pending_per_family");
  });

  it("enforces exactly one active owner at deferred transaction commit", () => {
    expect(migration).toContain("assert_family_has_exactly_one_active_owner");
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(migration).toContain("FamilyMembership_exactly_one_active_owner");
  });
});
