import { describe, expect, it } from "vitest";

import {
  AcceptOwnershipTransferInputSchema,
  CreateJoinAuthorizationInputSchema,
  CreateStudentInputSchema,
  GrantStudentConsentInputSchema,
  GrantGuardianRelationInputSchema,
  IssueInvitationInputSchema,
  LeaveFamilyInputSchema,
  ProposeOwnershipTransferInputSchema,
  RedeemInvitationInputSchema,
  RemoveMemberInputSchema,
  RevokeGuardianRelationInputSchema,
  RevokeStudentConsentInputSchema,
} from "./family.js";

const familyId = "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c";
const studentId = "018f0f4e-3b6e-7bb1-9e55-b644f1c2103d";
const guardianId = "018f0f4e-4c7f-7cc2-af66-c75502d3214e";

describe("Phase 3 family contracts", () => {
  it("keeps NEW_FAMILY and JOIN_FAMILY invitation signing disjoint", () => {
    expect(IssueInvitationInputSchema.safeParse({
      mode: "NEW_FAMILY",
      expiresInHours: 24,
      confirmation: "ISSUE_INVITATION",
    }).success).toBe(true);
    expect(IssueInvitationInputSchema.safeParse({
      mode: "NEW_FAMILY",
      authorizationId: guardianId,
      expiresInHours: 24,
      confirmation: "ISSUE_INVITATION",
    }).success).toBe(false);
    expect(IssueInvitationInputSchema.safeParse({
      mode: "JOIN_FAMILY",
      authorizationId: guardianId,
      expiresInHours: 24,
      confirmation: "ISSUE_INVITATION",
    }).success).toBe(true);
    expect(IssueInvitationInputSchema.safeParse({
      mode: "JOIN_FAMILY",
      familyId,
      linkedStudentIds: [studentId],
      expiresInHours: 24,
      confirmation: "ISSUE_INVITATION",
    }).success).toBe(false);
  });

  it("requires owner-selected students and explicit confirmations", () => {
    expect(CreateJoinAuthorizationInputSchema.safeParse({
      linkedStudentIds: [studentId],
      expiresInHours: 24,
      confirmation: "AUTHORIZE_JOIN",
    }).success).toBe(true);
    expect(CreateJoinAuthorizationInputSchema.safeParse({
      linkedStudentIds: [],
      expiresInHours: 24,
      confirmation: "AUTHORIZE_JOIN",
    }).success).toBe(false);
    expect(CreateJoinAuthorizationInputSchema.safeParse({
      linkedStudentIds: [studentId],
      expiresInHours: 24,
      confirmation: "CONFIRM",
    }).success).toBe(false);
  });

  it("binds redemption shape to the signed invitation mode", () => {
    const account = {
      token: "a".repeat(43),
      loginId: "guardian@example.test",
      password: "fictional-password-123",
      displayName: "测试监护人",
      idempotencyKey: "redeem-20260822-0001",
    };
    expect(RedeemInvitationInputSchema.safeParse({
      ...account,
      mode: "NEW_FAMILY",
      familyName: "海棠测试家庭",
      confirmation: "CREATE_FAMILY",
    }).success).toBe(true);
    expect(RedeemInvitationInputSchema.safeParse({
      ...account,
      mode: "JOIN_FAMILY",
      confirmation: "JOIN_FAMILY",
    }).success).toBe(true);
    expect(RedeemInvitationInputSchema.safeParse({
      ...account,
      mode: "JOIN_FAMILY",
      familyName: "客户端不能选择家庭",
      confirmation: "JOIN_FAMILY",
    }).success).toBe(false);
  });

  it("constrains student credentials and learning profile", () => {
    expect(CreateStudentInputSchema.safeParse({
      loginId: "student.phase3@example.test",
      password: "fictional-password-123",
      displayName: "测试学生",
      grade: 8,
      dailyMinutes: 40,
      confirmation: "CREATE_STUDENT",
    }).success).toBe(true);
    expect(CreateStudentInputSchema.safeParse({
      loginId: "student.phase3@example.test",
      password: "short",
      displayName: "测试学生",
      grade: 10,
      dailyMinutes: 5,
      confirmation: "CREATE_STUDENT",
    }).success).toBe(false);
  });

  it("requires an explicit policy version and action-specific consent confirmations", () => {
    expect(GrantStudentConsentInputSchema.safeParse({
      policyVersion: "PRIVACY_POLICY_2026_V1",
      confirmation: "GRANT_STUDENT_CONSENT",
    }).success).toBe(true);
    expect(GrantStudentConsentInputSchema.safeParse({
      policyVersion: "PRIVACY_POLICY_2026_V1",
      confirmation: "REVOKE_STUDENT_CONSENT",
    }).success).toBe(false);
    expect(RevokeStudentConsentInputSchema.safeParse({
      policyVersion: "PRIVACY_POLICY_2026_V1",
      confirmation: "REVOKE_STUDENT_CONSENT",
    }).success).toBe(true);
    expect(RevokeStudentConsentInputSchema.safeParse({
      policyVersion: "",
      confirmation: "REVOKE_STUDENT_CONSENT",
    }).success).toBe(false);
  });

  it("uses action-specific confirmation payloads for relationships", () => {
    expect(GrantGuardianRelationInputSchema.parse({
      guardianUserId: guardianId,
      studentUserId: studentId,
      confirmation: "GRANT_RELATION",
    }).confirmation).toBe("GRANT_RELATION");
    expect(RevokeGuardianRelationInputSchema.parse({
      guardianUserId: guardianId,
      studentUserId: studentId,
      confirmation: "REVOKE_RELATION",
    }).confirmation).toBe("REVOKE_RELATION");
    expect(RemoveMemberInputSchema.parse({ confirmation: "REMOVE_MEMBER" }).confirmation)
      .toBe("REMOVE_MEMBER");
    expect(LeaveFamilyInputSchema.parse({ confirmation: "LEAVE_FAMILY" }).confirmation)
      .toBe("LEAVE_FAMILY");
    expect(ProposeOwnershipTransferInputSchema.parse({
      targetUserId: guardianId,
      confirmation: "PROPOSE_OWNERSHIP_TRANSFER",
    }).targetUserId).toBe(guardianId);
    expect(AcceptOwnershipTransferInputSchema.parse({
      confirmation: "ACCEPT_OWNERSHIP_TRANSFER",
    }).confirmation).toBe("ACCEPT_OWNERSHIP_TRANSFER");
  });
});
