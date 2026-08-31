export type LearningPlanSource = "DEVELOPMENT_FIXTURE";

export type LearningPlanStatus = "CURRENT" | "UPCOMING" | "COMPLETED_IN_CURRENT_SESSION";

export type SubjectCode =
  | "CHINESE"
  | "MATH"
  | "ENGLISH"
  | "MORALITY_LAW"
  | "HISTORY"
  | "PHYSICS"
  | "CHEMISTRY";

export type LearningPlanServerConfirmation = "NOT_SUBMITTED" | "PENDING" | "ACCEPTED" | "UNAVAILABLE";

export interface LearningPlanSummary {
  readonly id: string;
  readonly source: LearningPlanSource;
  readonly subjectCode: SubjectCode;
  readonly subjectLabel: string;
  readonly title: string;
  readonly supportingLabel: string;
  readonly status: LearningPlanStatus;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly completedOn: string | null;
  readonly completedItems: number;
  readonly totalItems: number;
  readonly estimatedMinutes: number;
  readonly remainingMinutes: number | null;
  readonly serverConfirmation: LearningPlanServerConfirmation;
}

export interface LearningPlanListDocument {
  readonly source: LearningPlanSource;
  readonly date: "2026-08-21";
  readonly weekdayEnglish: "Friday";
  readonly weekdayChinese: "星期五";
  readonly lunarDate: "丙午年 七月初九";
  readonly weekStart: "2026-08-17";
  readonly weekEnd: "2026-08-23";
  readonly plans: readonly LearningPlanSummary[];
  readonly serviceState: "LEARNING_PLAN_LIST_SERVICE_UNAVAILABLE";
}

export type LearningPlanListLoadState =
  | { readonly status: "LOADING" }
  | { readonly status: "READY_FIXTURE"; readonly document: LearningPlanListDocument }
  | { readonly status: "EMPTY" }
  | { readonly status: "NO_FILTER_RESULTS" }
  | { readonly status: "GENERATING" }
  | { readonly status: "SERVICE_UNAVAILABLE"; readonly reason: "LEARNING_PLAN_LIST_SERVICE_UNAVAILABLE" }
  | { readonly status: "OFFLINE_READ_ONLY"; readonly cachedDocument: LearningPlanListDocument | null }
  | { readonly status: "SESSION_EXPIRED" };

export type PlanStatusFilter = "all" | "current" | "upcoming" | "completed";
export type PlanSubjectFilter = "all" | SubjectCode;
export type PlanRangeFilter = "current-week";

export interface PlanListFilters {
  readonly status: PlanStatusFilter;
  readonly subject: PlanSubjectFilter;
  readonly range: PlanRangeFilter;
}

export interface LearningPlanCounts {
  readonly total: number;
  readonly current: number;
  readonly upcoming: number;
  readonly completed: number;
  readonly scheduledSubjects: number;
  readonly totalEstimatedMinutes: number;
}

const statusRank: Readonly<Record<LearningPlanStatus, number>> = {
  CURRENT: 0,
  UPCOMING: 1,
  COMPLETED_IN_CURRENT_SESSION: 2,
};

function compareNullableIsoDesc(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return right.localeCompare(left);
}

export function sortLearningPlans(plans: readonly LearningPlanSummary[]): readonly LearningPlanSummary[] {
  return [...plans].sort((left, right) => {
    const statusDelta = statusRank[left.status] - statusRank[right.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }
    if (left.status === "UPCOMING" && right.status === "UPCOMING") {
      const startsOnDelta = left.startsOn.localeCompare(right.startsOn);
      if (startsOnDelta !== 0) {
        return startsOnDelta;
      }
    }
    if (left.status === "COMPLETED_IN_CURRENT_SESSION" && right.status === "COMPLETED_IN_CURRENT_SESSION") {
      const completedOnDelta = compareNullableIsoDesc(left.completedOn, right.completedOn);
      if (completedOnDelta !== 0) {
        return completedOnDelta;
      }
    }
    return left.id.localeCompare(right.id);
  });
}

export function summarizeLearningPlans(plans: readonly LearningPlanSummary[]): LearningPlanCounts {
  const subjects = new Set<SubjectCode>();
  let current = 0;
  let upcoming = 0;
  let completed = 0;
  let totalEstimatedMinutes = 0;

  for (const plan of plans) {
    subjects.add(plan.subjectCode);
    totalEstimatedMinutes += plan.estimatedMinutes;
    if (plan.status === "CURRENT") {
      current += 1;
    } else if (plan.status === "UPCOMING") {
      upcoming += 1;
    } else {
      completed += 1;
    }
  }

  return {
    total: plans.length,
    current,
    upcoming,
    completed,
    scheduledSubjects: subjects.size,
    totalEstimatedMinutes,
  };
}

export function isPlanInCurrentWeek(plan: LearningPlanSummary, document: LearningPlanListDocument): boolean {
  const endsOn = plan.endsOn ?? plan.completedOn ?? plan.startsOn;
  return plan.startsOn <= document.weekEnd && endsOn >= document.weekStart;
}

