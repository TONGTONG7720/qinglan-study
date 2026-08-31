import { useEffect, useState } from "react";

import { lessonCompleteRepository } from "./lesson-complete.repository";
import type { LessonCompleteLoadState } from "./types";

export function useLessonComplete(courseId: string): LessonCompleteLoadState {
  const [state, setState] = useState<LessonCompleteLoadState>({ status: "LOADING" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "LOADING" });
    void lessonCompleteRepository.load(courseId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(result.status === "ready"
        ? { status: "READY_FIXTURE", document: result.document }
        : result.reason === "LESSON_COMPLETION_SERVICE_UNAVAILABLE"
          ? { status: "COMPLETION_SERVICE_UNAVAILABLE" }
          : { status: "NOT_FOUND_OR_DENIED" });
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setState({ status: "NOT_FOUND_OR_DENIED" });
    });
    return () => { controller.abort(); };
  }, [courseId]);
  return state;
}
