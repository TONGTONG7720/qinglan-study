import { z } from "zod";
import { SubjectCodeSchema } from "./curriculum.js";

export const TutorStageSchema = z.enum(["ASK_ATTEMPT", "HINT_ONE", "HINT_TWO", "EXPLANATION", "INDEPENDENT_ANSWER", "EVALUATION", "COMPLETE", "NEEDS_EVIDENCE"]);
export type TutorStage = z.infer<typeof TutorStageSchema>;
export const TutorActionSchema = z.enum(["SUBMIT_ATTEMPT", "REQUEST_NEXT", "SUBMIT_INDEPENDENT", "REQUEST_EVALUATION", "COMPLETE_EVALUATION"]);
export type TutorAction = z.infer<typeof TutorActionSchema>;

const transitions: Readonly<Partial<Record<TutorStage, Partial<Record<TutorAction, TutorStage>>>>> = {
  ASK_ATTEMPT: { SUBMIT_ATTEMPT: "HINT_ONE" },
  HINT_ONE: { REQUEST_NEXT: "HINT_TWO" },
  HINT_TWO: { REQUEST_NEXT: "EXPLANATION" },
  EXPLANATION: { SUBMIT_INDEPENDENT: "INDEPENDENT_ANSWER" },
  INDEPENDENT_ANSWER: { REQUEST_EVALUATION: "EVALUATION" },
  EVALUATION: { COMPLETE_EVALUATION: "COMPLETE" },
};
export function nextTutorStage(stage: TutorStage, action: TutorAction): TutorStage {
  const next = transitions[stage]?.[action]; if (next === undefined) throw new Error("INVALID_TUTOR_TRANSITION"); return next;
}

export const TutorAdvanceInputSchema = z.object({ action: TutorActionSchema, content: z.string().trim().min(1).max(5000) }).strict();
export type TutorAdvanceInput = z.infer<typeof TutorAdvanceInputSchema>;
export const StartTutorInputSchema = z.object({
  subjectCode: SubjectCodeSchema, textbookEditionId: z.uuid(), unitId: z.uuid(), question: z.string().trim().min(1).max(5000),
}).strict();
export type StartTutorInput = z.infer<typeof StartTutorInputSchema>;

export const TutorSessionResponseSchema = z.object({
  id: z.uuid(), studentUserId: z.uuid(), stage: TutorStageSchema,
  evidenceIds: z.array(z.uuid()), response: z.string(), promptVersion: z.string(),
}).strict();
export type TutorSessionResponse = z.infer<typeof TutorSessionResponseSchema>;

export const TutorProviderOutputSchema = z.object({
  text: z.string().trim().min(1).max(5000),
}).strict();
