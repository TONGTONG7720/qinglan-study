import type { CurrentUser } from "@study/contracts";
import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { QuestionBankService } from "./question-bank.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginId = "question-bank-service-admin@example.test";
const publisher = "Question Bank Test Publisher";

describe("question-bank pipeline", () => {
  let prisma: PrismaService;
  let service: QuestionBankService;
  let admin: CurrentUser;
  let textbookEditionId: string;
  let unitId: string;
  let knowledgeNodeId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    const user = await prisma.user.create({ data: { loginId, passwordHash: "$argon2id$fictional", displayName: "Question Bank Admin", roles: ["ADMIN"] } });
    admin = { id: user.id, displayName: user.displayName, roles: ["ADMIN"], activeFamilyId: null };
    const textbook = await prisma.textbookEdition.create({
      data: {
        subjectCode: "PHYSICS",
        grade: 8,
        publisher,
        editionName: "Pipeline Fixture",
        volume: "上册",
        units: {
          create: {
            ordinal: 1,
            title: "第一章",
            knowledgeNodes: {
              create: {
                title: "1.1 测量",
                objective: "规范完成长度测量。",
                prerequisiteKnowledge: [],
                commonErrors: ["漏写单位"],
                abilityLevels: ["APPLY"],
                questionTypes: ["SINGLE_CHOICE"],
                pageStart: 1,
                pageEnd: 2,
              },
            },
          },
        },
      },
      include: { units: { include: { knowledgeNodes: true } } },
    });
    textbookEditionId = textbook.id;
    unitId = textbook.units[0]?.id ?? "";
    knowledgeNodeId = textbook.units[0]?.knowledgeNodes[0]?.id ?? "";
    service = new QuestionBankService(prisma, new IdempotencyService(prisma));
  });

  afterAll(async () => {
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it("enforces solve, dedupe, fact-check and review before publication", async () => {
    const created = await service.createDraft(admin, {
      stableKey: "physics.g8.pipeline.fixture-001",
      subjectCode: "PHYSICS",
      grade: 8,
      textbookEditionId,
      unitId,
      knowledgeNodeIds: [knowledgeNodeId],
      type: "SINGLE_CHOICE",
      difficulty: 2,
      abilityLevel: "APPLY",
      stem: "用刻度尺测量物体长度时，下列记录哪一项包含正确单位？",
      options: [{ key: "A", label: "2.5" }, { key: "B", label: "2.50 cm" }],
      answer: { kind: "CHOICE", value: ["B"], acceptedAlternatives: [], rubricPoints: [] },
      explanation: "测量结果必须同时包含数值和单位。",
      hints: ["先检查每项是否有单位。"],
      commonErrorTargets: ["漏写单位"],
      sourceType: "ORIGINAL_HUMAN",
      licenseStatus: "AUTHORIZED",
      sourceReferences: ["contract:test-authorized-source"],
      generationModel: null,
      promptVersion: null,
      confirmation: "CREATE_QUESTION_BANK_DRAFT",
    }, "qb-create");
    expect(created.status).toBe("DRAFT");

    const solved = await service.validateSolver(admin, created.id, {
      solverAnswer: { kind: "CHOICE", value: ["B"], acceptedAlternatives: [], rubricPoints: [] },
      solverExplanation: "B 同时包含数值和长度单位。",
      solverName: "fixture-solver",
      confirmation: "VALIDATE_QUESTION_BANK_SOLVER",
    }, "qb-solve");
    expect(solved.status).toBe("SOLVER_VALIDATED");
    expect((await service.deduplicate(admin, created.id, { confirmation: "DEDUPLICATE_QUESTION_BANK_ITEM" }, "qb-dedupe")).status).toBe("DEDUPLICATED");
    expect((await service.factCheck(admin, created.id, { passed: true, notes: "单位和答案正确。", confirmation: "FACT_CHECK_QUESTION_BANK_ITEM" }, "qb-fact")).status).toBe("FACT_CHECKED");
    expect((await service.review(admin, created.id, { decision: "APPROVED", comment: "测试审核通过。", confirmation: "REVIEW_QUESTION_BANK_ITEM" }, "qb-review")).status).toBe("REVIEWED");

    await expect(service.publish(admin, created.id, { confirmation: "PUBLISH_QUESTION_BANK_ITEM" }, "qb-publish-blocked")).rejects.toBeInstanceOf(NotFoundException);
    await prisma.$transaction([
      prisma.textbookEdition.update({ where: { id: textbookEditionId }, data: { status: "CONFIRMED", sourceReference: "contract:test-authorized-source", verifiedByUserId: admin.id, verifiedAt: new Date() } }),
      prisma.unit.update({ where: { id: unitId }, data: { status: "CONFIRMED" } }),
      prisma.knowledgeNode.update({ where: { id: knowledgeNodeId }, data: { status: "CONFIRMED" } }),
    ]);
    expect((await service.publish(admin, created.id, { confirmation: "PUBLISH_QUESTION_BANK_ITEM" }, "qb-publish")).status).toBe("PUBLISHED");
  });

  async function cleanup(): Promise<void> {
    await prisma.textbookEdition.deleteMany({ where: { publisher } });
    const user = await prisma.user.findUnique({ where: { loginId }, select: { id: true } });
    if (user !== null) {
      await prisma.auditEvent.deleteMany({ where: { actorUserId: user.id } });
      await prisma.operation.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { loginId } });
  }
});
