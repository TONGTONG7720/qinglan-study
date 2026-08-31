import type { LessonCompleteProviderResult } from "./types";

export function loadLessonComplete(courseId: string): LessonCompleteProviderResult {
  void courseId;
  return { status: "unavailable", reason: "LESSON_COMPLETION_SERVICE_UNAVAILABLE" };
}
