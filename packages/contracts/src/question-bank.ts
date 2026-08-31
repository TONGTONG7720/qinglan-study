import { z } from "zod";

import { GradeSchema } from "./identity.js";
import {
  KnowledgeAbilityLevelSchema,
  QuestionBankTypeSchema,
  SubjectCodeSchema,
} from "./curriculum.js";

export const ContentTypeSchema = z.enum([
  "DEFINITION",
  "CONCEPT",
  "FORMULA",
  "EXPERIMENT",
  "EXAMPLE",
  "ILLUSTRATION",
  "SUMMARY",
  "OTHER",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ContentLicenseStatusSchema = z.enum([
  "AUTHORIZED",
  "HOUSEHOLD_PRIVATE",
  "PUBLIC_DOMAIN",
  "LICENSE_REVIEW_REQUIRED",
  "PROHIBITED",
]);
export type ContentLicenseStatus = z.infer<typeof ContentLicenseStatusSchema>;

export const QuestionBankStatusSchema = z.enum([
  "DRAFT",
  "SOLVER_VALIDATED",
  "DEDUPLICATED",
  "FACT_CHECKED",
  "REVIEWED",
  "PUBLISHED",
  "REJECTED",
  "RETIRED",
]);
export type QuestionBankStatus = z.infer<typeof QuestionBankStatusSchema>;

export const QuestionBankSourceTypeSchema = z.enum([
  "ORIGINAL_HUMAN",
  "ORIGINAL_AI",
  "AUTHORIZED_ADAPTATION",
]);
export type QuestionBankSourceType = z.infer<typeof QuestionBankSourceTypeSchema>;

export const QuestionAnswerSchema = z.object({
  kind: z.enum(["TEXT", "CHOICE", "BOOLEAN", "NUMBER", "RUBRIC"]),
  value: z.union([z.string().max(4_000), z.number(), z.boolean(), z.array(z.string().max(40)).max(20)]),
  acceptedAlternatives: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  rubricPoints: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
}).strict();
export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;

const QuestionOptionSchema = z.object({
  key: z.string().trim().min(1).max(10),
  label: z.string().trim().min(1).max(1_000),
}).strict();

export const CreateQuestionBankDraftInputSchema = z.object({
  stableKey: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{7,119}$/u),
  subjectCode: SubjectCodeSchema,
  grade: GradeSchema,
  textbookEditionId: z.uuid(),
  unitId: z.uuid(),
  knowledgeNodeIds: z.array(z.uuid()).min(1).max(10)
    .refine((ids) => new Set(ids).size === ids.length),
  type: QuestionBankTypeSchema,
  difficulty: z.number().int().min(1).max(5),
  abilityLevel: KnowledgeAbilityLevelSchema,
  stem: z.string().trim().min(8).max(10_000),
  options: z.array(QuestionOptionSchema).min(2).max(10).nullable().default(null),
  answer: QuestionAnswerSchema,
  explanation: z.string().trim().min(8).max(10_000),
  hints: z.array(z.string().trim().min(2).max(1_000)).min(1).max(8),
  commonErrorTargets: z.array(z.string().trim().min(2).max(500)).max(20).default([]),
  sourceType: QuestionBankSourceTypeSchema,
  licenseStatus: ContentLicenseStatusSchema,
  sourceReferences: z.array(z.string().trim().min(8).max(500)).min(1).max(20),
  generationModel: z.string().trim().min(1).max(120).nullable().default(null),
  promptVersion: z.string().trim().min(1).max(80).nullable().default(null),
  confirmation: z.literal("CREATE_QUESTION_BANK_DRAFT"),
}).strict().superRefine((input, context) => {
  const choice = input.type === "SINGLE_CHOICE" || input.type === "MULTIPLE_CHOICE";
  if (choice !== (input.options !== null)) {
    context.addIssue({ code: "custom", message: "Choice questions require options; non-choice questions must not include options", path: ["options"] });
  }
  if (input.sourceType === "ORIGINAL_AI" && (input.generationModel === null || input.promptVersion === null)) {
    context.addIssue({ code: "custom", message: "AI-generated questions require model and prompt version", path: ["generationModel"] });
  }
});
export type CreateQuestionBankDraftInput = z.infer<typeof CreateQuestionBankDraftInputSchema>;

export const ValidateQuestionBankSolverInputSchema = z.object({
  solverAnswer: QuestionAnswerSchema,
  solverExplanation: z.string().trim().min(8).max(10_000),
  solverName: z.string().trim().min(1).max(120),
  confirmation: z.literal("VALIDATE_QUESTION_BANK_SOLVER"),
}).strict();
export type ValidateQuestionBankSolverInput = z.infer<typeof ValidateQuestionBankSolverInputSchema>;

export const IndependentQuestionBankSolverResultSchema = z.object({
  questionBankItemId: z.uuid(),
  stableKey: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{7,119}$/u),
  solverReference: z.string().trim().min(3).max(120),
  solverKind: z.enum(["HUMAN", "INDEPENDENT_MODEL"]),
  answer: QuestionAnswerSchema,
  explanation: z.string().trim().min(8).max(10_000),
  solvedAt: z.iso.datetime(),
  attestation: z.literal("ANSWERED_WITHOUT_REFERENCE_ACCESS"),
}).strict();
export type IndependentQuestionBankSolverResult = z.infer<typeof IndependentQuestionBankSolverResultSchema>;

