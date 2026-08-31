import { describe, expect, it } from "vitest";

import { demoLearningPlanDetailDocument, demoLearningPlanListDocument } from "./demo-data";
import { createLearningPlanDetailRepository, createLearningPlanListRepository } from "./learning-plans.repository";
import {
  loadLearningPlanDetailFixture as loadProductionLearningPlanDetailFixture,
  loadLearningPlanListFixture as loadProductionLearningPlanListFixture,
} from "./learning-plans-provider.production";
import {
  completedLearningPlanItemCount,
  currentLearningPlanItems,
  deriveLearningPlanProgressPercent,
  filterLearningPlans,
  learningPlanDetailInvariantFailures,
  sortLearningPlans,
  summarizeLearningPlans,
  totalLearningPlanItemMinutes,
} from "./types";
import type { LearningPlanListDocument, LearningPlanSummary } from "./types";

describe("learning plan list repository and data rules", () => {
  it("derives counts and total estimated minutes from plans", () => {
    const counts = summarizeLearningPlans(demoLearningPlanListDocument.plans);

    expect(counts).toEqual({
      total: 4,
      current: 1,
      upcoming: 2,
      completed: 1,
      scheduledSubjects: 4,
      totalEstimatedMinutes: 175,
    });
  });

  it("keeps the stable default order by status, dates, and id", () => {
    const sorted = sortLearningPlans(demoLearningPlanListDocument.plans);

    expect(sorted.map((plan) => plan.id)).toEqual([
      "fixture-plan-math-current",
      "fixture-plan-chinese-upcoming",
      "fixture-plan-english-upcoming",
      "fixture-plan-history-completed",
    ]);
  });

  it("sorts upcoming by start date and completed plans by completed date descending", () => {
    const completedPlan = demoLearningPlanListDocument.plans.find(
      (plan) => plan.id === "fixture-plan-history-completed",
    );
    const upcomingPlan = demoLearningPlanListDocument.plans.find(
      (plan) => plan.id === "fixture-plan-chinese-upcoming",
    );
    if (completedPlan === undefined || upcomingPlan === undefined) {
      throw new Error("Expected fixture plans are missing");
    }
    const earlierCompleted: LearningPlanSummary = {
      ...completedPlan,
      id: "fixture-plan-history-completed-earlier",
      completedOn: "2026-08-18",
    };
    const laterUpcoming: LearningPlanSummary = {
      ...upcomingPlan,
      id: "fixture-plan-chinese-upcoming-later",
      startsOn: "2026-08-24",
    };
    const sorted = sortLearningPlans([
      laterUpcoming,
      earlierCompleted,
      ...demoLearningPlanListDocument.plans,
    ]);

    expect(sorted.map((plan) => plan.id)).toEqual([
      "fixture-plan-math-current",
      "fixture-plan-chinese-upcoming",
      "fixture-plan-english-upcoming",
      "fixture-plan-chinese-upcoming-later",
      "fixture-plan-history-completed",
      "fixture-plan-history-completed-earlier",
    ]);
  });

  it("filters by status, subject, and the current week without mutating source plans", () => {
    const sourceIds = demoLearningPlanListDocument.plans.map((plan) => plan.id);
    const current = filterLearningPlans(demoLearningPlanListDocument.plans, demoLearningPlanListDocument, {
      status: "current",
      subject: "all",
      range: "current-week",
    });
    const math = filterLearningPlans(demoLearningPlanListDocument.plans, demoLearningPlanListDocument, {
      status: "all",
      subject: "MATH",
      range: "current-week",
    });

    expect(current).toHaveLength(1);
    expect(current[0]?.id).toBe("fixture-plan-math-current");
    expect(math).toHaveLength(1);
    expect(math[0]?.remainingMinutes).toBe(42);
    expect(demoLearningPlanListDocument.plans.map((plan) => plan.id)).toEqual(sourceIds);
  });

  it("loads development fixtures only when explicitly enabled", async () => {
    const result = await createLearningPlanListRepository({
      fixtureEnabled: true,
      delayMs: 0,
      loadFixture: () => demoLearningPlanListDocument,
    }).load("student-1");

    expect(result.status).toBe("READY_FIXTURE");
    if (result.status === "READY_FIXTURE") {
      expect(result.document.source).toBe("DEVELOPMENT_FIXTURE");
      expect(result.document.date).toBe("2026-08-21");
    }
  });

  it("separates EMPTY from service unavailable", async () => {
    const emptyDocument: LearningPlanListDocument = {
      ...demoLearningPlanListDocument,
      plans: [],
    };
    const result = await createLearningPlanListRepository({
      fixtureEnabled: true,
      delayMs: 0,
      loadFixture: () => emptyDocument,
    }).load("student-1");

    expect(result).toEqual({ status: "EMPTY" });
  });

  it("returns the production-safe boundary instead of the fixture", async () => {
    const result = await createLearningPlanListRepository({
      fixtureEnabled: false,
      loadFixture: () => demoLearningPlanListDocument,
    }).load("student-1");

    expect(result).toEqual({
      status: "SERVICE_UNAVAILABLE",
      reason: "LEARNING_PLAN_LIST_SERVICE_UNAVAILABLE",
    });
    expect(loadProductionLearningPlanListFixture()).toBeNull();
  });

  it("keeps STU-004 detail progress, minutes, and current task derived from the five items", () => {
    expect(learningPlanDetailInvariantFailures(demoLearningPlanDetailDocument)).toEqual([]);
    expect(totalLearningPlanItemMinutes(demoLearningPlanDetailDocument.items)).toBe(60);
    expect(completedLearningPlanItemCount(demoLearningPlanDetailDocument.items)).toBe(2);
    expect(currentLearningPlanItems(demoLearningPlanDetailDocument.items).map((item) => item.number)).toEqual([3]);
    expect(deriveLearningPlanProgressPercent(demoLearningPlanDetailDocument)).toBe(40);
    expect(demoLearningPlanDetailDocument.totalMinutes - demoLearningPlanDetailDocument.usedMinutes).toBe(42);
  });

  it("loads STU-004 development detail only when explicitly enabled and matching the plan id", async () => {
    const repository = createLearningPlanDetailRepository({
      fixtureEnabled: true,
      delayMs: 0,
      loadFixture: (planId) => (planId === demoLearningPlanDetailDocument.planId ? demoLearningPlanDetailDocument : null),
    });

    const ready = await repository.load("fixture-plan-math-current", "student-1");
    const denied = await repository.load("another-plan", "student-1");

    expect(ready.status).toBe("READY_FIXTURE");
    if (ready.status === "READY_FIXTURE") {
      expect(ready.document.serviceState).toBe("LEARNING_PLAN_DETAIL_SERVICE_UNAVAILABLE");
      expect(ready.document.source).toBe("DEVELOPMENT_FIXTURE");
    }
    expect(denied).toEqual({ status: "NOT_FOUND_OR_DENIED" });
  });

  it("returns the STU-004 production-safe boundary instead of the detail fixture", async () => {
    const result = await createLearningPlanDetailRepository({
      fixtureEnabled: false,
      loadFixture: () => demoLearningPlanDetailDocument,
    }).load("fixture-plan-math-current", "student-1");

    expect(result).toEqual({
      status: "SERVICE_UNAVAILABLE",
      reason: "LEARNING_PLAN_DETAIL_SERVICE_UNAVAILABLE",
    });
    expect(loadProductionLearningPlanDetailFixture("fixture-plan-math-current")).toBeNull();
  });
});
