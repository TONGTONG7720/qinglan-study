export type TaskDetailSource = "DEVELOPMENT_FIXTURE";

export type TaskStepState = "COMPLETED" | "CURRENT" | "PENDING";

export interface TaskDetailStep {
  readonly id: string;
  readonly number: number;
  readonly label: string;
  readonly description: string;
  readonly state: TaskStepState;
}

export interface CompletionCriterion {
  readonly id: string;
  readonly label: string;
  readonly currentValue: number | null;
  readonly totalValue: number | null;
  readonly status: "IN_PROGRESS" | "PENDING" | "WAITING_FOR_PRACTICE" | "WAITING_FOR_SERVICE";
}

export interface TaskDetailDocument {
  readonly source: TaskDetailSource;
  readonly taskId: string;
  readonly courseId: string;
  readonly lessonId: string;
  readonly priority: 1;
  readonly totalPriorities: 4;
  readonly subjectCode: "MATH";
  readonly subjectLabel: "数学";
  readonly title: "二次函数的图像与性质";
  readonly textbookLabel: "人教版";
  readonly gradeLabel: "初二下册";
  readonly chapterLabel: "第 21 章";
  readonly lessonLabel: "21.2 二次函数的图像";
  readonly learningGoal: string;
  readonly taskStatus: "IN_PROGRESS";
  readonly currentStep: 2;
  readonly totalSteps: 4;
  readonly totalMinutes: 60;
  readonly remainingMinutes: 42;
  readonly rationale: string;
  readonly rationaleBasis: string;
  readonly rationaleCaveat: string;
  readonly steps: readonly TaskDetailStep[];
  readonly criteria: readonly CompletionCriterion[];
  readonly serviceState: "TASK_DETAIL_SERVICE_UNAVAILABLE";
  readonly date: "2026-08-21";
  readonly weekdayEnglish: "Friday";
  readonly weekdayChinese: "星期五";
  readonly lunarDate: "丙午年 七月初九";
}

export type TaskDetailLoadState =
  | { readonly status: "LOADING" }
  | { readonly status: "READY_FIXTURE"; readonly document: TaskDetailDocument }
  | { readonly status: "SERVICE_UNAVAILABLE"; readonly reason: "TASK_DETAIL_SERVICE_UNAVAILABLE" }
  | { readonly status: "NOT_FOUND_OR_DENIED" }
  | { readonly status: "OFFLINE_READ_ONLY"; readonly cachedDocument: TaskDetailDocument | null }
  | { readonly status: "SESSION_EXPIRED" };
