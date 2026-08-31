import { describe, expect, it } from "vitest";

import {
  ConfirmStudentTextbookContextInputSchema,
  ConfirmTextbookInputSchema,
  CreateTextbookDraftInputSchema,
  StudentTextbookContextResponseSchema,
  SubmitStudentTextbookContextInputSchema,
  TextbookPhysicalCopyReviewResultSchema,
  UpdateCurrentUnitInputSchema,
  availableSubjectsForGrade,
  isSubjectAvailableForGrade,
} from "./curriculum.js";

const textbookId = "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c";
const unitId = "018f0f4e-3b6e-7bb1-9e55-b644f1c2103d";

describe("Phase 4 curriculum contracts", () => {
  it("fixes the approved grade-subject matrix", () => {
    expect(availableSubjectsForGrade(7)).toEqual([
      "CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY",
    ]);
    expect(availableSubjectsForGrade(8)).toEqual([
      "CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY", "PHYSICS",
    ]);
    expect(availableSubjectsForGrade(9)).toEqual([
      "CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY", "PHYSICS", "CHEMISTRY",
    ]);
    expect(isSubjectAvailableForGrade(7, "PHYSICS")).toBe(false);
    expect(isSubjectAvailableForGrade(8, "CHEMISTRY")).toBe(false);
    expect(isSubjectAvailableForGrade(9, "CHEMISTRY")).toBe(true);
  });

  it("creates only explicit draft textbook structures", () => {
    expect(CreateTextbookDraftInputSchema.safeParse({
      subjectCode: "MATH",
      grade: 8,
      publisher: "虚构测试出版社",
      editionName: "虚构测试版",
      volume: "八年级上册",
      units: [{
        ordinal: 1,
        title: "虚构第一章",
        knowledgeNodes: [{ title: "虚构知识点", objective: "仅供测试" }],
      }],
      confirmation: "CREATE_TEXTBOOK_DRAFT",
    }).success).toBe(true);
    expect(CreateTextbookDraftInputSchema.safeParse({
      subjectCode: "MATH",
      grade: 8,
      publisher: "虚构测试出版社",
      editionName: "虚构测试版",
      volume: "八年级上册",
      status: "CONFIRMED",
      units: [],
      confirmation: "CREATE_TEXTBOOK_DRAFT",
    }).success).toBe(false);
  });

  it("requires source evidence for formal confirmation", () => {
    expect(ConfirmTextbookInputSchema.safeParse({
      sourceReference: "ISBN 000-0-00-000000-0 / 虚构测试资料",
      confirmation: "CONFIRM_TEXTBOOK",
    }).success).toBe(true);
    expect(ConfirmTextbookInputSchema.safeParse({
      confirmation: "CONFIRM_TEXTBOOK",
    }).success).toBe(false);
  });

  it("requires hashed physical-copy evidence without accepting image paths or bytes", () => {
    const review = {
      textbookEditionId: textbookId,
      reviewerReference: "admin-reviewer-01",
      reviewedAt: "2026-08-27T08:00:00.000Z",
      coverImageSha256: "a".repeat(64),
      copyrightPageImageSha256: "b".repeat(64),
      directoryImageSha256s: ["c".repeat(64)],
      observedPublisher: "虚构测试出版社",
      observedEditionName: "虚构测试版",
      observedVolume: "八年级上册",
      observedIsbn: "978-0-00-000000-0",
      editionStatement: "虚构第 1 版",
      impressionStatement: "虚构第 1 次印刷",
      directoryDecision: "MATCH",
      overallDecision: "MATCH",
      currentUseConfirmed: true,
      comment: "测试夹具中的教材身份和目录一致。",
      attestation: "REVIEWED_AGAINST_HOUSEHOLD_PHYSICAL_COPY",
    } as const;
    expect(TextbookPhysicalCopyReviewResultSchema.safeParse(review).success).toBe(true);
    expect(TextbookPhysicalCopyReviewResultSchema.safeParse({
      ...review,
      coverImagePath: "C:/private/student/book.jpg",
    }).success).toBe(false);
    expect(TextbookPhysicalCopyReviewResultSchema.safeParse({
      ...review,
      directoryImageSha256s: ["c".repeat(64), "c".repeat(64)],
    }).success).toBe(false);
  });

  it("separates guardian submission from ADMIN confirmation", () => {
    expect(SubmitStudentTextbookContextInputSchema.safeParse({
      reportedPublisher: "待管理员核验",
      reportedEdition: "待核验版次",
      reportedVolume: "八年级上册",
      reportedDirectory: ["第一章", "第二章"],
      confirmation: "SUBMIT_TEXTBOOK_INFORMATION",
    }).success).toBe(true);
    expect(ConfirmStudentTextbookContextInputSchema.parse({
      textbookEditionId: textbookId,
      confirmation: "CONFIRM_STUDENT_TEXTBOOK",
    }).textbookEditionId).toBe(textbookId);
  });

  it("makes GENERIC_GUIDANCE structurally incapable of claiming alignment", () => {
    const generic = StudentTextbookContextResponseSchema.parse({
      mode: "GENERIC_GUIDANCE",
      studentUserId: textbookId,
      subjectCode: "MATH",
      grade: 8,
      hasPendingSubmission: true,
    });
    expect(generic.mode).toBe("GENERIC_GUIDANCE");
    expect(StudentTextbookContextResponseSchema.safeParse({
      ...generic,
      publisher: "不应泄露",
      editionName: "不应声称已对齐",
    }).success).toBe(false);
  });

  it("allows only a server-issued unit ID as current progress", () => {
    expect(UpdateCurrentUnitInputSchema.parse({
      unitId,
      confirmation: "UPDATE_CURRENT_UNIT",
    }).unitId).toBe(unitId);
  });
});
