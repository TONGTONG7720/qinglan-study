import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../common/prisma/prisma.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "phase3-owner-invariant-";

describe("Phase 3 exactly-one-owner database invariant", () => {
  let prisma: PrismaService;
  let familyId: string;
  let ownerUserId: string;
  let memberUserId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });

    const created = await prisma.$transaction(async (transaction) => {
      const owner = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}owner@example.test`,
          passwordHash: "$argon2id$fictional",
          displayName: "唯一所有者测试",
          roles: ["GUARDIAN"],
        },
      });
      const member = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}member@example.test`,
          passwordHash: "$argon2id$fictional",
          displayName: "成员测试",
          roles: ["GUARDIAN"],
        },
      });
      const family = await transaction.family.create({
        data: {
          name: "Phase 3 Owner Invariant Family",
          memberships: {
            create: [
              { userId: owner.id, role: "GUARDIAN", accessLevel: "OWNER" },
              { userId: member.id, role: "GUARDIAN", accessLevel: "MEMBER" },
            ],
          },
        },
      });
      return { familyId: family.id, ownerUserId: owner.id, memberUserId: member.id };
    });
    familyId = created.familyId;
    ownerUserId = created.ownerUserId;
    memberUserId = created.memberUserId;
  });

  afterAll(async () => {
    await prisma.family.deleteMany({ where: { id: familyId } });
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });
    await prisma.onModuleDestroy();
  });

  it("rejects committing an active family with zero active owners", async () => {
    try {
      await expect(prisma.$transaction(async (transaction) => {
        await transaction.familyMembership.updateMany({
          where: { familyId, userId: ownerUserId, revokedAt: null },
          data: { accessLevel: "MEMBER" },
        });
      })).rejects.toThrow();
    } finally {
      await prisma.familyMembership.updateMany({
        where: { familyId, userId: ownerUserId, revokedAt: null },
        data: { accessLevel: "OWNER" },
      });
    }
  });

  it("allows an atomic ownership transfer and still leaves exactly one owner", async () => {
    await prisma.$transaction(async (transaction) => {
      await transaction.familyMembership.updateMany({
        where: { familyId, userId: ownerUserId, accessLevel: "OWNER", revokedAt: null },
        data: { accessLevel: "MEMBER" },
      });
      await transaction.familyMembership.updateMany({
        where: { familyId, userId: memberUserId, accessLevel: "MEMBER", revokedAt: null },
        data: { accessLevel: "OWNER" },
      });
    });

    const owners = await prisma.familyMembership.findMany({
      where: { familyId, accessLevel: "OWNER", revokedAt: null },
      select: { userId: true },
    });
    expect(owners).toEqual([{ userId: memberUserId }]);
  });
});
