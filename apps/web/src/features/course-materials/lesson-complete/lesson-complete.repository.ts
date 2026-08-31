import { loadLessonComplete } from "#lesson-complete-provider";

import type { LessonCompleteProviderResult } from "./types";

export const lessonCompleteRepository = {
  async load(courseId: string, signal?: AbortSignal): Promise<LessonCompleteProviderResult> {
    if (signal?.aborted === true) throw new DOMException("Aborted", "AbortError");
    return Promise.resolve(loadLessonComplete(courseId));
  },
};
