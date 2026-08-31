import { afterEach, describe, expect, it } from "vitest";

import { PrismaService } from "./prisma.service.js";

describe("PrismaService integration", () => {
  let prisma: PrismaService | undefined;

  afterEach(async () => {
    await prisma?.onModuleDestroy();
    prisma = undefined;
  });

  it("connects to the migrated PostgreSQL database", async () => {
    process.env.DATABASE_URL =
      "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
    prisma = new PrismaService();
    await prisma.onModuleInit();

    const rows = await prisma.$queryRaw<{ value: number }[]>`SELECT 1 AS value`;
    expect(rows).toEqual([{ value: 1 }]);
  });
});
