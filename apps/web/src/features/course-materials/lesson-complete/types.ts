import type { LearningStepDefinition } from "../LearningStepper";
import type { MethodStepDefinition } from "../lesson-summary/types";

export type LessonFlowCompletionSource = "DEVELOPMENT_FIXTURE";
export type ServerConfirmationState = "NOT_SUBMITTED" | "PENDING" | "ACCEPTED" | "REVIEW_REQUIRED" | "UNAVAILABLE";

export interface PersonalSummaryEntry {
  readonly id: "OPENING" | "AXIS_VERTEX" | "PLOT_VERIFY";
  readonly number: 1 | 2 | 3;
  readonly text: string;
  readonly sessionState: "COMPLETED_IN_CURRENT_SESSION";
}

export interface LessonFlowCompletionDocument {
  readonly source: LessonFlowCompletionSource;
  readonly courseId: string;
  readonly lessonId: string;
  readonly subjectCode: "MATH";
  readonly subjectLabel: "数学";
  readonly lessonLabel: "21.2 二次函数的图像";
  readonly title: "本课完成";
  readonly subtitle: "方法已整理，后续结果等待确认";
  readonly date: string;
  readonly weekdayChinese: string;
  readonly weekdayEnglish: string;
  readonly steps: readonly LearningStepDefinition[];
  readonly completionTitle: string;
  readonly completionDescription: string;
  readonly completionTruth: string;
  readonly methodSteps: readonly MethodStepDefinition[];
  readonly methodContextNote: string;
  readonly pageStepsCompleted: 4;
  readonly totalPageSteps: 4;
  readonly currentSessionState: "PAGE_FLOW_COMPLETED";
  readonly serverLessonCompletion: ServerConfirmationState;
  readonly cloudSummarySave: ServerConfirmationState;
  readonly evidenceConfirmation: ServerConfirmationState;
  readonly mistakeConfirmation: ServerConfirmationState;
  readonly masteryConfirmation: "UNCHANGED";
  readonly practiceSubmittedQuestions: 5;
  readonly recoveredAfterHint: 1;
  readonly pendingExplanationReview: 1;
  readonly personalSummaries: readonly PersonalSummaryEntry[];
  readonly localReviewRecommendation: "2_TO_3_DAYS";
  readonly reviewRecommendationText: string;
  readonly officialReviewSchedule: ServerConfirmationState;
  readonly serviceState: "LESSON_COMPLETION_SERVICE_UNAVAILABLE";
}

export type LessonCompleteProviderResult =
  | { readonly status: "ready"; readonly document: LessonFlowCompletionDocument }
  | { readonly status: "unavailable"; readonly reason: "LESSON_COMPLETION_SERVICE_UNAVAILABLE" | "FIXTURE_NOT_AVAILABLE_FOR_COURSE" };

export type LessonCompleteLoadState =
  | { readonly status: "LOADING" }
  | { readonly status: "READY_FIXTURE"; readonly document: LessonFlowCompletionDocument }
  | { readonly status: "COMPLETION_SERVICE_UNAVAILABLE" }
  | { readonly status: "NOT_FOUND_OR_DENIED" }
  | { readonly status: "OFFLINE_CURRENT_SESSION"; readonly document: LessonFlowCompletionDocument }
  | { readonly status: "SESSION_EXPIRED" };
