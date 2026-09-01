import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(import.meta.dirname, "../../../prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(import.meta.dirname, "../../../prisma/migrations/20260827032650_question_bank_foundation/migration.sql"),
  "utf8",
);
const releaseGateMigration = readFileSync(
  resolve(import.meta.dirname, "../../../prisma/migrations/20260901090000_question_bank_release_gates/migration.sql"),
  "utf8",
);

describe("question-bank foundation schema invariants", () => {
  it("keeps student OCR questions separate from the formal bank", () => {
    expect(schema).toContain("model Question {");
    expect(schema).toContain("model QuestionBankItem {");
    expect(schema).toContain("stableKey");
    expect(schema).toContain("QuestionBankItemKnowledgeNode");
  });

  it("stores only private textbook object metadata and no PDF bytes", () => {
    expect(schema).toContain("model TextbookAsset {");
    expect(schema).toContain("objectKey");
    expect(schema).toContain("licenseStatus");
    expect(schema).not.toMatch(/model TextbookAsset \{[^}]*\bbytes\b/su);
    expect(migration).toContain("TextbookAsset_private_pdf_check");
  });

  it("binds reviewed content to knowledge, pages, provenance and licensing", () => {
    for (const field of ["knowledgeNodeId", "pageStart", "pageEnd", "contentType", "sourceHash", "licenseStatus", "contentVersion"]) {
      expect(schema).toContain(field);
    }
  });

  it("defines every release gate and preserves the pgvector HNSW index", () => {
    for (const status of ["DRAFT", "SOLVER_VALIDATED", "DEDUPLICATED", "FACT_CHECKED", "REVIEWED", "PUBLISHED"]) {
      expect(schema).toContain(status);
    }
    expect(migration).toContain("DROP INDEX \"ReviewedContent_embedding_hnsw_idx\"");
    expect(migration).toContain("CREATE INDEX \"ReviewedContent_embedding_hnsw_idx\"");
  });

  it("adds content-bound independent, semantic, human, license, release, and rollback evidence", () => {
    for (const kind of ["INDEPENDENT_SOLVE", "SEMANTIC_DEDUPLICATION", "HUMAN_SUBJECT_REVIEW", "LICENSE_REVIEW"]) {
      expect(schema).toContain(kind);
      expect(releaseGateMigration).toContain(kind);
    }
    for (const model of ["QuestionBankSemanticDuplicate", "QuestionBankLicenseReview", "QuestionBankRelease"]) {
      expect(schema).toContain(`model ${model} {`);
      expect(releaseGateMigration).toContain(`CREATE TABLE \"${model}\"`);
    }
    expect(schema).toMatch(/semanticEmbedding\s+Unsupported\("vector"\)\?/u);
    expect(releaseGateMigration).toContain("QuestionBankItem_semantic_embedding_metadata_check");
    expect(releaseGateMigration).toContain("Legacy published question-bank items must be withdrawn explicitly");
    expect(releaseGateMigration).toContain("QuestionBankRelease_rollback_check");
  });
});
