import type { SessionPrincipal } from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../prisma/prisma.service.js";
import { FamilyAccessService } from "./family-access.service.js";
import { ResourceNotFoundError, ScopeAuthorizationService } from "./scope-authorization.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "phase2-boundary-";

describe("database-backed family boundaries", () => {
  let prisma: PrismaService;
  let service: FamilyAccessService;
  let principal: SessionPrincipal;
  let familyAId: string;
  let familyBId: string;
  let studentAId: string;
  let studentBId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    service = new FamilyAccessService(prisma, new ScopeAuthorizationService());

    await prisma.family.deleteMany({ where: { name: { startsWith: "Phase2 Boundary" } } });
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });

    const guardian = await prisma.user.create({
      data: {
        loginId: `${loginPrefix}guardian@example.test`,
        passwordHash: "$argon2id$fictional",
        displayName: "边界测试监护人",
        roles: ["GUARDIAN"],
      },
    });
    const studentA = await prisma.user.create({
      data: {
        loginId: `${loginPrefix}student-a`,
        passwordHash: "$argon2id$fictional",
        displayName: "边界测试学生甲",
        roles: ["STUDENT"],
      },
    });
    const studentB = await prisma.user.create({
      data: {
        loginId: `${loginPrefix}student-b`,
        passwordHash: "$argon2id$fictional",
        displayName: "边界测试学生乙",
        roles: ["STUDENT"],
      },
    });
    const guardianB = await prisma.user.create({
      data: {
        loginId: `${loginPrefix}guardian-b@example.test`,
        passwordHash: "$argon2id$fictional",
        displayName: "边界测试家庭乙所有者",
        roles: ["GUARDIAN"],
      },
    });
    const familyA = await prisma.family.create({
      data: {
        name: "Phase2 Boundary Family A",
        memberships: { create: [
          { userId: guardian.id, role: "GUARDIAN", accessLevel: "OWNER" },
          { userId: studentA.id, role: "STUDENT" },
        ] },
      },
    });
    const familyB = await prisma.family.create({
      data: {
        name: "Phase2 Boundary Family B",
        memberships: { create: [
          { userId: guardianB.id, role: "GUARDIAN", accessLevel: "OWNER" },
          { userId: studentB.id, role: "STUDENT" },
        ] },
      },
    });
    await prisma.guardianStudentRelation.create({
      data: { familyId: familyA.id, guardianUserId: guardian.id, studentUserId: studentA.id },
    });

    familyAId = familyA.id;
    familyBId = familyB.id;
    studentAId = studentA.id;
    studentBId = studentB.id;
    principal = {
      sessionId: "018f0f4e-5555-7555-8555-555555555555",
      userId: guardian.id,
      roles: ["GUARDIAN"],
      activeFamilyId: familyA.id,
    };
  });

  afterAll(async () => {
    await prisma.family.deleteMany({ where: { id: { in: [familyAId, familyBId] } } });
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });
    await prisma.onModuleDestroy();
  });

  it("allows only the active linked student", async () => {
    await expect(service.assertLinkedStudent(principal, familyAId, studentAId)).resolves.toBeUndefined();
    await expect(service.assertLinkedStudent(principal, familyBId, studentBId)).rejects.toThrow(
      ResourceNotFoundError,
    );
  });

  it("terminates access immediately after relation revocation", async () => {
    await prisma.guardianStudentRelation.updateMany({
      where: { familyId: familyAId, guardianUserId: principal.userId, studentUserId: studentAId },
      data: { revokedAt: new Date() },
    });
    await expect(service.assertLinkedStudent(principal, familyAId, studentAId)).rejects.toThrow(
      ResourceNotFoundError,
    );
  });
});
