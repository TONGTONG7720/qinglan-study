import { describe, expect, it } from "vitest";
import {
  CompletePrivateObjectUploadInputSchema, ConfirmOcrInputSchema,
  CreatePrivateObjectInputSchema, CreatePrivateObjectReadGrantInputSchema,
  DeletePrivateObjectInputSchema, ModelPurposeSchema, OcrResultSchema,
  ReserveBudgetInputSchema, RetryOcrInputSchema, RetryPrivateObjectUploadInputSchema,
} from "./ai-gateway.js";

describe("Phase 6 gateway and OCR contracts", () => {
  it("fixes model purposes and integer fen budgets", () => {
    expect(ModelPurposeSchema.options).toEqual(["OCR", "TUTOR_FAST", "TUTOR_REASONING", "CLASSIFY", "REPORT"]);
    expect(ReserveBudgetInputSchema.safeParse({ purpose: "OCR", amountFen: 12, dedupeKey: "phase6-budget-reserve-0001" }).success).toBe(true);
    expect(ReserveBudgetInputSchema.safeParse({ purpose: "OCR", amountFen: 1.5, dedupeKey: "phase6-budget-reserve-0001" }).success).toBe(false);
  });

  it("rejects unsafe object metadata", () => {
    const valid = { mimeType: "image/jpeg", sizeBytes: 500_000, width: 1200, height: 1600, sha256: "a".repeat(64) };
    expect(CreatePrivateObjectInputSchema.safeParse(valid).success).toBe(true);
    expect(CreatePrivateObjectInputSchema.safeParse({ ...valid, mimeType: "text/html" }).success).toBe(false);
    expect(CreatePrivateObjectInputSchema.safeParse({ ...valid, sizeBytes: 20_000_000 }).success).toBe(false);
    expect(CreatePrivateObjectInputSchema.safeParse({ ...valid, width: 20_000 }).success).toBe(false);
  });

  it("requires confirmation for low-confidence OCR", () => {
    expect(OcrResultSchema.parse({ questionId: "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c", status: "OCR_REVIEW", text: "x", confidence: 0.6 }).status).toBe("OCR_REVIEW");
    expect(ConfirmOcrInputSchema.safeParse({ confirmedText: "确认后的题目", confirmation: "CONFIRM_OCR" }).success).toBe(true);
  });

  it("requires explicit confirmations for every private-object state transition", () => {
    expect(CompletePrivateObjectUploadInputSchema.safeParse({ confirmation: "COMPLETE_PRIVATE_OBJECT_UPLOAD" }).success).toBe(true);
    expect(CreatePrivateObjectReadGrantInputSchema.safeParse({ confirmation: "READ_PRIVATE_OBJECT" }).success).toBe(true);
    expect(RetryPrivateObjectUploadInputSchema.safeParse({ confirmation: "RETRY_PRIVATE_OBJECT_UPLOAD" }).success).toBe(true);
    expect(DeletePrivateObjectInputSchema.safeParse({ confirmation: "DELETE_PRIVATE_OBJECT" }).success).toBe(true);
    expect(RetryOcrInputSchema.safeParse({ confirmation: "RETRY_OCR" }).success).toBe(true);
    expect(DeletePrivateObjectInputSchema.safeParse({ confirmation: "RETRY_OCR" }).success).toBe(false);
  });
});
