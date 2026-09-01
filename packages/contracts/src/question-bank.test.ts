import { describe, expect, it } from "vitest";

import {
  CreateQuestionBankDraftInputSchema,
  HumanSubjectReviewQuestionBankInputSchema,
  IndependentQuestionBankSolverResultSchema,
  PublishQuestionBankInputSchema,
  RecordIndependentQuestionBankSolveInputSchema,
  RegisterTextbookAssetInputSchema,
  ReviewQuestionBankLicenseInputSchema,
  ReviewQuestionBankInputSchema,
  RollbackQuestionBankReleaseInputSchema,
  SemanticDeduplicateQuestionBankInputSchema,
  ValidateQuestionBankSolverInputSchema,
} from "./question-bank.js";

const textbookEditionId = "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c";
const unitId = "018f0f4e-3b6e-7bb1-9e55-b644f1c2103d";
const knowledgeNodeId = "018f0f4e-4c7f-7cc2-af66-c75502d3214e";

function validDraft() {
  return {
    stableKey: "physics.g8.contract.001",
    subjectCode: "PHYSICS",
    grade: 8,
    textbookEditionId,
    unitId,
    knowledgeNodeIds: [knowledgeNodeId],
    type: "SINGLE_CHOICE",
    difficulty: 2,
    abilityLevel: "APPLY",
    stem: "一把刻度尺的分度值为 1 mm，下列记录哪一项最规范？",
    options: [{ key: "A", label: "2.5" }, { key: "B", label: "2.50 cm" }],
    answer: { kind: "CHOICE", value: ["B"] },
    explanation: "测量结果需要写单位，并按分度值进行合理估读。",
    hints: ["先检查单位。"],
    commonErrorTargets: ["漏写单位"],
    sourceType: "ORIGINAL_AI",
    licenseStatus: "LICENSE_REVIEW_REQUIRED",
    sourceReferences: ["local:test-source"],
    generationModel: "test-model",
    promptVersion: "test-prompt-v1",
    confirmation: "CREATE_QUESTION_BANK_DRAFT",
  } as const;
}

