import type { LearningStepDefinition } from "../LearningStepper";

export type LessonSummarySource = "DEVELOPMENT_FIXTURE";
export type SummaryPromptId = "openingSummary" | "axisVertexSummary" | "plottingCheckSummary";

export interface MethodStepDefinition {
  readonly id: "OPENING" | "AXIS_VERTEX" | "PLOT" | "VERIFY";
  readonly number: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly description: string;
}

export interface ExpressionGuide {
  readonly id: "GENERAL" | "VERTEX";
  readonly label: string;
  readonly formula: string;
  readonly explanation: string;
}

export interface SummaryPrompt {
  readonly id: SummaryPromptId;
  readonly label: string;
  readonly placeholder: string;
  readonly maxLength: 40 | 80;
  readonly multiline: boolean;
}

export interface PracticeResultReference {
  readonly submittedQuestions: 5;
  readonly recoveredAfterHint: 1;
  readonly pendingReview: 1;
  readonly masteryState: "UNCHANGED";
}

export interface LessonSummaryDocument {
  readonly source: LessonSummarySource;
  readonly courseId: string;
  readonly lessonId: string;
  readonly subjectCode: "MATH";
  readonly subjectLabel: "数学";
  readonly lessonLabel: "21.2 二次函数的图像";
  readonly title: "归纳总结";
  readonly subtitle: "整理顺序，留下可复习的方法";
  readonly date: string;
  readonly weekdayChinese: string;
  readonly weekdayEnglish: string;
  readonly estimatedMinutes: 5;
  readonly steps: readonly LearningStepDefinition[];
  readonly methodTitle: string;
  readonly methodSummary: string;
  readonly methodSteps: readonly MethodStepDefinition[];
  readonly expressionComparisonTitle: string;
  readonly expressionNote: string;
  readonly expressionGuides: readonly ExpressionGuide[];
  readonly summaryPrompts: readonly SummaryPrompt[];
  readonly practiceResult: PracticeResultReference;
  readonly saveServiceState: "LESSON_SUMMARY_SAVE_UNAVAILABLE";
}

export type LessonSummaryProviderResult =
  | { readonly status: "ready"; readonly document: LessonSummaryDocument }
  | {
      readonly status: "unavailable";
      readonly reason: "LESSON_SUMMARY_SAVE_UNAVAILABLE" | "FIXTURE_NOT_AVAILABLE_FOR_COURSE";
    };

export type LessonSummaryLoadState =
  | { readonly status: "LOADING" }
  | { readonly status: "READY_FIXTURE"; readonly document: LessonSummaryDocument }
  | { readonly status: "SAVE_SERVICE_UNAVAILABLE" }
  | { readonly status: "NOT_FOUND_OR_DENIED" }
  | { readonly status: "OFFLINE_CURRENT_SESSION"; readonly document: LessonSummaryDocument }
  | { readonly status: "SESSION_EXPIRED" };

export type LessonSummaryPhase =
  | "EDITING"
  | "READY_TO_COMPLETE"
  | "COMPLETING"
  | "COMPLETE_SERVICE_UNAVAILABLE"
  | "COMPLETE_CONFIRMED";

export type LessonSummaryAiCheckState = "DISABLED_EMPTY" | "AVAILABLE" | "TUTOR_SERVICE_UNAVAILABLE";

export interface LessonSummaryValues {
  readonly openingSummary: string;
  readonly axisVertexSummary: string;
  readonly plottingCheckSummary: string;
}

export interface LessonSummaryCompletion {
  readonly openingComplete: boolean;
  readonly axisVertexComplete: boolean;
  readonly plottingCheckComplete: boolean;
  readonly allComplete: boolean;
  readonly hasContent: boolean;
}

export interface LessonSummarySessionState {
  readonly phase: LessonSummaryPhase;
  readonly values: LessonSummaryValues;
  readonly touchedFields: readonly SummaryPromptId[];
  readonly fieldErrors: Readonly<Record<SummaryPromptId, string | null>>;
  readonly focusedField: SummaryPromptId | null;
  readonly limitExceededField: SummaryPromptId | null;
  readonly aiCheckRequested: boolean;
  readonly aiCheckState: LessonSummaryAiCheckState;
  readonly completionError: string | null;
}
