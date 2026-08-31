import { z } from "zod";

import type { Grade } from "./identity.js";
import { GradeSchema } from "./identity.js";

export const SubjectCodeSchema = z.enum([
  "CHINESE",
  "MATH",
  "ENGLISH",
  "MORALITY",
  "HISTORY",
  "PHYSICS",
  "CHEMISTRY",
]);
export type SubjectCode = z.infer<typeof SubjectCodeSchema>;

export const KnowledgeAbilityLevelSchema = z.enum([
  "REMEMBER",
  "UNDERSTAND",
  "APPLY",
  "ANALYZE",
  "EVALUATE",
  "CREATE",
]);
export type KnowledgeAbilityLevel = z.infer<typeof KnowledgeAbilityLevelSchema>;

export const QuestionBankTypeSchema = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "SHORT_ANSWER",
  "CALCULATION",
  "EXPERIMENT_DESIGN",
  "ERROR_DIAGNOSIS",
  "GRAPHING",
]);
export type QuestionBankType = z.infer<typeof QuestionBankTypeSchema>;

export const ContentVerificationStatusSchema = z.enum(["DRAFT", "CONFIRMED", "RETIRED"]);
export type ContentVerificationStatus = z.infer<typeof ContentVerificationStatusSchema>;

const gradeSubjectMatrix: Readonly<Record<Grade, readonly SubjectCode[]>> = {
  7: ["CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY"],
  8: ["CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY", "PHYSICS"],
  9: ["CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY", "PHYSICS", "CHEMISTRY"],
};

export function availableSubjectsForGrade(grade: Grade): readonly SubjectCode[] {
  return gradeSubjectMatrix[grade];
}

export function isSubjectAvailableForGrade(grade: Grade, subjectCode: SubjectCode): boolean {
  return gradeSubjectMatrix[grade].includes(subjectCode);
}

export const SubjectAvailabilityResponseSchema = z.object({
  grade: GradeSchema,
  subjects: z.array(SubjectCodeSchema),
}).strict();
export type SubjectAvailabilityResponse = z.infer<typeof SubjectAvailabilityResponseSchema>;

const KnowledgeNodeDraftInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(500),
  prerequisiteKnowledge: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  commonErrors: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  abilityLevels: z.array(KnowledgeAbilityLevelSchema).min(1).max(6)
    .refine((levels) => new Set(levels).size === levels.length)
    .default(["UNDERSTAND"]),
  questionTypes: z.array(QuestionBankTypeSchema).min(1).max(9)
    .refine((types) => new Set(types).size === types.length)
    .default(["SHORT_ANSWER"]),
  pageStart: z.number().int().positive().max(2_000).nullable().default(null),
  pageEnd: z.number().int().positive().max(2_000).nullable().default(null),
  contentVersion: z.string().trim().min(1).max(40).default("1"),
}).strict().superRefine((input, context) => {
  if ((input.pageStart === null) !== (input.pageEnd === null)) {
    context.addIssue({ code: "custom", message: "pageStart and pageEnd must be provided together", path: ["pageStart"] });
  }
  if (input.pageStart !== null && input.pageEnd !== null && input.pageStart > input.pageEnd) {
    context.addIssue({ code: "custom", message: "pageStart must not exceed pageEnd", path: ["pageStart"] });
  }
}).strict();

const UnitDraftInputSchema = z.object({
  ordinal: z.number().int().min(1).max(200),
  title: z.string().trim().min(1).max(160),
  knowledgeNodes: z.array(KnowledgeNodeDraftInputSchema).min(1).max(100),
}).strict();

export const CreateTextbookDraftInputSchema = z.object({
  subjectCode: SubjectCodeSchema,
  grade: GradeSchema,
  publisher: z.string().trim().min(1).max(120),
  editionName: z.string().trim().min(1).max(120),
  volume: z.string().trim().min(1).max(80),
  units: z.array(UnitDraftInputSchema).min(1).max(100)
    .refine((units) => new Set(units.map((unit) => unit.ordinal)).size === units.length),
  confirmation: z.literal("CREATE_TEXTBOOK_DRAFT"),
}).strict();
export type CreateTextbookDraftInput = z.infer<typeof CreateTextbookDraftInputSchema>;

export const ConfirmTextbookInputSchema = z.object({
  sourceReference: z.string().trim().min(8).max(500),
  confirmation: z.literal("CONFIRM_TEXTBOOK"),
}).strict();
export type ConfirmTextbookInput = z.infer<typeof ConfirmTextbookInputSchema>;

