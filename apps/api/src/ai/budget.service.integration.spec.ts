import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { BudgetService } from "./budget.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const prefix = "phase6-budget-";
describe("Phase 6 atomic budget", () => {
  let prisma: PrismaService; let service: BudgetService; let familyId: string; let studentId: string; let ownerId: string;
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl; prisma = new PrismaService(); await prisma.onModuleInit(); await cleanup(); service = new BudgetService(prisma);
    const fixture = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({ data: { loginId: `${prefix}owner`, passwordHash: "$argon2id$fictional", displayName: "预算家长", roles: ["GUARDIAN"] } });
      const student = await tx.user.create({ data: { loginId: `${prefix}student`, passwordHash: "$argon2id$fictional", displayName: "预算学生", roles: ["STUDENT"] } });
      const family = await tx.family.create({ data: { name: "Phase 6 Budget Family", memberships: { create: [{ userId: owner.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: student.id, role: "STUDENT" }] }, studentProfiles: { create: { userId: student.id, grade: 8 } } } });
      return { family, student, owner };
    });
    familyId = fixture.family.id; studentId = fixture.student.id; ownerId = fixture.owner.id;
    await service.setFamilyCap(ownerId, familyId, 20);
  });
  afterAll(async () => { await cleanup(); await prisma.onModuleDestroy(); });
  it("never reserves beyond the effective cap under concurrency", async () => {
    const results = await Promise.allSettled([
      service.reserve(familyId, studentId, "OCR", 15, "phase6-budget-concurrent-0001"),
      service.reserve(familyId, studentId, "OCR", 15, "phase6-budget-concurrent-0002"),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const usage = await prisma.budgetPeriodUsage.findFirstOrThrow({ where: { familyId } });
    expect(usage.reservedFen).toBe(15); expect(usage.settledFen).toBe(0);
  });
  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({ where: { loginId: { startsWith: prefix } }, select: { id: true } });
    await prisma.family.deleteMany({ where: { name: "Phase 6 Budget Family" } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
});
