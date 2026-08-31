import { demoKnowledgeIntro } from "./demo-data";
import type { KnowledgeIntroDocument } from "./types";

export function loadKnowledgeIntroDemo(courseId: string): KnowledgeIntroDocument | null {
  return courseId === demoKnowledgeIntro.courseId ? demoKnowledgeIntro : null;
}
