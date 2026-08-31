import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schemaPath = resolve(import.meta.dirname, "../../../prisma/schema.prisma");

describe("identity and family schema invariants", () => {
  const schema = readFileSync(schemaPath, "utf8");

  it("contains every Phase 2 identity model", () => {
    for (const model of [
      "User",
      "Session",
      "Family",
      "FamilyMembership",
      "GuardianStudentRelation",
      "StudentProfile",
      "Invitation",
      "Consent",
      "AuditEvent",
      "Operation",
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("stores only session and invitation token hashes", () => {
    expect(schema).toContain("tokenHash");
    expect(schema).not.toMatch(/^\s+token\s+String/mu);
  });

  it("stores product roles at the user boundary", () => {
    expect(schema).toMatch(/^\s*roles\s+Role\[\]/mu);
  });

  it("declares the membership and operation uniqueness boundaries", () => {
    expect(schema).toContain("@@unique([familyId, userId, role])");
    expect(schema).toContain("@@unique([kind, dedupeKey])");
  });
});
