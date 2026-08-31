import { z } from "zod";

export const ModelPurposeSchema = z.enum(["OCR", "TUTOR_FAST", "TUTOR_REASONING", "CLASSIFY", "REPORT"]);
export type ModelPurpose = z.infer<typeof ModelPurposeSchema>;

export const ReserveBudgetInputSchema = z.object({
  purpose: ModelPurposeSchema,
  amountFen: z.number().int().positive().max(1_000_000),
  dedupeKey: z.string().trim().min(16).max(128),
}).strict();

export const CreatePrivateObjectInputSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(10_000_000),
  width: z.number().int().min(32).max(12_000),
  height: z.number().int().min(32).max(12_000),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
}).strict().refine((value) => value.width * value.height <= 40_000_000);
export type CreatePrivateObjectInput = z.infer<typeof CreatePrivateObjectInputSchema>;

export const PrivateObjectResponseSchema = z.object({
  id: z.uuid(), ownerStudentUserId: z.uuid(), mimeType: z.string(), sizeBytes: z.number().int(),
  storageKey: z.string(), uploadUrl: z.string(), expiresAt: z.iso.datetime(),
}).strict();
export type PrivateObjectResponse = z.infer<typeof PrivateObjectResponseSchema>;

export const StartOcrInputSchema = z.object({
  objectId: z.uuid(),
  confirmation: z.literal("START_OCR"),
}).strict();

export const ConfirmOcrInputSchema = z.object({
  confirmedText: z.string().trim().min(1).max(20_000),
  confirmation: z.literal("CONFIRM_OCR"),
}).strict();
export type ConfirmOcrInput = z.infer<typeof ConfirmOcrInputSchema>;

export const OcrResultSchema = z.discriminatedUnion("status", [
  z.object({ questionId: z.uuid(), status: z.literal("OCR_REVIEW"), text: z.string(), confidence: z.number().min(0).max(1) }).strict(),
  z.object({ questionId: z.uuid(), status: z.literal("READY"), text: z.string(), confidence: z.number().min(0).max(1) }).strict(),
  z.object({ questionId: z.uuid(), status: z.literal("FAILED"), errorCode: z.string() }).strict(),
]);
export type OcrResult = z.infer<typeof OcrResultSchema>;

export const BudgetReservationResponseSchema = z.object({
  id: z.uuid(), status: z.enum(["RESERVED", "SETTLED", "RELEASED"]),
  amountFen: z.number().int(), effectiveCapFen: z.number().int(),
}).strict();

export const ModelGatewayRequestSchema = z.object({
  purpose: ModelPurposeSchema, dedupeKey: z.string().min(16), input: z.record(z.string(), z.unknown()),
}).strict();
export type ModelGatewayRequest = z.infer<typeof ModelGatewayRequestSchema>;

export const ModelGatewayResultSchema = z.object({
  providerCallId: z.string(), output: z.record(z.string(), z.unknown()), costFen: z.number().int().nonnegative(),
}).strict();
export type ModelGatewayResult = z.infer<typeof ModelGatewayResultSchema>;

export const SetFamilyAiBudgetInputSchema = z.object({
  monthlyCapFen: z.number().int().positive().max(1_000_000),
  confirmation: z.literal("SET_FAMILY_AI_BUDGET"),
}).strict();