export const DeduplicateQuestionBankInputSchema = z.object({
  confirmation: z.literal("DEDUPLICATE_QUESTION_BANK_ITEM"),
}).strict();
export type DeduplicateQuestionBankInput = z.infer<typeof DeduplicateQuestionBankInputSchema>;

export const FactCheckQuestionBankInputSchema = z.object({
  passed: z.boolean(),
  notes: z.string().trim().min(4).max(2_000),
  confirmation: z.literal("FACT_CHECK_QUESTION_BANK_ITEM"),
}).strict();
export type FactCheckQuestionBankInput = z.infer<typeof FactCheckQuestionBankInputSchema>;

export const ReviewQuestionBankInputSchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  comment: z.string().trim().min(4).max(1_000),
  confirmation: z.literal("REVIEW_QUESTION_BANK_ITEM"),
}).strict();
export type ReviewQuestionBankInput = z.infer<typeof ReviewQuestionBankInputSchema>;

export const PublishQuestionBankInputSchema = z.object({
  confirmation: z.literal("PUBLISH_QUESTION_BANK_ITEM"),
}).strict();
export type PublishQuestionBankInput = z.infer<typeof PublishQuestionBankInputSchema>;

export const RegisterTextbookAssetInputSchema = z.object({
  textbookEditionId: z.uuid(),
  objectKey: z.string().trim().min(20).max(300),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive().max(2_000_000_000),
  pageCount: z.number().int().positive().max(2_000),
  licenseStatus: ContentLicenseStatusSchema,
  licenseReference: z.string().trim().min(8).max(500),
  sourceVersion: z.string().trim().min(1).max(80),
  confirmation: z.literal("REGISTER_PRIVATE_TEXTBOOK_ASSET"),
}).strict().superRefine((input, context) => {
  if (!input.objectKey.startsWith(`textbooks/${input.textbookEditionId}/`) || input.objectKey.includes("://")) {
    context.addIssue({ code: "custom", message: "Textbook assets require a private object key under their textbook prefix", path: ["objectKey"] });
  }
});
export type RegisterTextbookAssetInput = z.infer<typeof RegisterTextbookAssetInputSchema>;

export const QuestionBankItemSummarySchema = z.object({
  id: z.uuid(),
  stableKey: z.string(),
  subjectCode: SubjectCodeSchema,
  grade: GradeSchema,
  textbookEditionId: z.uuid(),
  unitId: z.uuid(),
  type: QuestionBankTypeSchema,
  difficulty: z.number().int().min(1).max(5),
  abilityLevel: KnowledgeAbilityLevelSchema,
  status: QuestionBankStatusSchema,
}).strict();
export type QuestionBankItemSummary = z.infer<typeof QuestionBankItemSummarySchema>;

export const TextbookAssetSummarySchema = z.object({
  id: z.uuid(),
  textbookEditionId: z.uuid(),
  objectKey: z.string(),
  sha256: z.string(),
  mimeType: z.literal("application/pdf"),
  pageCount: z.number().int().positive(),
  licenseStatus: ContentLicenseStatusSchema,
  status: z.enum(["REGISTERED", "AVAILABLE", "QUARANTINED", "RETIRED"]),
}).strict();
export type TextbookAssetSummary = z.infer<typeof TextbookAssetSummarySchema>;
