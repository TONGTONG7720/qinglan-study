import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(import.meta.dirname, "../../../prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(
  import.meta.dirname,
  "../../../prisma/migrations/20260831123000_private_object_storage_ocr/migration.sql",
), "utf8");

describe("private object storage schema invariants", () => {
  it("requires separate staging, verification, quarantine and deletion states", () => {
    for (const state of ["PENDING_UPLOAD", "VERIFYING", "READY", "QUARANTINED", "DELETE_PENDING", "DELETE_FAILED", "DELETED"]) {
      expect(schema).toContain(state);
    }
    expect(schema).toContain("uploadKey");
    expect(schema).toContain("storageVersionId");
    expect(schema).toContain("deletionReceipt");
  });

  it("quarantines every pre-adapter object and enforces state receipts", () => {
    expect(migration).toContain('"lastErrorCode" = \'LEGACY_OBJECT_UNVERIFIED\'');
    expect(migration).toContain('"status" = \'QUARANTINED\'');
    expect(migration).toContain('"status" = \'READY\' AND "verifiedAt" IS NOT NULL');
    expect(migration).toContain('"status" = \'DELETED\' AND "deletedAt" IS NOT NULL AND "deletionReceipt" IS NOT NULL');
    expect(migration).toContain("Question_attempt_state_check");
  });
});
