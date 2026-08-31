import { z } from "zod";
import { SubjectCodeSchema } from "./curriculum.js";

export const ExamLossCauseSchema = z.enum([
  "KNOWLEDGE_GAP",
  "CALCULATION_ERROR",
  "MISREAD",
  "METHOD_ERROR",
  "CARELESS",
  "TIME_MANAGEMENT",
  "UNANSWERED",
  "OTHER",
]);
export type ExamLossCause = z.infer<typeof ExamLossCauseSchema>;

const ScoreSchema = z.number().min(0).max(1000).multipleOf(0.01);

export const ExamItemInputSchema = z.object({
  ordinal: z.number().int().min(1).max(200),
  label: z.string().trim().min(1).max(80),
  score: ScoreSchema,
  maxScore: ScoreSchema.positive(),
  knowledgeNodeId: z.uuid().nullable(),
  lossCause: ExamLossCauseSchema.nullable(),
}).strict().superRefine((item, context) => {
  if (item.score > item.maxScore) {
    context.addIssue({ code: "custom", path: ["score"], message: "score must not exceed maxScore" });
  }
  if (item.score < item.maxScore && item.lossCause === null) {
    context.addIssue({ code: "custom", path: ["lossCause"], message: "lost score requires a cause" });
  }
  if (item.score === item.maxScore && item.lossCause !== null) {
    context.addIssue({ code: "custom", path: ["lossCause"], message: "full score cannot have a loss cause" });
  }
});
export type ExamItemInput = z.infer<typeof ExamItemInputSchema>;

export const CreateExamInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subjectCode: SubjectCodeSchema,
  occurredAt: z.iso.datetime(),
  items: z.array(ExamItemInputSchema).min(1).max(100).refine(
    (items) => new Set(items.map((item) => item.ordinal)).size === items.length,
    "item ordinals must be unique",
  ),
  confirmation: z.literal("CREATE_EXAM_DRAFT"),
}).strict();
export type CreateExamInput = z.infer<typeof CreateExamInputSchema>;

export const ConfirmExamInputSchema = z.object({
  confirmation: z.literal("CONFIRM_EXAM"),
}).strict();
export type ConfirmExamInput = z.infer<typeof ConfirmExamInputSchema>;

export interface RemediationScoreRow {
  ordinal: number;
  scoreHundredths: number;
  maxScoreHundredths: number;
}

export function selectRemediationItems<T extends RemediationScoreRow>(items: readonly T[]): T[] {
  return items
    .filter((item) => item.scoreHundredths < item.maxScoreHundredths)
    .sort((left, right) =>
      (right.maxScoreHundredths - right.scoreHundredths)
      - (left.maxScoreHundredths - left.scoreHundredths)
      || left.ordinal - right.ordinal)
    .slice(0, 2);
}

export const ExamItemResponseSchema = z.object({
  id: z.uuid(),
  ordinal: z.number().int().positive(),
  label: z.string(),
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
  knowledgeNodeId: z.uuid().nullable(),
  lossCause: ExamLossCauseSchema.nullable(),
}).strict();

export const RemediationResponseSchema = z.object({
  id: z.uuid(),
  examItemId: z.uuid(),
  priority: z.number().int().min(1).max(2),
  evidenceId: z.uuid().nullable(),
  completedAt: z.iso.datetime().nullable(),
}).strict();

export const ExamResponseSchema = z.object({
  id: z.uuid(),
  studentUserId: z.uuid(),
  title: z.string(),
  subjectCode: SubjectCodeSchema,
  occurredAt: z.iso.datetime(),
  status: z.enum(["DRAFT", "CONFIRMED"]),
  totalScore: z.number().nonnegative().nullable(),
  totalMaxScore: z.number().positive().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  items: z.array(ExamItemResponseSchema),
  remediations: z.array(RemediationResponseSchema).max(2),
}).strict();
export type ExamResponse = z.infer<typeof ExamResponseSchema>;

