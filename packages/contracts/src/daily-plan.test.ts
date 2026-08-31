import { describe, expect, it } from "vitest";

import {
  CompletePlanTaskInputSchema,
  PlanCandidateSchema,
  learningDayInShanghai,
  selectDailyPlanCandidates,
} from "./daily-plan.js";

describe("Phase 5 deterministic daily plan contracts", () => {
  it("orders candidates deterministically and respects task/time limits", () => {
    const candidates = [
      { sourceId: "diagnostic", sourceType: "DIAGNOSTIC", title: "诊断", estimatedMinutes: 10 },
      { sourceId: "unit", sourceType: "CURRENT_UNIT", title: "当前单元", estimatedMinutes: 15 },
      { sourceId: "review", sourceType: "OVERDUE_REVIEW", title: "逾期复习", estimatedMinutes: 10 },
      { sourceId: "exam", sourceType: "EXAM_REMEDIATION", title: "考试补救", estimatedMinutes: 20 },
    ].map((candidate) => PlanCandidateSchema.parse(candidate));
    expect(selectDailyPlanCandidates(candidates, 45).map((item) => item.sourceId))
      .toEqual(["review", "exam", "unit"]);
    expect(selectDailyPlanCandidates(candidates, 25).map((item) => item.sourceId))
      .toEqual(["review", "unit"]);
  });

  it("derives the learning day in Asia/Shanghai", () => {
    expect(learningDayInShanghai(new Date("2026-08-22T15:59:59.000Z"))).toBe("2026-08-22");
    expect(learningDayInShanghai(new Date("2026-08-22T16:00:00.000Z"))).toBe("2026-08-23");
  });

  it("accepts only server-verifiable completion evidence", () => {
    expect(CompletePlanTaskInputSchema.safeParse({
      evidence: { type: "ANSWER_EVALUATED", evidenceId: "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c" },
      confirmation: "COMPLETE_PLAN_TASK",
    }).success).toBe(true);
    for (const type of ["OPENED", "READ", "AI_GENERATED"]) {
      expect(CompletePlanTaskInputSchema.safeParse({
        evidence: { type, evidenceId: "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c" },
        confirmation: "COMPLETE_PLAN_TASK",
      }).success).toBe(false);
    }
  });
});
