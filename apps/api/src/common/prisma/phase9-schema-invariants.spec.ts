import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(import.meta.dirname, "../../../prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(import.meta.dirname, "../../../prisma/migrations/20260823043459_phase9_exams_reports_admin/migration.sql"),
  "utf8",
);

describe("Phase 9 exam and report database invariants", () => {
  it("models confirmed exam rows, remediation links and aggregate weekly reports", () => {
    expect(schema).toContain("model Exam {");
    expect(schema).toContain("model ExamItem {");
    expect(schema).toContain("model RemediationLink {");
    expect(schema).toContain("model WeeklyReport {");
  });

  it("enforces score, confirmation, remediation and aggregate shape constraints", () => {
    expect(migration).toContain("Exam_confirmation_state_check");
    expect(migration).toContain("ExamItem_score_check");
    expect(migration).toContain("ExamItem_loss_cause_check");
    expect(migration).toContain("RemediationLink_priority_check");
    expect(migration).toContain("WeeklyReport_suggestions_check");
  });

  it("prevents confirmed score mutation and cross-scope remediation links", () => {
    expect(migration).toContain("Exam_confirmed_immutable");
    expect(migration).toContain("ExamItem_confirmed_immutable");
    expect(migration).toContain("RemediationLink_scope_check");
  });

  it("does not remove the Phase 7 HNSW index", () => {
    expect(migration).not.toContain("DROP INDEX \"ReviewedContent_embedding_hnsw_idx\"");
  });
});
