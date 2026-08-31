import type { LearningStepDefinition } from "../LearningStepper";
import type { SubjectCode } from "../types";

export type PracticeSource = "DEVELOPMENT_FIXTURE";
export type PracticeOptionId = "A" | "B" | "C" | "D";

export interface PracticeOption {
  readonly id: PracticeOptionId;
  readonly label: string;
}

interface PracticeQuestionBase {
  readonly id: string;
  readonly number: number;
  readonly typeLabel: string;
  readonly skillLabel: string;
  readonly stem: string;
}

export interface MultipleChoicePracticeQuestion extends PracticeQuestionBase {
  readonly kind: "MULTIPLE_CHOICE";
  readonly options: readonly PracticeOption[];
  readonly answerKey: PracticeOptionId;
  readonly explanation: readonly string[];
}

export interface NumericPracticeQuestion extends PracticeQuestionBase {
  readonly kind: "NUMERIC_INPUT";
  readonly supportText: string;
  readonly answerKey: number;
  readonly calculationCharacterLimit: 300;
  readonly explanation: readonly string[];
  readonly hintOne: string;
  readonly hintTwo: string;
}

export interface ParabolaPlotDefinition {
  readonly a: number;
  readonly h: number;
  readonly k: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface GraphConceptFeedback {
  readonly title: string;
  readonly message: string;
  readonly openingDirection: "CORRECT_RETAINED" | "NEEDS_RETHINK";
  readonly symmetryAxis: "CORRECT_RETAINED" | "NEEDS_RETHINK";
  readonly vertexPosition: "CORRECT_RETAINED" | "NEEDS_RETHINK";
}

export interface GraphPracticeOption extends PracticeOption {
  readonly formula: string;
  readonly plot: ParabolaPlotDefinition;
  readonly accessibleDescription: string;
  readonly feedback: GraphConceptFeedback;
}

export interface GraphPracticeQuestion extends PracticeQuestionBase {
  readonly kind: "GRAPH_CHOICE";
  readonly supportText: string;
  readonly options: readonly GraphPracticeOption[];
  readonly answerKey: PracticeOptionId;
  readonly explanation: readonly string[];
  readonly hintOne: string;
  readonly hintTwo: string;
}

export interface PlotPoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface CoordinatePlotValue {
  readonly x: number;
  readonly y: number;
}

export interface CoordinatePlotAxis {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly step: number;
}

export interface CoordinatePlotPracticeQuestion extends PracticeQuestionBase {
  readonly kind: "COORDINATE_PLOT";
  readonly instruction: string;
  readonly functionExpression: string;
  readonly valueTable: readonly CoordinatePlotValue[];
  readonly axis: CoordinatePlotAxis;
  readonly requiredPointCount: number;
  readonly snapStep: number;
  readonly symmetryNote: string;
  readonly answerPoints: readonly CoordinatePlotValue[];
  readonly hintOne: string;
  readonly hintTwo: string;
}

export type StructuredApplicationFieldId =
  | "vertexX"
  | "vertexY"
  | "interceptX1"
  | "interceptX2"
  | "width"
  | "explanation";

export interface StructuredApplicationAnswerKey {
  readonly vertexX: number;
  readonly vertexY: number;
  readonly interceptX1: number;
  readonly interceptX2: number;
  readonly width: number;
}

export interface StructuredApplicationPracticeQuestion extends PracticeQuestionBase {
  readonly kind: "STRUCTURED_APPLICATION";
  readonly scenario: string;
  readonly instruction: string;
  readonly functionExpression: string;
  readonly explanationMaxLength: 120;
  readonly hintOne: string;
  readonly hintTwo: string;
  readonly answerKey: StructuredApplicationAnswerKey;
}

export type PracticeQuestion =
  | MultipleChoicePracticeQuestion
  | NumericPracticeQuestion
  | GraphPracticeQuestion
  | CoordinatePlotPracticeQuestion
  | StructuredApplicationPracticeQuestion;

export interface PracticeDocument {
  readonly source: PracticeSource;
  readonly courseId: string;
  readonly subjectCode: SubjectCode;
  readonly subjectLabel: string;
  readonly lessonLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly date: string;
  readonly weekdayChinese: string;
  readonly weekdayEnglish: string;
  readonly estimatedMinutes: number;
  readonly steps: readonly LearningStepDefinition[];
  readonly totalQuestions: number;
  readonly questions: readonly PracticeQuestion[];
  readonly hintOne: string;
  readonly hintTwo: string;
}

export type PracticeResult =
  | { readonly status: "ready"; readonly document: PracticeDocument }
  | {
      readonly status: "unavailable";
      readonly reason: "PRACTICE_API_NOT_IMPLEMENTED" | "FIXTURE_NOT_AVAILABLE_FOR_COURSE";
    };

export type PracticeSubmitPhase =
  | "IDLE"
  | "CHECKING"
  | "CORRECT"
  | "INCORRECT_RETRYABLE"
  | "RETRY_EDITING"
  | "RETRY_CHECKING"
  | "RETRY_UNAVAILABLE"
  | "RECOVERED_CORRECT";
export type DraftOcrState = "EMPTY" | "UPLOADING" | "PROCESSING" | "NEEDS_CONFIRMATION" | "CONFIRMED";

export type NumericInputState = "EMPTY" | "TYPING_INCOMPLETE" | "INVALID_FORMAT" | "VALID_READY";
export type NumericSubmitPhase = "IDLE" | "CHECKING" | "CORRECT" | "INCORRECT_RETRYABLE";
export type GraphSubmitPhase = "IDLE" | "CHECKING" | "CORRECT" | "INCORRECT_RETRYABLE";
export type CoordinatePlotPhase =
  | "EDITING_POINTS"
  | "CURVE_READY"
  | "CURVE_CONNECTED"
  | "SUBMITTING"
  | "FEEDBACK"
  | "SERVICE_UNAVAILABLE";
export type CoordinatePlotTool = "ADD" | "MOVE" | "DELETE";
export type StructuredApplicationPhase =
  | "EDITING"
  | "READY_TO_SUBMIT"
  | "SUBMITTING"
  | "RESULT_PENDING_REVIEW"
  | "FEEDBACK"
  | "SERVICE_UNAVAILABLE";

export interface StructuredApplicationValues {
  readonly vertexX: string;
  readonly vertexY: string;
  readonly interceptX1: string;
  readonly interceptX2: string;
  readonly width: string;
  readonly explanation: string;
}

export interface StructuredApplicationCompletion {
  readonly vertexComplete: boolean;
  readonly interceptsComplete: boolean;
  readonly widthComplete: boolean;
  readonly explanationComplete: boolean;
  readonly allComplete: boolean;
}

export interface StructuredApplicationSessionState {
  readonly phase: StructuredApplicationPhase;
  readonly values: StructuredApplicationValues;
  readonly touchedFields: readonly StructuredApplicationFieldId[];
  readonly focusedField: StructuredApplicationFieldId | null;
  readonly fieldErrors: Readonly<Record<StructuredApplicationFieldId, string | null>>;
  readonly explanationLimitExceeded: boolean;
  readonly markedForReview: boolean;
  readonly hintOneUsed: boolean;
  readonly hintOneOpen: boolean;
  readonly hintTwoOpen: boolean;
  readonly draftOcrState: DraftOcrState;
  readonly draftFileName: string | null;
  readonly submitError: string | null;
}

export interface NumericPracticeSessionState {
  readonly calculationDraft: string;
  readonly calculationLimitExceeded: boolean;
  readonly answerInput: string;
  readonly normalizedAnswer: number | null;
  readonly inputState: NumericInputState;
  readonly submitPhase: NumericSubmitPhase;
  readonly attemptCount: number;
  readonly hadIncorrectAttempt: boolean;
  readonly hintOneUsed: boolean;
  readonly hintOneOpen: boolean;
  readonly hintTwoOpen: boolean;
  readonly isComposing: boolean;
}

export interface GraphPracticeSessionState {
  readonly selectedOptionId: PracticeOptionId | null;
  readonly submitPhase: GraphSubmitPhase;
  readonly attemptCount: number;
  readonly hadIncorrectAttempt: boolean;
  readonly markedForReview: boolean;
  readonly hintOneUsed: boolean;
  readonly hintOneOpen: boolean;
  readonly hintTwoOpen: boolean;
}

export interface CoordinatePlotSessionState {
  readonly phase: CoordinatePlotPhase;
  readonly activeTool: CoordinatePlotTool;
  readonly points: readonly PlotPoint[];
  readonly selectedPointId: string | null;
  readonly curveConnected: boolean;
  readonly undoStack: readonly (readonly PlotPoint[])[];
  readonly markedForReview: boolean;
  readonly hintOneUsed: boolean;
  readonly hintOneOpen: boolean;
  readonly hintTwoOpen: boolean;
  readonly clearConfirmationOpen: boolean;
  readonly submitError: string | null;
}

export interface PracticeSessionState {
  readonly currentQuestionIndex: number;
  readonly selectedOptionId: PracticeOptionId | null;
  readonly submitPhase: PracticeSubmitPhase;
  readonly attemptCount: number;
  readonly previousOptionIds: readonly PracticeOptionId[];
  readonly markedForReview: boolean;
  readonly hintOneUsed: boolean;
  readonly hintOneOpen: boolean;
  readonly hintTwoOpen: boolean;
  readonly draftOcrState: DraftOcrState;
  readonly draftFileName: string | null;
}
