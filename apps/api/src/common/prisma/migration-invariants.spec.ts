import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsPath = resolve(import.meta.dirname, "../../../prisma/migrations");

describe("database-enforced identity invariants", () => {
  const migration = readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => readFileSync(resolve(migrationsPath, entry.name, "migration.sql"), "utf8"))
    .join("\n");

  it("enables pgvector in the business database", () => {
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS vector");
  });

  it("enforces grade and family-owner constraints", () => {
    expect(migration).toContain("StudentProfile_grade_check");
    expect(migration).toContain("FamilyMembership_role_access_check");
    expect(migration).toContain("FamilyMembership_one_active_owner_per_family");
  });

  it("enforces token hash and invitation mode constraints", () => {
    expect(migration).toContain("Session_token_hash_check");
    expect(migration).toContain("Invitation_mode_scope_check");
    expect(migration).toContain("Invitation_target_guardian_check");
  });

  it("requires every user to have a product role", () => {
    expect(migration).toContain("User_roles_non_empty_check");
  });
});
