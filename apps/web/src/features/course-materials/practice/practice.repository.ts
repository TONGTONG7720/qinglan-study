import type { PracticeResult } from "./types";
import { loadPracticeDemo } from "#practice-demo-provider";

export interface PracticeRepository {
  load(courseId: string, signal?: AbortSignal): Promise<PracticeResult>;
}

export interface PracticeRepositoryOptions {
  readonly demoEnabled: boolean;
  readonly demoDelayMs?: number;
  readonly demoLoader?: (courseId: string) => PracticeResult;
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

export function createPracticeRepository(options: PracticeRepositoryOptions): PracticeRepository {
  return {
    async load(courseId: string, signal?: AbortSignal): Promise<PracticeResult> {
      if (!options.demoEnabled) {
        return { status: "unavailable", reason: "PRACTICE_API_NOT_IMPLEMENTED" };
      }

      await wait(options.demoDelayMs ?? 220, signal);
      return (options.demoLoader ?? loadPracticeDemo)(courseId);
    },
  };
}

const demoEnabled =
  (import.meta.env.DEV || import.meta.env.MODE === "test" ||
    (import.meta.env.MODE === "qa" && import.meta.env.VITE_QA_DEMO_BUILD === "true")) &&
  (import.meta.env.MODE === "test" || import.meta.env.VITE_ENABLE_DEMO_COURSE_CATALOG === "true");

export const practiceRepository = createPracticeRepository({ demoEnabled });
