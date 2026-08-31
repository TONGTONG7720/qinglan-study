import { demoPractice } from "./demo-data";
import type { PracticeResult } from "./types";

export function loadPracticeDemo(courseId: string): PracticeResult {
  if (courseId !== demoPractice.courseId) {
    return { status: "unavailable", reason: "FIXTURE_NOT_AVAILABLE_FOR_COURSE" };
  }
  return { status: "ready", document: demoPractice };
}