export const GenerateWeeklyReportInputSchema = z.object({
  weekStart: z.iso.date(),
  confirmation: z.literal("GENERATE_WEEKLY_REPORT"),
}).strict();
export type GenerateWeeklyReportInput = z.infer<typeof GenerateWeeklyReportInputSchema>;

export const WeeklySubjectTrendSchema = z.object({
  subjectCode: SubjectCodeSchema,
  masteryScore: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
}).strict();

export const WeakKnowledgeNodeSchema = z.object({
  knowledgeNodeId: z.uuid(),
  title: z.string().trim().min(1).max(160),
  subjectCode: SubjectCodeSchema,
  score: z.number().int().min(0).max(100),
}).strict();

export const ExamChangeSchema = z.object({
  subjectCode: SubjectCodeSchema,
  previousPercent: z.number().min(0).max(100).nullable(),
  currentPercent: z.number().min(0).max(100),
  deltaPercent: z.number().min(-100).max(100).nullable(),
}).strict();

export const WeeklyReportSummarySchema = z.object({
  completedTasks: z.number().int().nonnegative(),
  totalTasks: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(1),
  activeDays: z.number().int().min(0).max(7),
  subjectTrends: z.array(WeeklySubjectTrendSchema),
  weakKnowledgeNodes: z.array(WeakKnowledgeNodeSchema).max(3),
  examChanges: z.array(ExamChangeSchema),
}).strict();
export type WeeklyReportSummary = z.infer<typeof WeeklyReportSummarySchema>;

export const WeeklyReportResponseSchema = z.object({
  id: z.uuid(),
  studentUserId: z.uuid(),
  weekStart: z.iso.date(),
  weekEnd: z.iso.date(),
  summary: WeeklyReportSummarySchema,
  narrative: z.string().trim().min(1).max(1000),
  suggestions: z.array(z.string().trim().min(1).max(240)).max(3),
  generatedAt: z.iso.datetime(),
}).strict();
export type WeeklyReportResponse = z.infer<typeof WeeklyReportResponseSchema>;

export interface WeeklySuggestionFacts {
  completionRate: number;
  activeDays: number;
  weakestTitle: string | null;
  largestExamDecline: { subjectCode: string; deltaPercent: number } | null;
}

export function buildWeeklySuggestions(facts: WeeklySuggestionFacts): string[] {
  const suggestions: string[] = [];
  if (facts.completionRate < 0.8) {
    suggestions.push("先完成本周未完成任务，再增加新的学习量。");
  }
  if (facts.weakestTitle !== null) {
    suggestions.push(`安排一次“${facts.weakestTitle}”的独立复习并保留作答证据。`);
  }
  if (facts.largestExamDecline !== null && facts.largestExamDecline.deltaPercent < 0) {
    suggestions.push(`${facts.largestExamDecline.subjectCode} 最近一次考试有下降，优先完成对应补救任务。`);
  }
  if (facts.activeDays < 4) {
    suggestions.push("把学习分散到更多天，避免集中突击。");
  }
  if (suggestions.length === 0) {
    suggestions.push("保持当前节奏，并继续使用独立作答证据验证掌握情况。");
  }
  return suggestions.slice(0, 3);
}

const CountSchema = z.number().int().nonnegative();

export const AdminOverviewResponseSchema = z.object({
  health: z.object({ status: z.literal("ok") }).strict(),
  invitations: z.object({ active: CountSchema, used: CountSchema, revoked: CountSchema, expired: CountSchema }).strict(),
  textbooks: z.object({ draft: CountSchema, confirmed: CountSchema, retired: CountSchema }).strict(),
  budgets: z.object({ familiesConfigured: CountSchema, reservedFen: CountSchema, settledFen: CountSchema }).strict(),
  aiErrors: z.object({
    failedCalls: CountSchema,
    byCode: z.array(z.object({ code: z.string().trim().min(1).max(80), count: CountSchema }).strict()),
  }).strict(),
  deletionJobs: z.object({ pending: CountSchema, running: CountSchema, failed: CountSchema }).strict(),
  generatedAt: z.iso.datetime(),
}).strict();
export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;
