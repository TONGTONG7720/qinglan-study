import type { LessonSummaryProviderResult } from "./types";

export function loadLessonSummary(courseId: string): LessonSummaryProviderResult {
  void courseId;
  return { status: "unavailable", reason: "LESSON_SUMMARY_SAVE_UNAVAILABLE" };
}
