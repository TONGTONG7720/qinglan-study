import { loadKnowledgeIntroDemo } from "#knowledge-intro-provider";
import type { KnowledgeIntroResult } from "./types";

export interface KnowledgeIntroRepository {
  load(courseId: string, signal?: AbortSignal): Promise<KnowledgeIntroResult>;
}

export interface KnowledgeIntroRepositoryOptions {
  readonly demoEnabled: boolean;
  readonly demoDelayMs?: number;
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

export function createKnowledgeIntroRepository(
  options: KnowledgeIntroRepositoryOptions,
): KnowledgeIntroRepository {
  return {
    async load(courseId: string, signal?: AbortSignal): Promise<KnowledgeIntroResult> {
      if (!options.demoEnabled) {
        return { status: "unavailable", reason: "KNOWLEDGE_INTRO_API_NOT_IMPLEMENTED" };
      }

      await wait(options.demoDelayMs ?? 220, signal);
      const document = loadKnowledgeIntroDemo(courseId);
      if (document === null) {
        return { status: "unavailable", reason: "FIXTURE_NOT_AVAILABLE_FOR_COURSE" };
      }
      return { status: "ready", document };
    },
  };
}

export const knowledgeIntroRepository = createKnowledgeIntroRepository({
  demoEnabled:
    (import.meta.env.DEV || import.meta.env.MODE === "test" ||
      (import.meta.env.MODE === "qa" && import.meta.env.VITE_QA_DEMO_BUILD === "true")) &&
    (import.meta.env.MODE === "test" || import.meta.env.VITE_ENABLE_DEMO_COURSE_CATALOG === "true"),
});
