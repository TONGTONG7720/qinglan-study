import { z } from "zod";
import { SubjectCodeSchema } from "./curriculum.js";

export const MistakeCauseSchema = z.enum([
  "KNOWLEDGE_GAP",
  "CALCULATION_ERROR",
  "MISREAD",
  "METHOD_ERROR",
  "CARELESS",
  "ANSWER_SEEKING",
]);
export type MistakeCause = z.infer<typeof MistakeCauseSchema>;

export const MasteryEvidenceTypeSchema = z.enum([
  "INDEPENDENT_ANSWER",
  "REVIEW_RESULT",
  "EXAM_RESULT",
]);
export type MasteryEvidenceType = z.infer<typeof MasteryEvidenceTypeSchema>;

export const MasteryScopeKeySchema = z.string().trim().min(1).max(80)
  .regex(/^[A-Za-z0-9:_-]+$/u);

export const MasteryEvidenceInputSchema = z.object({
  subjectCode: SubjectCodeSchema,
  knowledgeNodeId: z.uuid().nullable(),
  scopeKey: MasteryScopeKeySchema,
  sourceAttemptId: z.uuid(),
  type: MasteryEvidenceTypeSchema,
  independent: z.literal(true),
  valid: z.literal(true),
  scoreDelta: z.number().int().min(-20).max(20),
  confidence: z.number().min(0.5).max(1),
}).strict();
export type MasteryEvidenceInput = z.infer<typeof MasteryEvidenceInputSchema>;

export const CreateMistakeInputSchema = z.object({
  subjectCode: SubjectCodeSchema,
  knowledgeNodeId: z.uuid().nullable(),
  cause: MistakeCauseSchema,
  promptSummary: z.string().trim().min(1).max(1000),
}).strict();
export type CreateMistakeInput = z.infer<typeof CreateMistakeInputSchema>;

export const RecoveryAttemptInputSchema = z.object({
  sourceAttemptId: z.uuid(),
  correct: z.boolean(),
  independent: z.boolean(),
}).strict().refine((value) => !value.correct || value.independent);
export type RecoveryAttemptInput = z.infer<typeof RecoveryAttemptInputSchema>;

export const MistakeResponseSchema = z.object({
  id: z.uuid(),
  studentUserId: z.uuid(),
  subjectCode: SubjectCodeSchema,
  knowledgeNodeId: z.uuid().nullable(),
  cause: MistakeCauseSchema,
  promptSummary: z.string(),
  createdAt: z.iso.datetime(),
}).strict();
export type MistakeResponse = z.infer<typeof MistakeResponseSchema>;

export const RecoveryAttemptResponseSchema = z.object({
  id: z.uuid(),
  mistakeId: z.uuid(),
  studentUserId: z.uuid(),
  sourceAttemptId: z.uuid(),
  correct: z.boolean(),
  independent: z.boolean(),
  completedAt: z.iso.datetime(),
}).strict();
export type RecoveryAttemptResponse = z.infer<typeof RecoveryAttemptResponseSchema>;

export const MasteryStateResponseSchema = z.object({
  studentUserId: z.uuid(),
  subjectCode: SubjectCodeSchema,
  knowledgeNodeId: z.uuid().nullable(),
  scopeKey: MasteryScopeKeySchema,
  score: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().nonnegative(),
  nextReviewAt: z.iso.datetime(),
}).strict();
export type MasteryStateResponse = z.infer<typeof MasteryStateResponseSchema>;

export const MasteryEvidenceResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("REVIEW_REQUIRED"),
    evidenceId: z.uuid(),
    state: z.null(),
  }).strict(),
  z.object({
    status: z.literal("ACCEPTED"),
    evidenceId: z.uuid(),
    state: MasteryStateResponseSchema,
  }).strict(),
]);
export type MasteryEvidenceResult = z.infer<typeof MasteryEvidenceResultSchema>;

const intervals = [1, 3, 7, 14, 30] as const;

export function reviewIntervalDays(evidenceCount: number): number {
  return intervals[Math.min(Math.max(evidenceCount - 1, 0), intervals.length - 1)] ?? 30;
}

export function nextReviewAt(at: Date, evidenceCount: number): Date {
  return new Date(at.getTime() + reviewIntervalDays(evidenceCount) * 24 * 60 * 60 * 1_000);
}
