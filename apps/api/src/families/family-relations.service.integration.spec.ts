import type { CurrentUser } from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PasswordService } from "../auth/password.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { FamilyService } from "./family.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "phase3-relations-";

describe("Phase 3 family relationship lifecycle", () => {
  let prisma: PrismaService;
  let service: FamilyService;
  let familyId: string;
  let owner: CurrentUser;
  let memberToRemove: CurrentUser;
  let memberToLeave: CurrentUser;
  let studentUserId: string;

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
          displayName: "关系测试 OWNER",
          roles: ["GUARDIAN"],
        },
      });
      const removedUser = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}removed@example.test`,
          passwordHash: "$argon2id$fictional",
          displayName: "待移除 MEMBER",
          roles: ["GUARDIAN"],
        },
      });
      const leavingUser = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}leaving@example.test`,
          passwordHash: "$argon2id$fictional",
          displayName: "主动离开 MEMBER",
          roles: ["GUARDIAN"],
        },
      });
      const student = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}student@example.test`,
          passwordHash: "$argon2id$fictional",
          displayName: "关系测试学生",
          roles: ["STUDENT"],
        },
      });
      const family = await transaction.family.create({
        data: {
          name: "Phase 3 Relationship Lifecycle Family",
          memberships: {
            create: [
              { userId: ownerUser.id, role: "GUARDIAN", accessLevel: "OWNER" },
              { userId: removedUser.id, role: "GUARDIAN", accessLevel: "MEMBER" },
              { userId: leavingUser.id, role: "GUARDIAN", accessLevel: "MEMBER" },
              { userId: student.id, role: "STUDENT" },
            ],
          },
          studentProfiles: {
            create: { userId: student.id, grade: 8, dailyMinutes: 40 },
          },
          guardianLinks: {
            create: [
              { guardianUserId: ownerUser.id, studentUserId: student.id },
              { guardianUserId: removedUser.id, studentUserId: student.id },
              { guardianUserId: leavingUser.id, studentUserId: student.id },
            ],
          },
        },
      });
      return { ownerUser, removedUser, leavingUser, student, family };
    });

    familyId = created.family.id;
    studentUserId = created.student.id;
    owner = {
      id: created.ownerUser.id,
      displayName: created.ownerUser.displayName,
      roles: ["GUARDIAN"],
      activeFamilyId: familyId,
    };
    memberToRemove = {
      id: created.removedUser.id,
      displayName: created.removedUser.displayName,
      roles: ["GUARDIAN"],
      activeFamilyId: familyId,
    };
    memberToLeave = {
      id: created.leavingUser.id,
      displayName: created.leavingUser.displayName,
      roles: ["GUARDIAN"],
      activeFamilyId: familyId,
    };
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { familyId } });
    await prisma.family.deleteMany({ where: { id: familyId } });
    await prisma.operation.deleteMany({
      where: { kind: { in: [
        "GRANT_GUARDIAN_RELATION",
        "REVOKE_GUARDIAN_RELATION",
        "REMOVE_FAMILY_MEMBER",
        "LEAVE_FAMILY",
        "DISABLE_STUDENT",
      ] } },
    });
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });
    await prisma.onModuleDestroy();
  });

  it("revokes and restores an explicitly selected guardian relation", async () => {
    await service.revokeRelation(owner, familyId, {
      guardianUserId: memberToRemove.id,
      studentUserId,
      confirmation: "REVOKE_RELATION",
    }, "phase3-service-revoke-0001");
    expect(await activeRelationCount(memberToRemove.id)).toBe(0);

    await service.grantRelation(owner, familyId, {
      guardianUserId: memberToRemove.id,
      studentUserId,
      confirmation: "GRANT_RELATION",
    }, "phase3-service-grant-0001");
    expect(await activeRelationCount(memberToRemove.id)).toBe(1);
  });

  it("revokes a MEMBER membership and links when that MEMBER leaves", async () => {
    await service.leave(memberToLeave, familyId, "phase3-service-leave-0001");
    expect(await activeMembershipCount(memberToLeave.id)).toBe(0);
    expect(await activeRelationCount(memberToLeave.id)).toBe(0);
  });

  it("lets only the OWNER remove another MEMBER and all links", async () => {
    await service.removeMember(owner, familyId, memberToRemove.id, "phase3-service-remove-0001");
    expect(await activeMembershipCount(memberToRemove.id)).toBe(0);
    expect(await activeRelationCount(memberToRemove.id)).toBe(0);
  });

  it("disables the student identity and terminates every guardian link", async () => {
    await service.disableStudent(owner, familyId, studentUserId, "phase3-service-disable-0001");
    const student = await prisma.user.findUniqueOrThrow({
      where: { id: studentUserId },
      include: { studentProfile: true },
    });
    expect(student.status).toBe("DISABLED");
    expect(student.studentProfile?.status).toBe("DISABLED");
    expect(await prisma.guardianStudentRelation.count({
      where: { familyId, studentUserId, revokedAt: null },
    })).toBe(0);
  });

  async function activeMembershipCount(userId: string): Promise<number> {
    return prisma.familyMembership.count({ where: { familyId, userId, revokedAt: null } });
  }

  async function activeRelationCount(guardianUserId: string): Promise<number> {
    return prisma.guardianStudentRelation.count({
      where: { familyId, guardianUserId, studentUserId, revokedAt: null },
    });
  }
});
