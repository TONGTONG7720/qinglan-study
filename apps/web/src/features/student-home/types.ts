import type { DailyPlanResponse, SubjectCode } from "@study/contracts";

export interface HomeCourseSnapshot {
  readonly subjectCode: SubjectCode;
  readonly subjectLabel: string;
  readonly textbookLabel: string;
  readonly currentPosition: string;
  readonly progressPercent: number;
}

export interface StudentHomeSnapshot {
  readonly source: "DEVELOPMENT_FIXTURE" | "API";
  readonly dailyPlan: DailyPlanResponse;
  readonly currentCourse: HomeCourseSnapshot;
}

export type StudentHomeResult =
  | { readonly status: "ready"; readonly snapshot: StudentHomeSnapshot }
  | {
      readonly status: "unavailable";
      readonly reason: "NOT_AUTHENTICATED" | "STUDENT_ROLE_REQUIRED" | "NO_DAILY_PLAN" | "DAILY_PLAN_SERVICE_UNAVAILABLE";
    };
