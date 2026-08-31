import { demoLessonSummary } from "./demo-data";
import type { LessonSummaryProviderResult } from "./types";

export function loadLessonSummary(courseId: string): LessonSummaryProviderResult {
  return courseId === demoLessonSummary.courseId
    ? { status: "ready", document: demoLessonSummary }
    : { status: "unavailable", reason: "FIXTURE_NOT_AVAILABLE_FOR_COURSE" };
}
