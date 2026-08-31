import { useEffect, useState } from "react";

import { learningPlanListRepository } from "./learning-plans.repository";
import type { LearningPlanListLoadState } from "./types";

export function useLearningPlans(studentUserId?: string): LearningPlanListLoadState {
  const [state, setState] = useState<LearningPlanListLoadState>({ status: "LOADING" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "LOADING" });

    void learningPlanListRepository
      .load(studentUserId, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setState(next);
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "SERVICE_UNAVAILABLE", reason: "LEARNING_PLAN_LIST_SERVICE_UNAVAILABLE" });
        }
      });

    return () => {
      controller.abort();
    };
  }, [studentUserId]);

  return state;
}
