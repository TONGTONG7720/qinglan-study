import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../common/prisma/prisma.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";

describe("Phase 5 daily-plan database invariants", () => {
  let prisma: PrismaService;
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
  });
  afterAll(async () => prisma.onModuleDestroy());

  it("contains the unique learning-day and completion constraints", async () => {
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('DailyPlan_studentUserId_learningDay_key', 'PlanTaskCompletion_planTaskId_key')
      ORDER BY indexname
    `;
    expect(indexes.map((item) => item.indexname)).toEqual([
      "DailyPlan_studentUserId_learningDay_key",
      "PlanTaskCompletion_planTaskId_key",
    ]);
  });
});
