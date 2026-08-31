import type { PracticeResult } from "./types";

export function loadPracticeDemo(courseId: string): PracticeResult {
  void courseId;
  return { status: "unavailable", reason: "PRACTICE_API_NOT_IMPLEMENTED" };
}
