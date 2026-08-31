import { describe, expect, it } from "vitest";
import {
  MasteryEvidenceInputSchema,
  MistakeCauseSchema,
  RecoveryAttemptInputSchema,
  nextReviewAt,
} from "./mastery.js";

describe("Phase 8 mastery contracts", () => {
  it("keeps answer seeking separate from knowledge errors", () => {
    expect(MistakeCauseSchema.options).toContain("ANSWER_SEEKING");
    expect(MistakeCauseSchema.options).toContain("KNOWLEDGE_GAP");
  });

  it("accepts only independent valid source attempts", () => {
    const base = {
      subjectCode: "MATH",
      knowledgeNodeId: null,
      scopeKey: "unit:linear-equations",
      sourceAttemptId: "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c",
      type: "REVIEW_RESULT",
      scoreDelta: 8,
      confidence: 0.9,
    };
    expect(MasteryEvidenceInputSchema.safeParse({ ...base, independent: true, valid: true }).success).toBe(true);
    expect(MasteryEvidenceInputSchema.safeParse({ ...base, independent: false, valid: true }).success).toBe(false);
    expect(MasteryEvidenceInputSchema.safeParse({ ...base, independent: true, valid: false }).success).toBe(false);
  });

  it("rejects a correct recovery that was not independent", () => {
    const sourceAttemptId = "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c";
    expect(RecoveryAttemptInputSchema.safeParse({ sourceAttemptId, correct: true, independent: false }).success).toBe(false);
    expect(RecoveryAttemptInputSchema.safeParse({ sourceAttemptId, correct: false, independent: false }).success).toBe(true);
  });

  it("schedules deterministic spaced reviews", () => {
    const at = new Date("2026-08-23T00:00:00.000Z");
    expect(nextReviewAt(at, 1).toISOString()).toBe("2026-08-24T00:00:00.000Z");
    expect(nextReviewAt(at, 3).toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });
});
