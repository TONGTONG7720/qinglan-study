import { demoLessonComplete } from "./demo-data";
import type { LessonCompleteProviderResult } from "./types";

export function loadLessonComplete(courseId: string): LessonCompleteProviderResult {
  return courseId === demoLessonComplete.courseId
    ? { status: "ready", document: demoLessonComplete }
    : { status: "unavailable", reason: "FIXTURE_NOT_AVAILABLE_FOR_COURSE" };
}
