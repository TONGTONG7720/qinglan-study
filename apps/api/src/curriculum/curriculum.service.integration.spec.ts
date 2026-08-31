import type { CurrentUser } from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { CurriculumService } from "./curriculum.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginId = "phase4-service-admin@example.test";

describe("Phase 4 curriculum service", () => {
  let prisma: PrismaService;
  let service: CurriculumService;
  let admin: CurrentUser;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    const user = await prisma.user.create({
      data: {
        loginId,
        passwordHash: "$argon2id$fictional",
        displayName: "Phase 4 Service Admin",
        roles: ["ADMIN"],
      },
    });
    admin = { id: user.id, displayName: user.displayName, roles: ["ADMIN"], activeFamilyId: null };
    service = new CurriculumService(prisma, new IdempotencyService(prisma));
  });

  afterAll(async () => {
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it("creates a nested DRAFT textbook transaction with an audit event", async () => {
    const result = await service.createTextbook(admin, {
      subjectCode: "MATH",
      grade: 8,
      publisher: "Phase 4 Service Publisher",
      editionName: "Service Test",
      volume: "八年级上册",
      units: [{
        ordinal: 1,
        title: "第一章",
        knowledgeNodes: [{
          title: "知识点",
          objective: "测试目标",
          prerequisiteKnowledge: [],
          commonErrors: [],
          abilityLevels: ["UNDERSTAND"],
          questionTypes: ["SHORT_ANSWER"],
          pageStart: null,
          pageEnd: null,
          contentVersion: "1",
        }],
      }],
      confirmation: "CREATE_TEXTBOOK_DRAFT",
    }, "phase4-service-textbook-0001");
    expect(result.status).toBe("DRAFT");
    expect(await prisma.unit.count({ where: { textbookEditionId: result.id } })).toBe(1);
    expect(await prisma.auditEvent.count({
      where: { action: "CURRICULUM_TEXTBOOK_DRAFT_CREATED", resourceId: result.id },
    })).toBe(1);
  });

  async function cleanup(): Promise<void> {
    const user = await prisma.user.findUnique({ where: { loginId }, select: { id: true } });
    if (user !== null) {
      await prisma.auditEvent.deleteMany({ where: { actorUserId: user.id } });
      await prisma.operation.deleteMany({ where: { userId: user.id } });
    }
    await prisma.textbookEdition.deleteMany({
      where: { publisher: "Phase 4 Service Publisher" },
    });
    await prisma.user.deleteMany({ where: { loginId } });
  }
});