const EvidenceSha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);

export const TextbookPhysicalCopyReviewResultSchema = z.object({
  textbookEditionId: z.uuid(),
  reviewerReference: z.string().trim().min(3).max(120),
  reviewedAt: z.iso.datetime(),
  coverImageSha256: EvidenceSha256Schema,
  copyrightPageImageSha256: EvidenceSha256Schema,
  directoryImageSha256s: z.array(EvidenceSha256Schema).min(1).max(30)
    .refine((hashes) => new Set(hashes).size === hashes.length),
  observedPublisher: z.string().trim().min(1).max(120),
  observedEditionName: z.string().trim().min(1).max(120),
  observedVolume: z.string().trim().min(1).max(80),
  observedIsbn: z.string().trim().min(10).max(24).nullable(),
  editionStatement: z.string().trim().min(1).max(240),
  impressionStatement: z.string().trim().min(1).max(240),
  directoryDecision: z.enum(["MATCH", "CHANGES_REQUIRED", "REJECTED"]),
  overallDecision: z.enum(["MATCH", "CHANGES_REQUIRED", "REJECTED"]),
  currentUseConfirmed: z.boolean(),
  comment: z.string().trim().min(4).max(2_000),
  attestation: z.literal("REVIEWED_AGAINST_HOUSEHOLD_PHYSICAL_COPY"),
}).strict();
export type TextbookPhysicalCopyReviewResult = z.infer<typeof TextbookPhysicalCopyReviewResultSchema>;

export const RetireTextbookInputSchema = z.object({
  reason: z.string().trim().min(4).max(240),
  confirmation: z.literal("RETIRE_TEXTBOOK"),
}).strict();
export type RetireTextbookInput = z.infer<typeof RetireTextbookInputSchema>;

export const SubmitStudentTextbookContextInputSchema = z.object({
  reportedPublisher: z.string().trim().min(1).max(120),
  reportedEdition: z.string().trim().min(1).max(120),
  reportedVolume: z.string().trim().min(1).max(80),
  reportedDirectory: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  confirmation: z.literal("SUBMIT_TEXTBOOK_INFORMATION"),
}).strict();
export type SubmitStudentTextbookContextInput = z.infer<typeof SubmitStudentTextbookContextInputSchema>;

export const ConfirmStudentTextbookContextInputSchema = z.object({
  textbookEditionId: z.uuid(),
  confirmation: z.literal("CONFIRM_STUDENT_TEXTBOOK"),
}).strict();
export type ConfirmStudentTextbookContextInput = z.infer<typeof ConfirmStudentTextbookContextInputSchema>;

export const UpdateCurrentUnitInputSchema = z.object({
  unitId: z.uuid(),
  confirmation: z.literal("UPDATE_CURRENT_UNIT"),
}).strict();
export type UpdateCurrentUnitInput = z.infer<typeof UpdateCurrentUnitInputSchema>;

export const TextbookSummarySchema = z.object({
  id: z.uuid(),
  subjectCode: SubjectCodeSchema,
  grade: GradeSchema,
  publisher: z.string().trim().min(1).max(120),
  editionName: z.string().trim().min(1).max(120),
  volume: z.string().trim().min(1).max(80),
  status: ContentVerificationStatusSchema,
}).strict();
export type TextbookSummary = z.infer<typeof TextbookSummarySchema>;

const GenericGuidanceContextSchema = z.object({
  mode: z.literal("GENERIC_GUIDANCE"),
  studentUserId: z.uuid(),
  subjectCode: SubjectCodeSchema,
  grade: GradeSchema,
  hasPendingSubmission: z.boolean(),
}).strict();

const AlignedTextbookContextSchema = z.object({
  mode: z.literal("TEXTBOOK_ALIGNED"),
  studentUserId: z.uuid(),
  subjectCode: SubjectCodeSchema,
  grade: GradeSchema,
  textbook: TextbookSummarySchema.extend({ status: z.literal("CONFIRMED") }),
  currentUnit: z.object({ id: z.uuid(), ordinal: z.number().int().positive(), title: z.string() }).strict().nullable(),
}).strict();

export const StudentTextbookContextResponseSchema = z.discriminatedUnion("mode", [
  GenericGuidanceContextSchema,
  AlignedTextbookContextSchema,
]);
export type StudentTextbookContextResponse = z.infer<typeof StudentTextbookContextResponseSchema>;
