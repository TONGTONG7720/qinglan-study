import type { CurrentUser, QuestionAnswer } from "@study/contracts";
import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { QuestionBankService } from "./question-bank.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const publisher = "Question Bank Release Gate Test Publisher";
const loginIds = [
  "qb-creator@example.test",
  "qb-subject-license-reviewer@example.test",
  "qb-final-reviewer@example.test",
  "qb-publisher@example.test",
];
const answer: QuestionAnswer = {
  kind: "CHOICE",
  value: ["B"],
  acceptedAlternatives: [],
  rubricPoints: [],
};

describe("question-bank release gates", () => {
  let prisma: PrismaService;
  let service: QuestionBankService;
  let creator: CurrentUser;
  let subjectLicenseReviewer: CurrentUser;
  let finalReviewer: CurrentUser;
  let releasePublisher: CurrentUser;
  let textbookEditionId: string;
  let unitId: string;
  let knowledgeNodeId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    const users = await Promise.all(loginIds.map((loginId, index) => prisma.user.create({
      data: {
        loginId,
        passwordHash: "$argon2id$fictional",
        displayName: `Question Bank Actor ${String(index + 1)}`,
        roles: ["ADMIN"],
      },
    })));
    const actors = users.map((user): CurrentUser => ({
      id: user.id,
      displayName: user.displayName,
      roles: ["ADMIN"],
      activeFamilyId: null,
    }));
    [creator, subjectLicenseReviewer, finalReviewer, releasePublisher] = actors as [CurrentUser, CurrentUser, CurrentUser, CurrentUser];
    const textbook = await prisma.textbookEdition.create({
      data: {
        subjectCode: "PHYSICS",
        grade: 8,
        publisher,
        editionName: "Release Gate Fixture",
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

  it("requires independent, semantic, human, license, final-review and release evidence, then preserves rollback history", async () => {
    const first = await createFactCheckedItem(
      "physics.g8.release-gate.001",
      "用刻度尺测量物体长度时，下列记录哪一项包含正确单位？",
      "first",
    );
    const second = await createFactCheckedItem(
      "physics.g8.release-gate.002",
      "使用刻度尺记录物体长度时，哪一个选项同时写出了数值与单位？",
      "second",
    );

    await expect(service.review(finalReviewer, first.id, {
      decision: "APPROVED",
      comment: "证据不完整时不应放行。",
      attestation: "FINAL_ADMIN_CONTENT_REVIEW_COMPLETED",
      confirmation: "REVIEW_QUESTION_BANK_ITEM",
    }, "review-before-release-gates")).rejects.toBeInstanceOf(NotFoundException);

    const firstCoverage = await service.semanticDeduplicate(creator, first.id, {
      embeddingModel: "text-embedding-production-v1",
      embedding: [1, 0, 0, 0, 0, 0, 0, 0],
      attestation: "REAL_SEMANTIC_EMBEDDING_NOT_HASH_HEURISTIC",
      confirmation: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
    }, "semantic-first-incomplete");
    expect(firstCoverage.coverageComplete).toBe(false);
    expect(firstCoverage.uncoveredItemCount).toBe(1);

    const secondSemantic = await service.semanticDeduplicate(creator, second.id, {
      embeddingModel: "text-embedding-production-v1",
      embedding: [0.999, 0.01, 0, 0, 0, 0, 0, 0],
      attestation: "REAL_SEMANTIC_EMBEDDING_NOT_HASH_HEURISTIC",
      confirmation: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
    }, "semantic-second-candidate");
    expect(secondSemantic.coverageComplete).toBe(true);
    expect(secondSemantic.candidates).toHaveLength(1);
    expect(secondSemantic.candidates[0]?.decision).toBe("PENDING");

    await expect(service.review(finalReviewer, second.id, {
      decision: "APPROVED",
      comment: "语义候选未裁决时不应放行。",
      attestation: "FINAL_ADMIN_CONTENT_REVIEW_COMPLETED",
      confirmation: "REVIEW_QUESTION_BANK_ITEM",
    }, "review-before-semantic-adjudication")).rejects.toBeInstanceOf(NotFoundException);

    expect((await service.reviewSemanticDuplicate(subjectLicenseReviewer, second.id, secondSemantic.candidates[0]?.id ?? "", {
      decision: "DISTINCT",
      comment: "两题考查点相同但情境与设问不同，保留为不同题目。",
      attestation: "HUMAN_SEMANTIC_DUPLICATE_REVIEW_COMPLETED",
      confirmation: "REVIEW_SEMANTIC_DUPLICATE_CANDIDATE",
    }, "semantic-second-distinct")).status).toBe("FACT_CHECKED");

    const firstSemantic = await service.semanticDeduplicate(creator, first.id, {
      embeddingModel: "text-embedding-production-v1",
      embedding: [1, 0, 0, 0, 0, 0, 0, 0],
      attestation: "REAL_SEMANTIC_EMBEDDING_NOT_HASH_HEURISTIC",
      confirmation: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
    }, "semantic-first-complete");
    expect(firstSemantic.coverageComplete).toBe(true);
    expect(firstSemantic.candidates).toHaveLength(0);

    await expect(recordHumanAndLicenseEvidence(creator, first.id, "creator-separation")).rejects.toBeInstanceOf(NotFoundException);
    await recordHumanAndLicenseEvidence(subjectLicenseReviewer, first.id, "first");

    expect((await service.review(finalReviewer, first.id, {
      decision: "APPROVED",
      comment: "已核对独立求解、语义去重、学科事实与许可证据。",
      attestation: "FINAL_ADMIN_CONTENT_REVIEW_COMPLETED",
      confirmation: "REVIEW_QUESTION_BANK_ITEM",
    }, "first-final-review")).status).toBe("REVIEWED");

    await expect(service.publish(releasePublisher, first.id, {
      attestation: "PUBLISH_WITH_VERIFIED_RELEASE_GATES",
      confirmation: "PUBLISH_QUESTION_BANK_ITEM",
    }, "publish-before-curriculum-confirmed")).rejects.toBeInstanceOf(NotFoundException);

    await prisma.$transaction([
      prisma.textbookEdition.update({
        where: { id: textbookEditionId },
        data: { status: "CONFIRMED", sourceReference: "contract:authorized-curriculum-source", verifiedByUserId: releasePublisher.id, verifiedAt: new Date() },
      }),
      prisma.unit.update({ where: { id: unitId }, data: { status: "CONFIRMED" } }),
      prisma.knowledgeNode.update({ where: { id: knowledgeNodeId }, data: { status: "CONFIRMED" } }),
    ]);

    expect((await service.publish(releasePublisher, first.id, {
      attestation: "PUBLISH_WITH_VERIFIED_RELEASE_GATES",
      confirmation: "PUBLISH_QUESTION_BANK_ITEM",
    }, "first-publish")).status).toBe("PUBLISHED");
    const activeRelease = await prisma.questionBankRelease.findUnique({
      where: { questionBankItemId_version: { questionBankItemId: first.id, version: 1 } },
    });
    expect(activeRelease?.status).toBe("ACTIVE");
    expect(activeRelease?.gateEvidenceHash).toMatch(/^[0-9a-f]{64}$/u);

    expect((await service.rollbackRelease(releasePublisher, first.id, {
      reason: "受控演练：发现发布后内容需要撤回复核。",
      attestation: "ROLLBACK_QUESTION_BANK_RELEASE",
      confirmation: "RETIRE_PUBLISHED_QUESTION_BANK_ITEM",
    }, "first-rollback")).status).toBe("RETIRED");
    const rolledBackRelease = await prisma.questionBankRelease.findUnique({
      where: { questionBankItemId_version: { questionBankItemId: first.id, version: 1 } },
    });
    expect(rolledBackRelease?.status).toBe("ROLLED_BACK");
    expect(rolledBackRelease?.rollbackReason).toContain("撤回复核");

    const third = await createFactCheckedItem(
      "physics.g8.release-gate.003",
      "记录刻度尺测量值时，哪一项同时包含有效数值和长度单位？",
      "third",
    );
    const thirdSemantic = await service.semanticDeduplicate(creator, third.id, {
      embeddingModel: "text-embedding-production-v1",
      embedding: [0.999, 0.01, 0, 0, 0, 0, 0, 0],
      attestation: "REAL_SEMANTIC_EMBEDDING_NOT_HASH_HEURISTIC",
      confirmation: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
    }, "semantic-third-candidate");
    expect(thirdSemantic.candidates).toHaveLength(1);
    expect((await service.reviewSemanticDuplicate(subjectLicenseReviewer, third.id, thirdSemantic.candidates[0]?.id ?? "", {
      decision: "DUPLICATE",
      comment: "真人复核确认该题与候选题只是同义改写，应拒绝进入正式题库。",
      attestation: "HUMAN_SEMANTIC_DUPLICATE_REVIEW_COMPLETED",
      confirmation: "REVIEW_SEMANTIC_DUPLICATE_CANDIDATE",
    }, "semantic-third-duplicate")).status).toBe("REJECTED");
    expect(await prisma.questionBankRelease.count({ where: { questionBankItemId: third.id } })).toBe(0);
  });

  async function createFactCheckedItem(stableKey: string, stem: string, keyPrefix: string) {
    const created = await service.createDraft(creator, {
      stableKey,
      subjectCode: "PHYSICS",
      grade: 8,
      textbookEditionId,
      unitId,
      knowledgeNodeIds: [knowledgeNodeId],
      type: "SINGLE_CHOICE",
      difficulty: 2,
      abilityLevel: "APPLY",
      stem,
      options: [{ key: "A", label: "2.5" }, { key: "B", label: "2.50 cm" }],
      answer,
      explanation: "测量结果必须同时包含数值和单位。",
      hints: ["先检查每项是否有单位。"],
      commonErrorTargets: ["漏写单位"],
      sourceType: "ORIGINAL_HUMAN",
      licenseStatus: "LICENSE_REVIEW_REQUIRED",
      sourceReferences: ["contract:pending-license-evidence"],
      generationModel: null,
      promptVersion: null,
      confirmation: "CREATE_QUESTION_BANK_DRAFT",
    }, `${keyPrefix}-create`);
    expect((await service.recordIndependentSolve(creator, created.id, {
      questionBankItemId: created.id,
      stableKey,
      solverReference: `external-solver-${keyPrefix}`,
      solverKind: "HUMAN",
      answer,
      explanation: "根据测量记录必须同时包含数值和长度单位，独立选择 B。",
      solvedAt: new Date(Date.now() + 10).toISOString(),
      attestation: "ANSWERED_WITHOUT_REFERENCE_ACCESS",
      confirmation: "RECORD_INDEPENDENT_QUESTION_BANK_SOLVE",
    }, `${keyPrefix}-independent-solve`)).status).toBe("SOLVER_VALIDATED");
    expect((await service.deduplicate(creator, created.id, {
      confirmation: "DEDUPLICATE_QUESTION_BANK_ITEM",
    }, `${keyPrefix}-exact-dedupe`)).status).toBe("DEDUPLICATED");
    expect((await service.factCheck(creator, created.id, {
      passed: true,
      notes: "工程预检确认单位、选项和参考答案一致。",
      confirmation: "FACT_CHECK_QUESTION_BANK_ITEM",
    }, `${keyPrefix}-fact-check`)).status).toBe("FACT_CHECKED");
    return created;
  }

  async function recordHumanAndLicenseEvidence(actor: CurrentUser, itemId: string, keyPrefix: string): Promise<void> {
    await service.recordHumanSubjectReview(actor, itemId, {
      passed: true,
      reviewerReference: "physics-reviewer-pseudonym-01",
      notes: "真人学科审核确认题干、选项、答案、解析和教材知识点一致。",
      evidenceReferences: ["external-review-register:physics-2026-001"],
      attestation: "HUMAN_SUBJECT_FACT_REVIEW_COMPLETED",
      confirmation: "RECORD_HUMAN_SUBJECT_REVIEW",
    }, `${keyPrefix}-human-subject-review`);
    await service.reviewLicense(actor, itemId, {
      decision: "AUTHORIZED",
      reviewerReference: "license-reviewer-pseudonym-01",
      basis: "权利人书面授权允许在本题库中使用并向学生展示该原创题目。",
      evidenceReference: "external-license-register:authorization-2026-001",
      evidenceSha256: "a".repeat(64),
      attestation: "HUMAN_LICENSE_REVIEW_COMPLETED",
      confirmation: "REVIEW_QUESTION_BANK_LICENSE",
    }, `${keyPrefix}-license-review`);
  }

  async function cleanup(): Promise<void> {
    await prisma.questionBankRelease.deleteMany({ where: { questionBankItem: { textbookEdition: { publisher } } } });
    await prisma.textbookEdition.deleteMany({ where: { publisher } });
    const users = await prisma.user.findMany({ where: { loginId: { in: loginIds } }, select: { id: true } });
    const userIds = users.map((user) => user.id);
    if (userIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
      await prisma.operation.deleteMany({ where: { userId: { in: userIds } } });
    }
    await prisma.user.deleteMany({ where: { loginId: { in: loginIds } } });
  }
});
