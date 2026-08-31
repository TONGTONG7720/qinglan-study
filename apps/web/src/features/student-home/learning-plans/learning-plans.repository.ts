import { loadLearningPlanDetailFixture, loadLearningPlanListFixture } from "#learning-plans-provider";

import type {
  LearningPlanDetailDocument,
  LearningPlanDetailLoadState,
  LearningPlanListDocument,
  LearningPlanListLoadState,
} from "./types";

export interface LearningPlanListRepository {
  load(studentUserId?: string, signal?: AbortSignal): Promise<LearningPlanListLoadState>;
}

export interface LearningPlanDetailRepository {
  load(planId: string | null, studentUserId?: string, signal?: AbortSignal): Promise<LearningPlanDetailLoadState>;
}

export interface LearningPlanListRepositoryOptions {
  readonly fixtureEnabled: boolean;
  readonly delayMs?: number;
  readonly loadFixture?: () => LearningPlanListDocument | null;
}

export interface LearningPlanDetailRepositoryOptions {
  readonly fixtureEnabled: boolean;
  readonly delayMs?: number;
  readonly loadFixture?: (planId: string) => LearningPlanDetailDocument | null;
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Request aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function readyOrEmpty(document: LearningPlanListDocument): LearningPlanListLoadState {
  if (document.plans.length === 0) {
    return { status: "EMPTY" };
  }
  return { status: "READY_FIXTURE", document };
}

export function createLearningPlanListRepository(
  options: LearningPlanListRepositoryOptions,
): LearningPlanListRepository {
  const fixtureLoader = options.loadFixture ?? loadLearningPlanListFixture;

  return {
    async load(_studentUserId?: string, signal?: AbortSignal): Promise<LearningPlanListLoadState> {
      if (!options.fixtureEnabled) {
        return { status: "SERVICE_UNAVAILABLE", reason: "LEARNING_PLAN_LIST_SERVICE_UNAVAILABLE" };
      }
      const document = fixtureLoader();
      if (document === null) {
        return { status: "SERVICE_UNAVAILABLE", reason: "LEARNING_PLAN_LIST_SERVICE_UNAVAILABLE" };
      }
      await wait(options.delayMs ?? 160, signal);
      return readyOrEmpty(document);
    },
  };
}

export function createLearningPlanDetailRepository(
  options: LearningPlanDetailRepositoryOptions,
): LearningPlanDetailRepository {
  const fixtureLoader = options.loadFixture ?? loadLearningPlanDetailFixture;

  return {
    async load(planId: string | null, _studentUserId?: string, signal?: AbortSignal): Promise<LearningPlanDetailLoadState> {
      if (planId === null) {
        return { status: "NOT_FOUND_OR_DENIED" };
      }
      if (!options.fixtureEnabled) {
        return { status: "SERVICE_UNAVAILABLE", reason: "LEARNING_PLAN_DETAIL_SERVICE_UNAVAILABLE" };
      }
      const document = fixtureLoader(planId);
      if (document === null) {
        return { status: "NOT_FOUND_OR_DENIED" };
      }
      await wait(options.delayMs ?? 160, signal);
      return { status: "READY_FIXTURE", document };
    },
  };
}

export const learningPlanListRepository = createLearningPlanListRepository({
  fixtureEnabled: import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_COURSE_CATALOG === "true",
});

export const learningPlanDetailRepository = createLearningPlanDetailRepository({
  fixtureEnabled: import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_COURSE_CATALOG === "true",
});
