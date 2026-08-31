import { describe, expect, it } from "vitest";
import {
  AdminOverviewResponseSchema,
  CreateExamInputSchema,
  WeeklyReportResponseSchema,
  buildWeeklySuggestions,
  selectRemediationItems,
} from "./phase9.js";

describe("Phase 9 exam and aggregate-report contracts", () => {
  it("requires explainable confirmed score rows without fixed exam totals", () => {
    const valid = {
      title: "虚构八年级阶段测验",
      subjectCode: "MATH",
      occurredAt: "2026-08-20T08:00:00.000Z",
      confirmation: "CREATE_EXAM_DRAFT",
      items: [
        { ordinal: 1, label: "第1题", score: 8.5, maxScore: 10, knowledgeNodeId: null, lossCause: "CALCULATION_ERROR" },
      ],
    };
    expect(CreateExamInputSchema.safeParse(valid).success).toBe(true);
    expect(CreateExamInputSchema.safeParse({
      ...valid,
      items: [{ ...valid.items[0], score: 11 }],
    }).success).toBe(false);
    expect(CreateExamInputSchema.safeParse({
      ...valid,
      items: [{ ...valid.items[0], score: 8.5, lossCause: null }],
    }).success).toBe(false);
  });

  it("selects at most two remediation rows by lost score then ordinal", () => {
    const selected = selectRemediationItems([
      { ordinal: 3, scoreHundredths: 300, maxScoreHundredths: 1000 },
      { ordinal: 1, scoreHundredths: 800, maxScoreHundredths: 1000 },
      { ordinal: 2, scoreHundredths: 200, maxScoreHundredths: 1000 },
    ]);
    expect(selected.map((item) => item.ordinal)).toEqual([2, 3]);
  });

  it("builds no more than three deterministic aggregate suggestions", () => {
    const suggestions = buildWeeklySuggestions({
      completionRate: 0.5,
      activeDays: 2,
      weakestTitle: "一次方程",
      largestExamDecline: { subjectCode: "MATH", deltaPercent: -12 },
    });
    expect(suggestions).toHaveLength(3);
    expect(suggestions.join(" ")).not.toContain("promptText");
    expect(suggestions.join(" ")).not.toContain("storageKey");
  });

  it("keeps weekly and admin responses on explicit aggregate allowlists", () => {
    const weeklyKeys = Object.keys(WeeklyReportResponseSchema.shape);
    expect(weeklyKeys).not.toContain("messages");
    expect(weeklyKeys).not.toContain("transcript");
    expect(weeklyKeys).not.toContain("storageKey");
    const adminKeys = Object.keys(AdminOverviewResponseSchema.shape);
    expect(adminKeys).not.toContain("promptText");
    expect(adminKeys).not.toContain("students");
  });
});
