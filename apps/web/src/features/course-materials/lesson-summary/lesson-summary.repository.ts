import { loadLessonSummary } from "#lesson-summary-provider";

import type { LessonSummaryProviderResult } from "./types";

export interface LessonSummaryRepository {
  load(courseId: string, signal?: AbortSignal): Promise<LessonSummaryProviderResult>;
}

export const lessonSummaryRepository: LessonSummaryRepository = {
  async load(courseId, signal) {
    if (signal?.aborted === true) throw new DOMException("Aborted", "AbortError");
    return Promise.resolve(loadLessonSummary(courseId));
  },
};
