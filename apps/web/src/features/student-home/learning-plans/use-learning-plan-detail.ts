import { useEffect, useState } from "react";

import { learningPlanDetailRepository } from "./learning-plans.repository";
import type { LearningPlanDetailLoadState } from "./types";

export function useLearningPlanDetail(planId: string | null, studentUserId?: string): LearningPlanDetailLoadState {
  const [state, setState] = useState<LearningPlanDetailLoadState>({ status: "LOADING" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "LOADING" });

    void learningPlanDetailRepository
      .load(planId, studentUserId, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setState(next);
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "SERVICE_UNAVAILABLE", reason: "LEARNING_PLAN_DETAIL_SERVICE_UNAVAILABLE" });
        }
      });

    return () => {
      controller.abort();
    };
  }, [planId, studentUserId]);

  return state;
}