export function filterLearningPlans(
  plans: readonly LearningPlanSummary[],
  document: LearningPlanListDocument,
  filters: PlanListFilters,
): readonly LearningPlanSummary[] {
  const filtered = plans.filter((plan) => {
    const statusMatches =
      filters.status === "all" ||
      (filters.status === "current" && plan.status === "CURRENT") ||
      (filters.status === "upcoming" && plan.status === "UPCOMING") ||
      (filters.status === "completed" && plan.status === "COMPLETED_IN_CURRENT_SESSION");
    const subjectMatches = filters.subject === "all" || plan.subjectCode === filters.subject;
    const rangeMatches = isPlanInCurrentWeek(plan, document);
    return statusMatches && subjectMatches && rangeMatches;
  });
  return sortLearningPlans(filtered);
}

export type LearningPlanDetailSource = "DEVELOPMENT_FIXTURE";

export type PlanItemState = "COMPLETED_IN_CURRENT_SESSION" | "CURRENT" | "PENDING";

export type LearningPlanTargetView =
  | "LESSON_DETAIL"
  | "KNOWLEDGE_INTRO"
  | "WORKED_EXAMPLE"
  | "PRACTICE"
  | "SUMMARY";

export interface LearningPlanItem {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly description: string;
  readonly estimatedMinutes: number;
  readonly state: PlanItemState;
  readonly targetView: LearningPlanTargetView;
}

export type LearningPlanDetailTone = "default" | "accent" | "warning";

export interface LearningPlanDetailRow {
  readonly label: string;
  readonly value: string;
  readonly tone: LearningPlanDetailTone;
}

export type LearningPlanCompletionStatus = "COUNT" | "WAITING_FOR_PRACTICE" | "WAITING_FOR_SERVICE";

export interface LearningPlanCompletionCriterion {
  readonly id: string;
  readonly label: string;
  readonly currentValue: number | null;
  readonly totalValue: number | null;
  readonly status: LearningPlanCompletionStatus;
}

export interface LearningPlanDetailDocument {
  readonly source: LearningPlanDetailSource;
  readonly planId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly subjectCode: "MATH";
  readonly subjectLabel: "数学";
  readonly title: "二次函数图像学习计划";
  readonly chapterLabel: "第 21 章";
  readonly lessonLabel: "21.2 二次函数的图像";
  readonly status: "IN_PROGRESS";
  readonly startsOn: "2026-08-21";
  readonly endsOn: "2026-08-23";
  readonly completedItems: 2;
  readonly totalItems: 5;
  readonly currentItemNumber: 3;
  readonly totalMinutes: 60;
  readonly usedMinutes: 18;
  readonly remainingMinutes: 42;
  readonly goal: string;
  readonly basisExplanation: string;
  readonly basisRows: readonly LearningPlanDetailRow[];
  readonly items: readonly LearningPlanItem[];
  readonly completionCriteria: readonly LearningPlanCompletionCriterion[];
  readonly serviceState: "LEARNING_PLAN_DETAIL_SERVICE_UNAVAILABLE";
  readonly date: "2026-08-21";
  readonly weekdayEnglish: "Friday";
  readonly weekdayChinese: "星期五";
  readonly lunarDate: "丙午年 七月初九";
}

export type LearningPlanDetailLoadState =
  | { readonly status: "LOADING" }
  | { readonly status: "READY_FIXTURE"; readonly document: LearningPlanDetailDocument }
  | { readonly status: "SERVICE_UNAVAILABLE"; readonly reason: "LEARNING_PLAN_DETAIL_SERVICE_UNAVAILABLE" }
  | { readonly status: "NOT_FOUND_OR_DENIED" }
  | { readonly status: "OFFLINE_READ_ONLY"; readonly cachedDocument: LearningPlanDetailDocument | null }
  | { readonly status: "REPLACED" }
  | { readonly status: "SESSION_EXPIRED" };

export function totalLearningPlanItemMinutes(items: readonly LearningPlanItem[]): number {
  return items.reduce((total, item) => total + item.estimatedMinutes, 0);
}

export function completedLearningPlanItemCount(items: readonly LearningPlanItem[]): number {
  return items.filter((item) => item.state === "COMPLETED_IN_CURRENT_SESSION").length;
}

export function currentLearningPlanItems(items: readonly LearningPlanItem[]): readonly LearningPlanItem[] {
  return items.filter((item) => item.state === "CURRENT");
}

export function deriveLearningPlanProgressPercent(document: LearningPlanDetailDocument): number {
  const totalItems: number = document.totalItems;
  return totalItems === 0 ? 0 : Math.round((document.completedItems / totalItems) * 100);
}

export function learningPlanDetailInvariantFailures(document: LearningPlanDetailDocument): readonly string[] {
  const failures: string[] = [];
  const currentItems = currentLearningPlanItems(document.items);
  const totalMinutes = totalLearningPlanItemMinutes(document.items);
  const completedItems = completedLearningPlanItemCount(document.items);

  if (document.items.length !== document.totalItems) {
    failures.push("items length must match totalItems");
  }
  if (completedItems !== document.completedItems) {
    failures.push("completed item count must match completedItems");
  }
  if (currentItems.length !== 1) {
    failures.push("there must be exactly one current item");
  }
  if (currentItems[0]?.number !== document.currentItemNumber) {
    failures.push("current item number must match currentItemNumber");
  }
  if (totalMinutes !== document.totalMinutes) {
    failures.push("item minutes must sum to totalMinutes");
  }
  if (document.totalMinutes - document.usedMinutes !== document.remainingMinutes) {
    failures.push("remainingMinutes must be derived from totalMinutes and usedMinutes");
  }
  return failures;
}
