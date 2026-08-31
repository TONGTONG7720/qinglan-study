import type { CurrentUser } from "@study/contracts";
import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PasswordService } from "../auth/password.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { FamilyService } from "./family.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "family-consent-test-";

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
      confirmation: "GRANT_STUDENT_CONSENT",
    }, "family-consent-grant-0001");
    expect(granted.revokedAt).toBeNull();

    const replayed = await service.grantStudentConsent(owner, familyId, studentUserId, {
      policyVersion: "PRIVACY_POLICY_2026_V1",
      confirmation: "GRANT_STUDENT_CONSENT",
    }, "family-consent-grant-0001");
    expect(replayed.id).toBe(granted.id);
    expect(await prisma.consent.count({
      where: { guardianUserId: owner.id, studentUserId, policyVersion: "PRIVACY_POLICY_2026_V1" },
    })).toBe(1);

    const revoked = await service.revokeStudentConsent(owner, familyId, studentUserId, {
      policyVersion: "PRIVACY_POLICY_2026_V1",
      confirmation: "REVOKE_STUDENT_CONSENT",
    }, "family-consent-revoke-0001");
    expect(revoked.revokedAt).not.toBeNull();
  });

  it("does not disclose the student to an unlinked guardian", async () => {
    await expect(service.grantStudentConsent(unrelatedGuardian, familyId, studentUserId, {
      policyVersion: "PRIVACY_POLICY_2026_V1",
      confirmation: "GRANT_STUDENT_CONSENT",
    }, "family-consent-denied-0001")).rejects.toBeInstanceOf(NotFoundException);
  });
});
