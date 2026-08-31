import type {
  CreateQuestionBankDraftInput,
  CurrentUser,
  DeduplicateQuestionBankInput,
  FactCheckQuestionBankInput,
  PublishQuestionBankInput,
  QuestionBankItemSummary,
  RegisterTextbookAssetInput,
  ReviewQuestionBankInput,
  TextbookAssetSummary,
  ValidateQuestionBankSolverInput,
} from "@study/contracts";
import { QuestionBankItemSummarySchema, TextbookAssetSummarySchema } from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";

import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
import type { QuestionBankItem } from "../generated/prisma/client.js";

function notFound(): never {
  throw new NotFoundException();
}

function requireAdmin(actor: CurrentUser): void {
  if (!actor.roles.includes("ADMIN")) notFound();
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizedStem(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/[\s，。！？、,.!?;；:：()（）\[\]【】]/gu, "");
}

type PipelineStatus = "DRAFT" | "SOLVER_VALIDATED" | "DEDUPLICATED" | "FACT_CHECKED" | "REVIEWED";

@Injectable()
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async createDraft(actor: CurrentUser, input: CreateQuestionBankDraftInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.idempotency.run({
      kind: "CREATE_QUESTION_BANK_DRAFT",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: input,
      resultSchema: QuestionBankItemSummarySchema,
      execute: async (transaction) => {
        const [unit, nodeCount] = await Promise.all([
          transaction.unit.findFirst({
            where: {
              id: input.unitId,
              textbookEditionId: input.textbookEditionId,
              textbookEdition: { subjectCode: input.subjectCode, grade: input.grade },
            },
          }),
          transaction.knowledgeNode.count({ where: { id: { in: input.knowledgeNodeIds }, unitId: input.unitId } }),
        ]);
        if (unit === null || nodeCount !== input.knowledgeNodeIds.length) notFound();
        const created = await transaction.questionBankItem.create({
          data: {
            stableKey: input.stableKey,
            subjectCode: input.subjectCode,
            grade: input.grade,
            textbookEditionId: input.textbookEditionId,
            unitId: input.unitId,
            type: input.type,
            difficulty: input.difficulty,
            abilityLevel: input.abilityLevel,
            stem: input.stem,
            options: input.options === null ? Prisma.JsonNull : json(input.options),
            answer: json(input.answer),
            explanation: input.explanation,
            hints: json(input.hints),
            commonErrorTargets: json(input.commonErrorTargets),
            sourceType: input.sourceType,
            licenseStatus: input.licenseStatus,
            sourceReferences: json(input.sourceReferences),
            generationModel: input.generationModel,
            promptVersion: input.promptVersion,
            contentHash: sha256(canonical({ stem: input.stem, options: input.options, answer: input.answer, explanation: input.explanation, hints: input.hints })),
            dedupeHash: sha256(canonical({ stem: normalizedStem(input.stem), options: input.options })),
            createdByUserId: actor.id,
            knowledgeLinks: { create: input.knowledgeNodeIds.map((knowledgeNodeId) => ({ knowledgeNodeId })) },
          },
        });
        await transaction.auditEvent.create({
          data: { actorUserId: actor.id, action: "QUESTION_BANK_DRAFT_CREATED", resourceType: "QuestionBankItem", resourceId: created.id, metadata: { stableKey: created.stableKey, sourceType: created.sourceType } },
        });
        return this.itemSummary(created);
      },
    });
  }

  async validateSolver(actor: CurrentUser, id: string, input: ValidateQuestionBankSolverInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.transition(actor, id, input, key, "VALIDATE_QUESTION_BANK_SOLVER", "DRAFT", async (transaction, item) => {
      const passed = canonical(item.answer) === canonical(input.solverAnswer);
      await transaction.questionBankValidation.create({
        data: {
          questionBankItemId: item.id,
          kind: "AUTO_SOLVE",
          status: passed ? "PASSED" : "FAILED",
          details: json({ solverName: input.solverName, solverExplanation: input.solverExplanation, solverAnswer: input.solverAnswer }),
        },
      });
      return passed
        ? transaction.questionBankItem.update({ where: { id: item.id }, data: { status: "SOLVER_VALIDATED" } })
        : item;
    });
  }

  async deduplicate(actor: CurrentUser, id: string, input: DeduplicateQuestionBankInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.transition(actor, id, input, key, "DEDUPLICATE_QUESTION_BANK_ITEM", "SOLVER_VALIDATED", async (transaction, item) => {
      const duplicateCount = await transaction.questionBankItem.count({
        where: { id: { not: item.id }, dedupeHash: item.dedupeHash, status: { notIn: ["REJECTED", "RETIRED"] } },
      });
      await transaction.questionBankValidation.create({
        data: { questionBankItemId: item.id, kind: "DEDUPLICATION", status: duplicateCount === 0 ? "PASSED" : "FAILED", details: { duplicateCount } },
      });
      return duplicateCount === 0
        ? transaction.questionBankItem.update({ where: { id: item.id }, data: { status: "DEDUPLICATED" } })
        : item;
    });
  }

  async factCheck(actor: CurrentUser, id: string, input: FactCheckQuestionBankInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.transition(actor, id, input, key, "FACT_CHECK_QUESTION_BANK_ITEM", "DEDUPLICATED", async (transaction, item) => {
      await transaction.questionBankValidation.create({
        data: { questionBankItemId: item.id, kind: "SUBJECT_FACT_CHECK", status: input.passed ? "PASSED" : "FAILED", details: { notes: input.notes, reviewerUserId: actor.id } },
      });
      return transaction.questionBankItem.update({ where: { id: item.id }, data: { status: input.passed ? "FACT_CHECKED" : "REJECTED" } });
    });
  }

  async review(actor: CurrentUser, id: string, input: ReviewQuestionBankInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.transition(actor, id, input, key, "REVIEW_QUESTION_BANK_ITEM", "FACT_CHECKED", async (transaction, item) => {
      await transaction.questionBankReview.create({
        data: { questionBankItemId: item.id, reviewerUserId: actor.id, decision: input.decision, comment: input.comment },
      });
      const status = input.decision === "APPROVED" ? "REVIEWED" : input.decision === "REJECTED" ? "REJECTED" : "DRAFT";
      return transaction.questionBankItem.update({
        where: { id: item.id },
        data: {
          status,
          reviewedByUserId: input.decision === "APPROVED" ? actor.id : null,
          reviewedAt: input.decision === "APPROVED" ? new Date() : null,
        },
      });
    });
  }

  async publish(actor: CurrentUser, id: string, input: PublishQuestionBankInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.transition(actor, id, input, key, "PUBLISH_QUESTION_BANK_ITEM", "REVIEWED", async (transaction, item) => {
      if (!new Set(["AUTHORIZED", "PUBLIC_DOMAIN"]).has(item.licenseStatus)) notFound();
      const [textbookCount, confirmedNodes, totalNodes, passed] = await Promise.all([
        transaction.textbookEdition.count({ where: { id: item.textbookEditionId, status: "CONFIRMED" } }),
        transaction.questionBankItemKnowledgeNode.count({ where: { questionBankItemId: item.id, knowledgeNode: { status: "CONFIRMED" } } }),
        transaction.questionBankItemKnowledgeNode.count({ where: { questionBankItemId: item.id } }),
        transaction.questionBankValidation.findMany({ where: { questionBankItemId: item.id, status: "PASSED" }, select: { kind: true } }),
      ]);
      const kinds = new Set(passed.map((validation) => validation.kind));
      if (textbookCount !== 1 || confirmedNodes !== totalNodes || !kinds.has("AUTO_SOLVE") || !kinds.has("DEDUPLICATION") || !kinds.has("SUBJECT_FACT_CHECK")) notFound();
      return transaction.questionBankItem.update({ where: { id: item.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    });
  }

  async registerAsset(actor: CurrentUser, input: RegisterTextbookAssetInput, key: string): Promise<TextbookAssetSummary> {
    requireAdmin(actor);
    const expectedPrefix = `textbooks/${input.textbookEditionId}/`;
    if (!input.objectKey.startsWith(expectedPrefix) || input.objectKey.includes("://") || input.licenseStatus === "PROHIBITED") notFound();
    return this.idempotency.run({
      kind: "REGISTER_PRIVATE_TEXTBOOK_ASSET",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: input,
      resultSchema: TextbookAssetSummarySchema,
      execute: async (transaction) => {
        if (await transaction.textbookEdition.count({ where: { id: input.textbookEditionId } }) !== 1) notFound();
        const created = await transaction.textbookAsset.create({
          data: {
            textbookEditionId: input.textbookEditionId,
            objectKey: input.objectKey,
            sha256: input.sha256,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            pageCount: input.pageCount,
            licenseStatus: input.licenseStatus,
            licenseReference: input.licenseReference,
            sourceVersion: input.sourceVersion,
            uploadedByUserId: actor.id,
          },
        });
        await transaction.auditEvent.create({
          data: { actorUserId: actor.id, action: "PRIVATE_TEXTBOOK_ASSET_REGISTERED", resourceType: "TextbookAsset", resourceId: created.id, metadata: { textbookEditionId: created.textbookEditionId, sha256: created.sha256 } },
        });
        return TextbookAssetSummarySchema.parse({
          id: created.id,
          textbookEditionId: created.textbookEditionId,
          objectKey: created.objectKey,
          sha256: created.sha256,
          mimeType: created.mimeType,
          pageCount: created.pageCount,
          licenseStatus: created.licenseStatus,
          status: created.status,
        });
      },
    });
  }

  private transition(
    actor: CurrentUser,
    id: string,
    input: unknown,
    key: string,
    kind: string,
    expectedStatus: PipelineStatus,
    execute: (transaction: Prisma.TransactionClient, item: QuestionBankItem) => Promise<QuestionBankItem>,
  ): Promise<QuestionBankItemSummary> {
    return this.idempotency.run({
      kind,
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { id, input },
      resultSchema: QuestionBankItemSummarySchema,
      execute: async (transaction) => {
        const item = await transaction.questionBankItem.findFirst({ where: { id, status: expectedStatus } });
        if (item === null) notFound();
        const updated = await execute(transaction, item);
        await transaction.auditEvent.create({
          data: { actorUserId: actor.id, action: kind, resourceType: "QuestionBankItem", resourceId: item.id, metadata: { fromStatus: expectedStatus, toStatus: updated.status } },
        });
        return this.itemSummary(updated);
      },
    });
  }

  private itemSummary(item: QuestionBankItem): QuestionBankItemSummary {
    return QuestionBankItemSummarySchema.parse({
      id: item.id,
      stableKey: item.stableKey,
      subjectCode: item.subjectCode,
      grade: item.grade,
      textbookEditionId: item.textbookEditionId,
      unitId: item.unitId,
      type: item.type,
      difficulty: item.difficulty,
      abilityLevel: item.abilityLevel,
      status: item.status,
    });
  }
}
