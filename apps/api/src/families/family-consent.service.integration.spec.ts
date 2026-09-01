import type { CurrentUser } from "@study/contracts";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PasswordService } from "../auth/password.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { FamilyService } from "./family.service.js";

const databaseUrl = process.env.TEST_DATABASE_URL
  ?? "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "family-consent-test-";
const policyUrl = "https://policy.example.test/privacy/2026-v1";
const policyDocumentSha256 = "a".repeat(64);

describe("family student consent lifecycle", () => {
  let prisma: PrismaService;
  let service: FamilyService;
  let familyId: string;
  let studentUserId: string;
  let owner: CurrentUser;
  let unrelatedGuardian: CurrentUser;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });
    service = new FamilyService(prisma, new PasswordService(), new IdempotencyService(prisma));

    const created = await prisma.$transaction(async (transaction) => {
      const ownerUser = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}owner@example.test`,
          passwordHash: "$argon2id$fictional",
          displayName: "同意测试 OWNER",
          roles: ["GUARDIAN"],
        },
      });
      const unrelatedUser = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}unrelated@example.test`,
          passwordHash: "$argon2id$fictional",
          displayName: "无关系监护人",
          roles: ["GUARDIAN"],
        },
      });
      const student = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}student@example.test`,
          passwordHash: "$argon2id$fictional",
          displayName: "同意测试学生",
          roles: ["STUDENT"],
        },
      });
      const family = await transaction.family.create({
        data: {
          name: "同意生命周期测试家庭",
          memberships: {
            create: [
              { userId: ownerUser.id, role: "GUARDIAN", accessLevel: "OWNER" },
              { userId: unrelatedUser.id, role: "GUARDIAN", accessLevel: "MEMBER" },
              { userId: student.id, role: "STUDENT" },
            ],
          },
          studentProfiles: { create: { userId: student.id, grade: 7, dailyMinutes: 40 } },
          guardianLinks: {
            create: { guardianUserId: ownerUser.id, studentUserId: student.id },
          },
        },
      });
      return { ownerUser, unrelatedUser, student, family };
    });

    familyId = created.family.id;
    studentUserId = created.student.id;
    owner = {
      id: created.ownerUser.id,
      displayName: created.ownerUser.displayName,
      roles: ["GUARDIAN"],
      activeFamilyId: familyId,
    };
    unrelatedGuardian = {
      id: created.unrelatedUser.id,
      displayName: created.unrelatedUser.displayName,
      roles: ["GUARDIAN"],
      activeFamilyId: familyId,
    };
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { familyId } });
    await prisma.family.deleteMany({ where: { id: familyId } });
    await prisma.operation.deleteMany({
      where: { kind: { in: ["GRANT_STUDENT_CONSENT", "REVOKE_STUDENT_CONSENT"] } },
    });
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });
    await prisma.onModuleDestroy();
  });

  it("grants, idempotently refreshes, and revokes one policy version", async () => {
    const granted = await service.grantStudentConsent(owner, familyId, studentUserId, {
      policyVersion: "PRIVACY_POLICY_2026_V1",
      policyUrl,
      policyDocumentSha256,
      confirmation: "GRANT_STUDENT_CONSENT",
    }, "family-consent-grant-0001");
    expect(granted.revokedAt).toBeNull();
    expect(granted).toMatchObject({ policyUrl, policyDocumentSha256 });

    const replayed = await service.grantStudentConsent(owner, familyId, studentUserId, {
      policyVersion: "PRIVACY_POLICY_2026_V1",
      policyUrl,
      policyDocumentSha256,
      confirmation: "GRANT_STUDENT_CONSENT",
    }, "family-consent-grant-0001");
    expect(replayed.id).toBe(granted.id);
    expect(await prisma.consent.count({
      where: { guardianUserId: owner.id, studentUserId, policyVersion: "PRIVACY_POLICY_2026_V1" },
    })).toBe(1);
    await expect(prisma.consent.update({
      where: { id: granted.id },
      data: {
        policyUrl: "https://policy.example.test/privacy/reinterpreted",
        policyDocumentSha256: "b".repeat(64),
      },
    })).rejects.toThrow(/immutable/u);

    const revoked = await service.revokeStudentConsent(owner, familyId, studentUserId, {
      policyVersion: "PRIVACY_POLICY_2026_V1",
      confirmation: "REVOKE_STUDENT_CONSENT",
    }, "family-consent-revoke-0001");
    expect(revoked.revokedAt).not.toBeNull();
  });

  it("refuses to reinterpret one policy version with different document evidence", async () => {
    await expect(service.grantStudentConsent(owner, familyId, studentUserId, {
      policyVersion: "PRIVACY_POLICY_2026_V1",
      policyUrl: "https://policy.example.test/privacy/replaced",
      policyDocumentSha256: "b".repeat(64),
      confirmation: "GRANT_STUDENT_CONSENT",
    }, "family-consent-evidence-conflict-0001")).rejects.toBeInstanceOf(ConflictException);
  });

  it("accepts only the server-configured policy evidence in production", async () => {
    const previous = new Map<string, string | undefined>();
    for (const key of [
      "NODE_ENV",
      "PRIVACY_POLICY_VERSION",
      "PRIVACY_POLICY_URL",
      "PRIVACY_POLICY_DOCUMENT_SHA256",
    ]) previous.set(key, process.env[key]);
    process.env.NODE_ENV = "production";
    process.env.PRIVACY_POLICY_VERSION = "PRIVACY_POLICY_2026_V2";
    process.env.PRIVACY_POLICY_URL = policyUrl;
    process.env.PRIVACY_POLICY_DOCUMENT_SHA256 = policyDocumentSha256;
    try {
      const configured = await service.grantStudentConsent(owner, familyId, studentUserId, {
        policyVersion: "PRIVACY_POLICY_2026_V2",
        policyUrl,
        policyDocumentSha256,
        confirmation: "GRANT_STUDENT_CONSENT",
      }, "family-consent-production-configured-0001");
      expect(configured.policyVersion).toBe("PRIVACY_POLICY_2026_V2");
      await expect(service.grantStudentConsent(owner, familyId, studentUserId, {
        policyVersion: "PRIVACY_POLICY_2026_V3",
        policyUrl,
        policyDocumentSha256,
        confirmation: "GRANT_STUDENT_CONSENT",
      }, "family-consent-production-mismatch-0001")).rejects.toBeInstanceOf(ConflictException);
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = value;
      }
    }
  });

  it("does not disclose the student to an unlinked guardian", async () => {
    await expect(service.grantStudentConsent(unrelatedGuardian, familyId, studentUserId, {
      policyVersion: "PRIVACY_POLICY_2026_V1",
      policyUrl,
      policyDocumentSha256,
      confirmation: "GRANT_STUDENT_CONSENT",
    }, "family-consent-denied-0001")).rejects.toBeInstanceOf(NotFoundException);
  });
});
