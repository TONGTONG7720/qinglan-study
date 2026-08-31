import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../common/prisma/prisma.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";

describe("Phase 4 grade-subject database matrix", () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it("seeds every grade-subject pair with the approved enabled values", async () => {
    const rows = await prisma.$queryRaw<{ grade: number; code: string; enabled: boolean }[]>`
      SELECT "grade", "subjectCode"::text AS code, "enabled"
      FROM "SubjectAvailability"
      ORDER BY "grade", "subjectCode"::text
    `;
    expect(rows).toHaveLength(21);
    expect(rows.find((row) => row.grade === 7 && row.code === "PHYSICS")?.enabled).toBe(false);
    expect(rows.find((row) => row.grade === 8 && row.code === "PHYSICS")?.enabled).toBe(true);
    expect(rows.find((row) => row.grade === 8 && row.code === "CHEMISTRY")?.enabled).toBe(false);
    expect(rows.find((row) => row.grade === 9 && row.code === "CHEMISTRY")?.enabled).toBe(true);
  });

  it("rejects enabling a subject outside the approved matrix", async () => {
    await expect(prisma.$executeRaw`
      UPDATE "SubjectAvailability"
      SET "enabled" = true
      WHERE "grade" = 7 AND "subjectCode" = 'PHYSICS'::"SubjectCode"
    `).rejects.toThrow();
  });
});
