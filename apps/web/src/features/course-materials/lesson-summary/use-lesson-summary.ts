import { useEffect, useState } from "react";

import { lessonSummaryRepository } from "./lesson-summary.repository";
import type { LessonSummaryLoadState } from "./types";

export function useLessonSummary(courseId: string): LessonSummaryLoadState {
  const [state, setState] = useState<LessonSummaryLoadState>({ status: "LOADING" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "LOADING" });
    void lessonSummaryRepository.load(courseId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(result.status === "ready"
        ? { status: "READY_FIXTURE", document: result.document }
        : result.reason === "LESSON_SUMMARY_SAVE_UNAVAILABLE"
          ? { status: "SAVE_SERVICE_UNAVAILABLE" }
          : { status: "NOT_FOUND_OR_DENIED" });
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setState({ status: "NOT_FOUND_OR_DENIED" });
    });
    return () => { controller.abort(); };
  }, [courseId]);

  return state;
}
