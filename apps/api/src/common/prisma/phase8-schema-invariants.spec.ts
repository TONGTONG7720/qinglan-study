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
    "../../../prisma/migrations/20260823033020_phase8_mastery/migration.sql",
  ),
  "utf8",
);
const authorityMigration = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../prisma/migrations/20260823035550_phase8_authoritative_evidence/migration.sql",
  ),
  "utf8",
);

describe("Phase 8 mastery schema invariants", () => {
  it("models fixed mistake causes and traceable mastery evidence", () => {
    expect(schema).toContain("enum MistakeCause {");
    expect(schema).toContain("ANSWER_SEEKING");
    expect(schema).toContain("model RecoveryAttempt {");
    expect(schema).toMatch(/^\s*sourceAttemptId\s+String\s+@unique\s+@db\.Uuid/mu);
    expect(schema).toContain("model MasteryEvidence {");
    expect(schema).toMatch(/^\s*independent\s+Boolean\s+@default\(false\)/mu);
    expect(schema).toMatch(/^\s*valid\s+Boolean\s+@default\(false\)/mu);
  });

  it("enforces valid recovery, score, confidence and review intervals in PostgreSQL", () => {
    expect(migration).toContain("RecoveryAttempt_independent_correct_check");
    expect(migration).toContain("MasteryEvidence_delta_check");
    expect(migration).toContain("MasteryEvidence_confidence_check");
    expect(migration).toContain("MasteryState_score_check");
    expect(migration).toContain("MasteryState_evidence_count_check");
    expect(migration).toContain("ReviewSchedule_interval_check");
  });

  it("adds server-authoritative evidence flags with deny-by-default values", () => {
    expect(authorityMigration).toContain("\"independent\" BOOLEAN NOT NULL DEFAULT false");
    expect(authorityMigration).toContain("\"valid\" BOOLEAN NOT NULL DEFAULT false");
  });

  it("preserves the reviewed-content HNSW index from Phase 7", () => {
    expect(migration).not.toContain("DROP INDEX \"ReviewedContent_embedding_hnsw_idx\"");
    expect(authorityMigration).not.toContain("DROP INDEX \"ReviewedContent_embedding_hnsw_idx\"");
  });
});
