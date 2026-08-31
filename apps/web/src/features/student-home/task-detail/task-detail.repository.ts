import { loadTaskDetailFixture } from "#task-detail-provider";

import type { TaskDetailLoadState } from "./types";

export interface TaskDetailRepository {
  load(taskId: string | null, signal?: AbortSignal): Promise<TaskDetailLoadState>;
}

export interface TaskDetailRepositoryOptions {
  readonly fixtureEnabled: boolean;
  readonly delayMs?: number;
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delayMs);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Request aborted", "AbortError"));
    }, { once: true });
  });
}

export function createTaskDetailRepository(options: TaskDetailRepositoryOptions): TaskDetailRepository {
  return {
    async load(taskId: string | null, signal?: AbortSignal): Promise<TaskDetailLoadState> {
      if (!options.fixtureEnabled) {
        return { status: "SERVICE_UNAVAILABLE", reason: "TASK_DETAIL_SERVICE_UNAVAILABLE" };
      }
      const document = loadTaskDetailFixture();
      if (document === null) {
        return { status: "SERVICE_UNAVAILABLE", reason: "TASK_DETAIL_SERVICE_UNAVAILABLE" };
      }
      if (taskId !== null && taskId !== document.taskId) {
        return { status: "NOT_FOUND_OR_DENIED" };
      }
      await wait(options.delayMs ?? 120, signal);
      return { status: "READY_FIXTURE", document };
    },
  };
}

export const taskDetailRepository = createTaskDetailRepository({
  fixtureEnabled:
    (import.meta.env.DEV || (import.meta.env.MODE === "qa" && import.meta.env.VITE_QA_DEMO_BUILD === "true")) &&
    import.meta.env.VITE_ENABLE_DEMO_COURSE_CATALOG === "true",
});
