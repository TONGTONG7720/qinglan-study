import { useEffect, useState } from "react";

import { taskDetailRepository } from "./task-detail.repository";
import type { TaskDetailLoadState } from "./types";

export function useTaskDetail(taskId: string | null): TaskDetailLoadState {
  const [state, setState] = useState<TaskDetailLoadState>({ status: "LOADING" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "LOADING" });
    void taskDetailRepository.load(taskId, controller.signal).then((next) => {
      if (!controller.signal.aborted) {
        setState(next);
      }
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setState({ status: "SERVICE_UNAVAILABLE", reason: "TASK_DETAIL_SERVICE_UNAVAILABLE" });
      }
    });
    return () => { controller.abort(); };
  }, [taskId]);

  return state;
}
