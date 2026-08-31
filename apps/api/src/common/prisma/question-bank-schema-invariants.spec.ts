import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(import.meta.dirname, "../../../prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(import.meta.dirname, "../../../prisma/migrations/20260827032650_question_bank_foundation/migration.sql"),
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
});
