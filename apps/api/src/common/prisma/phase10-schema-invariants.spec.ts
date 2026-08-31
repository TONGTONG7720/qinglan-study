import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(import.meta.dirname, "../../../prisma/migrations/20260823054000_phase10_privacy_retention/migration.sql"), "utf8");
describe("Phase 10 privacy schema invariants", () => {
  it("enforces export expiry, deletion scope/deadline and job leases", () => {
    expect(migration).toContain("FamilyExportRequest_expiry_check");
    expect(migration).toContain("DeletionRequest_scope_check");
    expect(migration).toContain("DeletionRequest_deadline_check");
    expect(migration).toContain("DeletionRequest_one_pending_personal");
    expect(migration).toContain("RetentionJob_lease_check");
  });
  it("preserves the reviewed-content HNSW index", () => {
    expect(migration).not.toContain("DROP INDEX \"ReviewedContent_embedding_hnsw_idx\"");
  });
});