describe("question-bank contracts", () => {
  it("accepts a fully traceable generated DRAFT", () => {
    expect(CreateQuestionBankDraftInputSchema.safeParse(validDraft()).success).toBe(true);
  });

  it("rejects choice questions without options and AI items without generation metadata", () => {
    expect(CreateQuestionBankDraftInputSchema.safeParse({ ...validDraft(), options: null }).success).toBe(false);
    expect(CreateQuestionBankDraftInputSchema.safeParse({ ...validDraft(), generationModel: null }).success).toBe(false);
  });

  it("requires a structured independent solver result", () => {
    expect(ValidateQuestionBankSolverInputSchema.safeParse({
      solverAnswer: { kind: "CHOICE", value: ["B"] },
      solverExplanation: "根据分度值和单位记录规则选择 B。",
      solverName: "deterministic-test-solver",
      confirmation: "VALIDATE_QUESTION_BANK_SOLVER",
    }).success).toBe(true);
  });

  it("accepts an attested blind-solver result and rejects reference access or extra fields", () => {
    const result = {
      questionBankItemId: textbookEditionId,
      stableKey: "physics.g8.contract.001",
      solverReference: "reviewer-pseudonym-01",
      solverKind: "HUMAN",
      answer: { kind: "CHOICE", value: ["B"] },
      explanation: "根据分度值、估读位数和单位规则独立判断为 B。",
      solvedAt: "2026-08-27T08:00:00.000Z",
      attestation: "ANSWERED_WITHOUT_REFERENCE_ACCESS",
    } as const;
    expect(IndependentQuestionBankSolverResultSchema.safeParse(result).success).toBe(true);
    expect(IndependentQuestionBankSolverResultSchema.safeParse({
      ...result,
      attestation: "REFERENCE_ANSWER_VIEWED",
    }).success).toBe(false);
    expect(IndependentQuestionBankSolverResultSchema.safeParse({
      ...result,
      reviewerRealName: "not collected",
    }).success).toBe(false);
    expect(RecordIndependentQuestionBankSolveInputSchema.safeParse({
      ...result,
      confirmation: "RECORD_INDEPENDENT_QUESTION_BANK_SOLVE",
    }).success).toBe(true);
  });

  it("requires real semantic embeddings and explicit human evidence attestations", () => {
    expect(SemanticDeduplicateQuestionBankInputSchema.safeParse({
      embeddingModel: "text-embedding-production-v1",
      embedding: [1, 0, 0, 0, 0, 0, 0, 0],
      attestation: "REAL_SEMANTIC_EMBEDDING_NOT_HASH_HEURISTIC",
      confirmation: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
    }).success).toBe(true);
    expect(SemanticDeduplicateQuestionBankInputSchema.safeParse({
      embeddingModel: "text-embedding-production-v1",
      embedding: [1, 0, 0],
      attestation: "REAL_SEMANTIC_EMBEDDING_NOT_HASH_HEURISTIC",
      confirmation: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
    }).success).toBe(false);
    expect(HumanSubjectReviewQuestionBankInputSchema.safeParse({
      passed: true,
      reviewerReference: "reviewer-pseudonym-01",
      notes: "已独立核对题干、答案、解析和教材知识点。",
      evidenceReferences: ["external-review-register:physics-001"],
      attestation: "HUMAN_SUBJECT_FACT_REVIEW_COMPLETED",
      confirmation: "RECORD_HUMAN_SUBJECT_REVIEW",
    }).success).toBe(true);
    expect(ReviewQuestionBankLicenseInputSchema.safeParse({
      decision: "AUTHORIZED",
      reviewerReference: "license-reviewer-01",
      basis: "权利人书面授权覆盖题库展示和学生使用。",
      evidenceReference: "external-license-register:authorization-001",
      evidenceSha256: "a".repeat(64),
      attestation: "HUMAN_LICENSE_REVIEW_COMPLETED",
      confirmation: "REVIEW_QUESTION_BANK_LICENSE",
    }).success).toBe(true);
  });

  it("requires explicit final-review, publish, and rollback attestations", () => {
    expect(ReviewQuestionBankInputSchema.safeParse({
      decision: "APPROVED",
      comment: "全部发布门槛均已复核。",
      attestation: "FINAL_ADMIN_CONTENT_REVIEW_COMPLETED",
      confirmation: "REVIEW_QUESTION_BANK_ITEM",
    }).success).toBe(true);
    expect(PublishQuestionBankInputSchema.safeParse({
      attestation: "PUBLISH_WITH_VERIFIED_RELEASE_GATES",
      confirmation: "PUBLISH_QUESTION_BANK_ITEM",
    }).success).toBe(true);
    expect(RollbackQuestionBankReleaseInputSchema.safeParse({
      reason: "发现内容问题，立即退役并进入复核流程。",
      attestation: "ROLLBACK_QUESTION_BANK_RELEASE",
      confirmation: "RETIRE_PUBLISHED_QUESTION_BANK_ITEM",
    }).success).toBe(true);
    expect(PublishQuestionBankInputSchema.safeParse({
      confirmation: "PUBLISH_QUESTION_BANK_ITEM",
    }).success).toBe(false);
  });

  it("registers only PDF metadata, never PDF bytes or a public URL", () => {
    const base = {
      textbookEditionId,
      objectKey: `textbooks/${textbookEditionId}/source/fixture.pdf`,
      sha256: "a".repeat(64),
      mimeType: "application/pdf",
      sizeBytes: 1024,
      pageCount: 10,
      licenseStatus: "AUTHORIZED",
      licenseReference: "contract:test-license",
      sourceVersion: "v1",
      confirmation: "REGISTER_PRIVATE_TEXTBOOK_ASSET",
    } as const;
    expect(RegisterTextbookAssetInputSchema.safeParse(base).success).toBe(true);
    expect(RegisterTextbookAssetInputSchema.safeParse({ ...base, objectKey: "https://public.example/book.pdf" }).success).toBe(false);
    expect(RegisterTextbookAssetInputSchema.safeParse({ ...base, bytes: "base64-data" }).success).toBe(false);
  });
});
