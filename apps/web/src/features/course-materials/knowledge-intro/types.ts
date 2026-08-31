import type { SubjectCode } from "../types";
import type { LearningStepDefinition } from "../LearningStepper";

export type KnowledgeIntroSource = "DEVELOPMENT_FIXTURE";

export interface KnowledgeChoice {
  readonly id: "A" | "B" | "C" | "D";
  readonly label: string;
}

export interface FunctionPoint {
  readonly x: number;
  readonly y: number;
}

export interface StepResource {
  readonly id: string;
  readonly title: string;
  readonly metadata: string;
  readonly state: "FIXTURE_AVAILABLE" | "SERVICE_UNAVAILABLE";
  readonly fixtureSummary?: string;
}

export interface KnowledgeIntroDocument {
  readonly source: KnowledgeIntroSource;
  readonly courseId: string;
  readonly subjectCode: SubjectCode;
  readonly subjectLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly estimatedMinutes: number;
  readonly textbookLabel: string;
  readonly steps: readonly LearningStepDefinition[];
  readonly priorKnowledge: readonly {
    readonly term: string;
    readonly explanation: string;
  }[];
  readonly processSteps: readonly string[];
  readonly functionStudy: {
    readonly formula: string;
    readonly points: readonly FunctionPoint[];
    readonly explanation: string;
  };
  readonly check: {
    readonly question: string;
    readonly choices: readonly KnowledgeChoice[];
    readonly correctChoiceId: KnowledgeChoice["id"];
    readonly correctFeedback: string;
    readonly incorrectFeedback: string;
    readonly explanation: string;
  };
  readonly goals: readonly string[];
  readonly resources: readonly StepResource[];
}

export type KnowledgeIntroResult =
  | { readonly status: "ready"; readonly document: KnowledgeIntroDocument }
  | {
      readonly status: "unavailable";
      readonly reason: "KNOWLEDGE_INTRO_API_NOT_IMPLEMENTED" | "FIXTURE_NOT_AVAILABLE_FOR_COURSE";
    };
