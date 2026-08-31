import { demoLearningPlanDetailDocument, demoLearningPlanListDocument } from "./demo-data";
import type { LearningPlanDetailDocument, LearningPlanListDocument } from "./types";

export function loadLearningPlanListFixture(): LearningPlanListDocument | null {
  return demoLearningPlanListDocument;
}

export function loadLearningPlanDetailFixture(planId: string): LearningPlanDetailDocument | null {
  return planId === demoLearningPlanDetailDocument.planId ? demoLearningPlanDetailDocument : null;
}
