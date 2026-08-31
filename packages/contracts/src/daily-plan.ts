import { z } from "zod";

export const PlanCandidateSourceSchema = z.enum([
  "OVERDUE_REVIEW",
  "EXAM_REMEDIATION",
  "CURRENT_UNIT",
  "DIAGNOSTIC",
]);
export type PlanCandidateSource = z.infer<typeof PlanCandidateSourceSchema>;

export const PlanCandidateSchema = z.object({
  sourceId: z.string().trim().min(1).max(120),
  sourceType: PlanCandidateSourceSchema,
  title: z.string().trim().min(1).max(160),
  estimatedMinutes: z.number().int().min(5).max(180),
}).strict();
export type PlanCandidate = z.infer<typeof PlanCandidateSchema>;

const priority: Readonly<Record<PlanCandidateSource, number>> = {
  OVERDUE_REVIEW: 0,
  EXAM_REMEDIATION: 1,
  CURRENT_UNIT: 2,
  DIAGNOSTIC: 3,
};

export function selectDailyPlanCandidates(
  candidates: readonly PlanCandidate[],
  dailyMinutes: number,
): PlanCandidate[] {
  const selected: PlanCandidate[] = [];
  let usedMinutes = 0;
  const ordered = [...candidates].sort((left, right) =>
    priority[left.sourceType] - priority[right.sourceType]
    || left.sourceId.localeCompare(right.sourceId));
  for (const candidate of ordered) {
    if (selected.length === 3) {
      break;
    }
    if (usedMinutes + candidate.estimatedMinutes <= dailyMinutes) {
      selected.push(candidate);
      usedMinutes += candidate.estimatedMinutes;
    }
  }
  return selected;
}

export function learningDayInShanghai(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("Unable to derive Asia/Shanghai learning day");
  }
  return `${year}-${month}-${day}`;
}

export const CompletionEvidenceSchema = z.object({
  type: z.enum([
    "ANSWER_EVALUATED",
    "REVIEW_SUCCEEDED",
    "DIAGNOSTIC_COMPLETED",
    "RECOVERY_ATTEMPT",
  ]),
  evidenceId: z.uuid(),
}).strict();

export const CompletePlanTaskInputSchema = z.object({
  evidence: CompletionEvidenceSchema,
  confirmation: z.literal("COMPLETE_PLAN_TASK"),
}).strict();
export type CompletePlanTaskInput = z.infer<typeof CompletePlanTaskInputSchema>;

export const GenerateDailyPlanInputSchema = z.object({}).strict();
export type GenerateDailyPlanInput = z.infer<typeof GenerateDailyPlanInputSchema>;

export const PlanTaskResponseSchema = z.object({
  id: z.uuid(), sourceType: PlanCandidateSourceSchema, sourceId: z.string(),
  title: z.string(), estimatedMinutes: z.number().int(), ordinal: z.number().int(),
  status: z.enum(["PENDING", "COMPLETED"]),
}).strict();

export const DailyPlanResponseSchema = z.object({
  id: z.uuid(), studentUserId: z.uuid(), learningDay: z.iso.date(),
  totalMinutes: z.number().int().min(0).max(180),
  tasks: z.array(PlanTaskResponseSchema).max(3),
}).strict();
export type DailyPlanResponse = z.infer<typeof DailyPlanResponseSchema>;

export const PlanTaskCompletionResponseSchema = z.object({
  id: z.uuid(), planTaskId: z.uuid(), evidenceId: z.uuid(), completedAt: z.iso.datetime(),
}).strict();
export type PlanTaskCompletionResponse = z.infer<typeof PlanTaskCompletionResponseSchema>;

export const OperationResponseSchema = z.object({
  id: z.uuid(), kind: z.string(), status: z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
  lastErrorCode: z.string().nullable(), updatedAt: z.iso.datetime(),
}).strict();
export type OperationResponse = z.infer<typeof OperationResponseSchema>;
