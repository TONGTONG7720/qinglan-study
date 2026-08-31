import { z } from "zod";
import { SubjectCodeSchema } from "./curriculum.js";

const UuidSchema = z.uuid();

const ExportMasterySchema = z.object({
  subjectCode: SubjectCodeSchema,
  scopeKey: z.string(),
  score: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().nonnegative(),
}).strict();

const ExportExamSchema = z.object({
  title: z.string(),
  subjectCode: SubjectCodeSchema,
  occurredAt: z.iso.datetime(),
  totalScore: z.number().nonnegative(),
  totalMaxScore: z.number().positive(),
}).strict();

const ExportStudentSchema = z.object({
  userId: UuidSchema,
  displayName: z.string(),
  grade: z.number().int().min(7).max(9),
  dailyMinutes: z.number().int().positive(),
  mastery: z.array(ExportMasterySchema),
  exams: z.array(ExportExamSchema),
  weeklyReportWeeks: z.array(z.iso.date()),
}).strict();

export const ExportArchiveSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime(),
  family: z.object({ id: UuidSchema, name: z.string() }).strict(),
  members: z.array(z.object({
    userId: UuidSchema,
    displayName: z.string(),
    roles: z.array(z.enum(["STUDENT", "GUARDIAN", "ADMIN"])),
    accessLevel: z.enum(["OWNER", "MEMBER"]).nullable(),
  }).strict()),
  students: z.array(ExportStudentSchema),
}).strict();
export type ExportArchive = z.infer<typeof ExportArchiveSchema>;

export const CreateFamilyExportInputSchema = z.object({ confirmation: z.literal("EXPORT_FAMILY_DATA") }).strict();
export type CreateFamilyExportInput = z.infer<typeof CreateFamilyExportInputSchema>;

export const FamilyExportResponseSchema = z.object({
  id: UuidSchema,
  familyId: UuidSchema,
  status: z.enum(["READY", "EXPIRED", "FAILED"]),
  expiresAt: z.iso.datetime(),
  archive: ExportArchiveSchema.nullable(),
}).strict();
export type FamilyExportResponse = z.infer<typeof FamilyExportResponseSchema>;

export const PersonalDeletionInputSchema = z.object({ confirmation: z.literal("DELETE_PERSONAL_ACCOUNT") }).strict();
export type PersonalDeletionInput = z.infer<typeof PersonalDeletionInputSchema>;
export const FamilyDeletionInputSchema = z.object({ confirmation: z.literal("DELETE_FAMILY") }).strict();
export type FamilyDeletionInput = z.infer<typeof FamilyDeletionInputSchema>;

export const DeletionRequestResponseSchema = z.object({
  id: UuidSchema,
  familyId: UuidSchema,
  type: z.enum(["PERSONAL_GUARDIAN", "FAMILY"]),
  targetUserId: UuidSchema.nullable(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]),
  executeAfter: z.iso.datetime(),
}).strict();
export type DeletionRequestResponse = z.infer<typeof DeletionRequestResponseSchema>;

export const RunRetentionJobsInputSchema = z.object({
  limit: z.number().int().min(1).max(50),
  confirmation: z.literal("RUN_RETENTION_JOBS"),
}).strict();
export type RunRetentionJobsInput = z.infer<typeof RunRetentionJobsInputSchema>;

export const RetentionRunResponseSchema = z.object({
  claimed: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
}).strict();
export type RetentionRunResponse = z.infer<typeof RetentionRunResponseSchema>;

export const SecurityDecisionSchema = z.enum(["ALLOW", "SAFE_REDIRECT", "BLOCK"]);
export type SecurityDecision = z.infer<typeof SecurityDecisionSchema>;
export const SecurityPolicyInputSchema = z.object({
  category: z.enum(["ACADEMIC_REQUEST", "ANSWER_SEEKING", "SELF_HARM", "VIOLENCE", "PERSONAL_DATA"]),
  signalCode: z.string().trim().min(1).max(80).regex(/^[A-Z0-9_]+$/u),
}).strict();
export type SecurityPolicyInput = z.infer<typeof SecurityPolicyInputSchema>;
export const SecurityPolicyResponseSchema = z.object({ decision: SecurityDecisionSchema }).strict();

export function decideSecurityPolicy(input: SecurityPolicyInput): SecurityDecision {
  if (input.category === "ACADEMIC_REQUEST") return "ALLOW";
  if (input.category === "ANSWER_SEEKING") return "SAFE_REDIRECT";
  return "BLOCK";
}
