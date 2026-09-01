import type {
  CreateQuestionBankDraftInput,
  CurrentUser,
  DeduplicateQuestionBankInput,
  FactCheckQuestionBankInput,
  HumanSubjectReviewQuestionBankInput,
  PublishQuestionBankInput,
  QuestionBankItemSummary,
  QuestionBankSemanticDeduplicationResult,
  RecordIndependentQuestionBankSolveInput,
  RegisterTextbookAssetInput,
  ReviewQuestionBankInput,
  ReviewQuestionBankLicenseInput,
  ReviewSemanticDuplicateInput,
  RollbackQuestionBankReleaseInput,
  SemanticDeduplicateQuestionBankInput,
  TextbookAssetSummary,
  ValidateQuestionBankSolverInput,
} from "@study/contracts";
import {
  QuestionBankItemSummarySchema,
  QuestionBankSemanticDeduplicationResultSchema,
  TextbookAssetSummarySchema,
} from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";

import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
import type {
  QuestionBankItem,
  QuestionBankValidation,
  QuestionBankValidationKind,
} from "../generated/prisma/client.js";

const semanticSimilarityThreshold = 0.92;
const preReviewGateKinds = [
  "INDEPENDENT_SOLVE",
  "DEDUPLICATION",
  "SEMANTIC_DEDUPLICATION",
  "SUBJECT_FACT_CHECK",
  "HUMAN_SUBJECT_REVIEW",
  "LICENSE_REVIEW",
] as const satisfies readonly QuestionBankValidationKind[];
const nonIndependentReferencePattern = /\b(?:fake|fixture|test|deterministic)\b|answer[-_ ]?key|模拟|测试|答案/iu;
const nonSemanticModelPattern = /\b(?:fake|fixture|test|deterministic)\b|bigram|n-?gram|character|字符二元|哈希/iu;

type PipelineStatus = "DRAFT" | "SOLVER_VALIDATED" | "DEDUPLICATED" | "FACT_CHECKED" | "REVIEWED";
type EvidenceStatus = "DRAFT" | "SOLVER_VALIDATED" | "DEDUPLICATED" | "FACT_CHECKED";

interface SemanticCandidateRow {
  candidateItemId: string;
  candidateStableKey: string;
  candidateContentHash: string;
  similarity: number;
}

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

function semanticSource(item: QuestionBankItem): string {
  return canonical({
    subjectCode: item.subjectCode,
    grade: item.grade,
    type: item.type,
    stem: item.stem,
    options: item.options,
  });
}

function validateExternalReference(reference: string): void {
  if (nonIndependentReferencePattern.test(reference)) notFound();
}

function validateSemanticModel(model: string): void {
  if (nonSemanticModelPattern.test(model)) notFound();
}

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
          contentHash: item.contentHash,
          performedByUserId: actor.id,
          details: json({
            solverName: input.solverName,
            resultHash: sha256(canonical({ answer: input.solverAnswer, explanation: input.solverExplanation })),
            engineeringPrecheckOnly: true,
          }),
        },
      });
      return passed
        ? transaction.questionBankItem.update({ where: { id: item.id }, data: { status: "SOLVER_VALIDATED" } })
        : item;
    });
  }

  async recordIndependentSolve(
    actor: CurrentUser,
    id: string,
    input: RecordIndependentQuestionBankSolveInput,
    key: string,
  ): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    validateExternalReference(input.solverReference);
    return this.idempotency.run({
      kind: "RECORD_INDEPENDENT_QUESTION_BANK_SOLVE",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { id, input },
      resultSchema: QuestionBankItemSummarySchema,
      execute: async (transaction) => {
        const item = await transaction.questionBankItem.findFirst({
          where: { id, status: { in: ["DRAFT", "SOLVER_VALIDATED", "DEDUPLICATED", "FACT_CHECKED"] satisfies EvidenceStatus[] } },
        });
        if (item === null || input.questionBankItemId !== id || input.stableKey !== item.stableKey) notFound();
        const solvedAt = new Date(input.solvedAt);
        if (solvedAt.getTime() > Date.now() + 5 * 60 * 1_000 || solvedAt.getTime() < item.createdAt.getTime()) notFound();
        const passed = canonical(item.answer) === canonical(input.answer);
        const resultHash = sha256(canonical({
          questionBankItemId: input.questionBankItemId,
          stableKey: input.stableKey,
          solverReference: input.solverReference,
          solverKind: input.solverKind,
          answer: input.answer,
          explanation: input.explanation,
          solvedAt: input.solvedAt,
          attestation: input.attestation,
        }));
        await transaction.questionBankValidation.create({
          data: {
            questionBankItemId: item.id,
            kind: "INDEPENDENT_SOLVE",
            status: passed ? "PASSED" : "FAILED",
            contentHash: item.contentHash,
            performedByUserId: actor.id,
            details: json({
              solverReference: input.solverReference,
              solverKind: input.solverKind,
              solvedAt: input.solvedAt,
              attestation: input.attestation,
              resultHash,
              answerStored: false,
              explanationStored: false,
            }),
          },
        });
        const updated = passed && item.status === "DRAFT"
          ? await transaction.questionBankItem.update({ where: { id: item.id }, data: { status: "SOLVER_VALIDATED" } })
          : item;
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "RECORD_INDEPENDENT_QUESTION_BANK_SOLVE",
            resourceType: "QuestionBankItem",
            resourceId: item.id,
            metadata: { passed, solverKind: input.solverKind, solverReference: input.solverReference, resultHash },
          },
        });
        return this.itemSummary(updated);
      },
    });
  }

  async deduplicate(actor: CurrentUser, id: string, input: DeduplicateQuestionBankInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.transition(actor, id, input, key, "DEDUPLICATE_QUESTION_BANK_ITEM", "SOLVER_VALIDATED", async (transaction, item) => {
      const duplicateCount = await transaction.questionBankItem.count({
        where: { id: { not: item.id }, dedupeHash: item.dedupeHash, status: { notIn: ["REJECTED", "RETIRED"] } },
      });
      await transaction.questionBankValidation.create({
        data: {
          questionBankItemId: item.id,
          kind: "DEDUPLICATION",
          status: duplicateCount === 0 ? "PASSED" : "FAILED",
          contentHash: item.contentHash,
          performedByUserId: actor.id,
          details: { duplicateCount, exactHashPrecheckOnly: true },
        },
      });
      return duplicateCount === 0
        ? transaction.questionBankItem.update({ where: { id: item.id }, data: { status: "DEDUPLICATED" } })
        : item;
    });
  }

  async semanticDeduplicate(
    actor: CurrentUser,
    id: string,
    input: SemanticDeduplicateQuestionBankInput,
    key: string,
  ): Promise<QuestionBankSemanticDeduplicationResult> {
    requireAdmin(actor);
    validateSemanticModel(input.embeddingModel);
    const vectorNormSquared = input.embedding.reduce((total, value) => total + value * value, 0);
    if (!Number.isFinite(vectorNormSquared) || vectorNormSquared <= 1e-12) notFound();
    return this.idempotency.run({
      kind: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { id, input },
      resultSchema: QuestionBankSemanticDeduplicationResultSchema,
      execute: async (transaction) => {
        const item = await transaction.questionBankItem.findFirst({
          where: { id, status: { in: ["DEDUPLICATED", "FACT_CHECKED"] } },
        });
        if (item === null) notFound();
        const dimensions = input.embedding.length;
        const sourceHash = sha256(semanticSource(item));
        const embeddingHash = sha256(canonical({ model: input.embeddingModel, sourceHash, embedding: input.embedding }));
        if (
          item.semanticEmbeddingHash !== null
          && (
            item.semanticEmbeddingHash !== embeddingHash
            || item.semanticEmbeddingModel !== input.embeddingModel
            || item.semanticEmbeddingDimensions !== dimensions
            || item.semanticSourceHash !== sourceHash
          )
        ) notFound();
        const vector = `[${input.embedding.join(",")}]`;
        await transaction.$executeRaw`
          UPDATE "QuestionBankItem"
          SET
            "semanticEmbedding" = ${vector}::vector,
            "semanticEmbeddingModel" = ${input.embeddingModel},
            "semanticEmbeddingDimensions" = ${dimensions},
            "semanticSourceHash" = ${sourceHash},
            "semanticEmbeddingHash" = ${embeddingHash},
            "semanticEmbeddedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${item.id}::uuid
        `;
        const coverage = await transaction.$queryRaw<{ uncoveredItemCount: number }[]>`
          SELECT COUNT(*)::int AS "uncoveredItemCount"
          FROM "QuestionBankItem"
          WHERE "subjectCode" = ${item.subjectCode}::"SubjectCode"
            AND "status" IN (
              'DEDUPLICATED'::"QuestionBankStatus",
              'FACT_CHECKED'::"QuestionBankStatus",
              'REVIEWED'::"QuestionBankStatus",
              'PUBLISHED'::"QuestionBankStatus"
            )
            AND "id" <> ${item.id}::uuid
            AND (
              "semanticEmbedding" IS NULL
              OR "semanticEmbeddingModel" IS DISTINCT FROM ${input.embeddingModel}
              OR "semanticEmbeddingDimensions" IS DISTINCT FROM ${dimensions}
            )
        `;
        const uncoveredItemCount = coverage[0]?.uncoveredItemCount ?? 0;
        if (uncoveredItemCount > 0) {
          await this.createSemanticValidation(transaction, item, actor.id, "PENDING", {
            coverageComplete: false,
            uncoveredItemCount,
            embeddingModel: input.embeddingModel,
            dimensions,
            sourceHash,
            embeddingHash,
            threshold: semanticSimilarityThreshold,
          });
          await this.auditSemantic(transaction, actor.id, item.id, "PENDING", uncoveredItemCount, 0);
          return {
            item: this.itemSummary(item),
            coverageComplete: false,
            uncoveredItemCount,
            candidates: [],
          };
        }
        const candidateRows = await transaction.$queryRaw<SemanticCandidateRow[]>`
          SELECT
            candidate."id" AS "candidateItemId",
            candidate."stableKey" AS "candidateStableKey",
            candidate."contentHash" AS "candidateContentHash",
            (1 - (candidate."semanticEmbedding" <=> ${vector}::vector))::double precision AS "similarity"
          FROM "QuestionBankItem" AS candidate
          WHERE candidate."subjectCode" = ${item.subjectCode}::"SubjectCode"
            AND candidate."status" IN (
              'DEDUPLICATED'::"QuestionBankStatus",
              'FACT_CHECKED'::"QuestionBankStatus",
              'REVIEWED'::"QuestionBankStatus",
              'PUBLISHED'::"QuestionBankStatus"
            )
            AND candidate."stableKey" < ${item.stableKey}
            AND candidate."semanticEmbeddingModel" = ${input.embeddingModel}
            AND candidate."semanticEmbeddingDimensions" = ${dimensions}
            AND (1 - (candidate."semanticEmbedding" <=> ${vector}::vector)) >= ${semanticSimilarityThreshold}
          ORDER BY candidate."semanticEmbedding" <=> ${vector}::vector, candidate."stableKey"
        `;
        const candidates: QuestionBankSemanticDeduplicationResult["candidates"] = [];
        for (const row of candidateRows) {
          const similarity = Math.max(-1, Math.min(1, row.similarity));
          let match = await transaction.questionBankSemanticDuplicate.findFirst({
            where: {
              questionBankItemId: item.id,
              candidateItemId: row.candidateItemId,
              contentHash: item.contentHash,
              candidateContentHash: row.candidateContentHash,
              embeddingModel: input.embeddingModel,
            },
          });
          match ??= await transaction.questionBankSemanticDuplicate.create({
              data: {
                questionBankItemId: item.id,
                candidateItemId: row.candidateItemId,
                contentHash: item.contentHash,
                candidateContentHash: row.candidateContentHash,
                embeddingModel: input.embeddingModel,
                similarity,
                threshold: semanticSimilarityThreshold,
              },
            });
          candidates.push({
            id: match.id,
            candidateItemId: row.candidateItemId,
            candidateStableKey: row.candidateStableKey,
            similarity,
            threshold: semanticSimilarityThreshold,
            decision: match.decision,
          });
        }
        const status = candidates.some((candidate) => candidate.decision === "DUPLICATE")
          ? "FAILED"
          : candidates.some((candidate) => candidate.decision === "PENDING")
            ? "PENDING"
            : "PASSED";
        await this.createSemanticValidation(transaction, item, actor.id, status, {
          coverageComplete: true,
          uncoveredItemCount: 0,
          candidateCount: candidates.length,
          candidateIds: candidates.map((candidate) => candidate.id),
          embeddingModel: input.embeddingModel,
          dimensions,
          sourceHash,
          embeddingHash,
          threshold: semanticSimilarityThreshold,
        });
        const updated = status === "FAILED"
          ? await transaction.questionBankItem.update({ where: { id: item.id }, data: { status: "REJECTED" } })
          : item;
        await this.auditSemantic(transaction, actor.id, item.id, status, 0, candidates.length);
        return {
          item: this.itemSummary(updated),
          coverageComplete: true,
          uncoveredItemCount: 0,
          candidates,
        };
      },
    });
  }

  async reviewSemanticDuplicate(
    actor: CurrentUser,
    id: string,
    matchId: string,
    input: ReviewSemanticDuplicateInput,
    key: string,
  ): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.idempotency.run({
      kind: "REVIEW_SEMANTIC_DUPLICATE_CANDIDATE",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { id, matchId, input },
      resultSchema: QuestionBankItemSummarySchema,
      execute: async (transaction) => {
        const match = await transaction.questionBankSemanticDuplicate.findFirst({
          where: { id: matchId, questionBankItemId: id, decision: "PENDING" },
          include: { questionBankItem: true },
        });
        if (match === null || match.contentHash !== match.questionBankItem.contentHash || actor.id === match.questionBankItem.createdByUserId) notFound();
        await transaction.questionBankSemanticDuplicate.update({
          where: { id: match.id },
          data: {
            decision: input.decision,
            reviewerUserId: actor.id,
            comment: input.comment,
            attestation: input.attestation,
            reviewedAt: new Date(),
          },
        });
        const currentMatches = await transaction.questionBankSemanticDuplicate.findMany({
          where: {
            questionBankItemId: id,
            contentHash: match.contentHash,
            embeddingModel: match.embeddingModel,
            candidateItem: { status: { in: ["DEDUPLICATED", "FACT_CHECKED", "REVIEWED", "PUBLISHED"] } },
          },
          select: { id: true, decision: true },
        });
        const status = currentMatches.some((candidate) => candidate.decision === "DUPLICATE")
          ? "FAILED"
          : currentMatches.some((candidate) => candidate.decision === "PENDING")
            ? "PENDING"
            : "PASSED";
        await this.createSemanticValidation(transaction, match.questionBankItem, actor.id, status, {
          coverageComplete: true,
          candidateCount: currentMatches.length,
          candidateIds: currentMatches.map((candidate) => candidate.id),
          embeddingModel: match.embeddingModel,
          threshold: match.threshold,
          humanAdjudicationComplete: status !== "PENDING",
        });
        const updated = status === "FAILED"
          ? await transaction.questionBankItem.update({ where: { id }, data: { status: "REJECTED" } })
          : match.questionBankItem;
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "REVIEW_SEMANTIC_DUPLICATE_CANDIDATE",
            resourceType: "QuestionBankSemanticDuplicate",
            resourceId: match.id,
            metadata: { questionBankItemId: id, decision: input.decision, resultingValidationStatus: status },
          },
        });
        return this.itemSummary(updated);
      },
    });
  }

  async factCheck(actor: CurrentUser, id: string, input: FactCheckQuestionBankInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.transition(actor, id, input, key, "FACT_CHECK_QUESTION_BANK_ITEM", "DEDUPLICATED", async (transaction, item) => {
      await transaction.questionBankValidation.create({
        data: {
          questionBankItemId: item.id,
          kind: "SUBJECT_FACT_CHECK",
          status: input.passed ? "PASSED" : "FAILED",
          contentHash: item.contentHash,
          performedByUserId: actor.id,
          details: { notes: input.notes, engineeringPrecheckOnly: true },
        },
      });
      return transaction.questionBankItem.update({ where: { id: item.id }, data: { status: input.passed ? "FACT_CHECKED" : "REJECTED" } });
    });
  }

  async recordHumanSubjectReview(
    actor: CurrentUser,
    id: string,
    input: HumanSubjectReviewQuestionBankInput,
    key: string,
  ): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    validateExternalReference(input.reviewerReference);
    return this.idempotency.run({
      kind: "RECORD_HUMAN_SUBJECT_REVIEW",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { id, input },
      resultSchema: QuestionBankItemSummarySchema,
      execute: async (transaction) => {
        const item = await transaction.questionBankItem.findFirst({ where: { id, status: "FACT_CHECKED" } });
        if (item === null || item.createdByUserId === actor.id) notFound();
        await transaction.questionBankValidation.create({
          data: {
            questionBankItemId: item.id,
            kind: "HUMAN_SUBJECT_REVIEW",
            status: input.passed ? "PASSED" : "FAILED",
            contentHash: item.contentHash,
            performedByUserId: actor.id,
            details: json({
              reviewerReference: input.reviewerReference,
              notes: input.notes,
              evidenceReferences: input.evidenceReferences,
              attestation: input.attestation,
            }),
          },
        });
        const updated = input.passed
          ? item
          : await transaction.questionBankItem.update({ where: { id }, data: { status: "REJECTED" } });
        await transaction.auditEvent.create({
          data: { actorUserId: actor.id, action: "RECORD_HUMAN_SUBJECT_REVIEW", resourceType: "QuestionBankItem", resourceId: id, metadata: { passed: input.passed, reviewerReference: input.reviewerReference } },
        });
        return this.itemSummary(updated);
      },
    });
  }

  async reviewLicense(
    actor: CurrentUser,
    id: string,
    input: ReviewQuestionBankLicenseInput,
    key: string,
  ): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    validateExternalReference(input.reviewerReference);
    return this.idempotency.run({
      kind: "REVIEW_QUESTION_BANK_LICENSE",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { id, input },
      resultSchema: QuestionBankItemSummarySchema,
      execute: async (transaction) => {
        const item = await transaction.questionBankItem.findFirst({ where: { id, status: "FACT_CHECKED" } });
        if (item === null || item.createdByUserId === actor.id) notFound();
        const passed = input.decision === "AUTHORIZED" || input.decision === "PUBLIC_DOMAIN";
        const licenseReview = await transaction.questionBankLicenseReview.create({
          data: {
            questionBankItemId: item.id,
            reviewerUserId: actor.id,
            contentHash: item.contentHash,
            decision: input.decision,
            basis: input.basis,
            evidenceReference: input.evidenceReference,
            evidenceSha256: input.evidenceSha256,
            reviewerReference: input.reviewerReference,
            attestation: input.attestation,
          },
        });
        await transaction.questionBankValidation.create({
          data: {
            questionBankItemId: item.id,
            kind: "LICENSE_REVIEW",
            status: passed ? "PASSED" : "FAILED",
            contentHash: item.contentHash,
            performedByUserId: actor.id,
            details: json({
              licenseReviewId: licenseReview.id,
              decision: input.decision,
              evidenceReference: input.evidenceReference,
              evidenceSha256: input.evidenceSha256,
              reviewerReference: input.reviewerReference,
              attestation: input.attestation,
            }),
          },
        });
        const updated = await transaction.questionBankItem.update({
          where: { id },
          data: { licenseStatus: input.decision, status: passed ? item.status : "REJECTED" },
        });
        await transaction.auditEvent.create({
          data: { actorUserId: actor.id, action: "REVIEW_QUESTION_BANK_LICENSE", resourceType: "QuestionBankItem", resourceId: id, metadata: { decision: input.decision, licenseReviewId: licenseReview.id } },
        });
        return this.itemSummary(updated);
      },
    });
  }

  async review(actor: CurrentUser, id: string, input: ReviewQuestionBankInput, key: string): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.transition(actor, id, input, key, "REVIEW_QUESTION_BANK_ITEM", "FACT_CHECKED", async (transaction, item) => {
      if (item.createdByUserId === actor.id) notFound();
      if (input.decision === "APPROVED") {
        const evidence = await this.preReviewEvidence(transaction, item);
        if (evidence.humanReviewerIds.has(actor.id)) notFound();
      }
      await transaction.questionBankReview.create({
        data: {
          questionBankItemId: item.id,
          reviewerUserId: actor.id,
          decision: input.decision,
          comment: input.comment,
          contentHash: item.contentHash,
          attestation: input.attestation,
        },
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
    return this.idempotency.run({
      kind: "PUBLISH_QUESTION_BANK_ITEM",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { id, input },
      resultSchema: QuestionBankItemSummarySchema,
      execute: async (transaction) => {
        const item = await transaction.questionBankItem.findFirst({ where: { id, status: "REVIEWED" } });
        if (item === null || item.createdByUserId === actor.id || item.reviewedByUserId === actor.id) notFound();
        const evidence = await this.preReviewEvidence(transaction, item);
        if (evidence.humanReviewerIds.has(actor.id)) notFound();
        const [textbook, knowledgeLinks, finalReview] = await Promise.all([
          transaction.textbookEdition.findFirst({ where: { id: item.textbookEditionId, status: "CONFIRMED" }, select: { id: true } }),
          transaction.questionBankItemKnowledgeNode.findMany({
            where: { questionBankItemId: item.id },
            select: { knowledgeNodeId: true, knowledgeNode: { select: { status: true } } },
            orderBy: { knowledgeNodeId: "asc" },
          }),
          transaction.questionBankReview.findFirst({
            where: {
              questionBankItemId: item.id,
              contentHash: item.contentHash,
              decision: "APPROVED",
              attestation: "FINAL_ADMIN_CONTENT_REVIEW_COMPLETED",
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          }),
        ]);
        if (
          textbook === null
          || knowledgeLinks.length === 0
          || knowledgeLinks.some((link) => link.knowledgeNode.status !== "CONFIRMED")
          || finalReview?.reviewerUserId !== item.reviewedByUserId
        ) notFound();
        const gateEvidenceHash = sha256(canonical({
          questionBankItemId: item.id,
          version: item.version,
          contentHash: item.contentHash,
          validationIds: [...evidence.validationIds].sort(),
          licenseReviewId: evidence.licenseReviewId,
          finalReviewId: finalReview.id,
          textbookEditionId: textbook.id,
          knowledgeNodeIds: knowledgeLinks.map((link) => link.knowledgeNodeId),
        }));
        const publishedAt = new Date();
        await transaction.questionBankRelease.create({
          data: {
            questionBankItemId: item.id,
            version: item.version,
            contentHash: item.contentHash,
            gateEvidenceHash,
            publishedByUserId: actor.id,
            publishedAt,
          },
        });
        const updated = await transaction.questionBankItem.update({
          where: { id: item.id },
          data: { status: "PUBLISHED", publishedAt },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "PUBLISH_QUESTION_BANK_ITEM",
            resourceType: "QuestionBankItem",
            resourceId: item.id,
            metadata: { fromStatus: item.status, toStatus: updated.status, version: item.version, contentHash: item.contentHash, gateEvidenceHash },
          },
        });
        return this.itemSummary(updated);
      },
    });
  }

  async rollbackRelease(
    actor: CurrentUser,
    id: string,
    input: RollbackQuestionBankReleaseInput,
    key: string,
  ): Promise<QuestionBankItemSummary> {
    requireAdmin(actor);
    return this.idempotency.run({
      kind: "RETIRE_PUBLISHED_QUESTION_BANK_ITEM",
      key,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { id, input },
      resultSchema: QuestionBankItemSummarySchema,
      execute: async (transaction) => {
        const item = await transaction.questionBankItem.findFirst({ where: { id, status: "PUBLISHED" } });
        if (item === null) notFound();
        const release = await transaction.questionBankRelease.findFirst({
          where: { questionBankItemId: id, version: item.version, contentHash: item.contentHash, status: "ACTIVE" },
        });
        if (release === null) notFound();
        const rolledBackAt = new Date();
        await transaction.questionBankRelease.update({
          where: { id: release.id },
          data: { status: "ROLLED_BACK", rolledBackByUserId: actor.id, rolledBackAt, rollbackReason: input.reason },
        });
        const updated = await transaction.questionBankItem.update({
          where: { id },
          data: { status: "RETIRED", retiredAt: rolledBackAt, retirementReason: input.reason },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "RETIRE_PUBLISHED_QUESTION_BANK_ITEM",
            resourceType: "QuestionBankItem",
            resourceId: id,
            metadata: { releaseId: release.id, version: item.version, reason: input.reason },
          },
        });
        return this.itemSummary(updated);
      },
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

  private async preReviewEvidence(transaction: Prisma.TransactionClient, item: QuestionBankItem): Promise<{
    validationIds: Set<string>;
    licenseReviewId: string;
    humanReviewerIds: Set<string>;
  }> {
    if (item.licenseStatus !== "AUTHORIZED" && item.licenseStatus !== "PUBLIC_DOMAIN") notFound();
    const validations = await transaction.questionBankValidation.findMany({
      where: { questionBankItemId: item.id, contentHash: item.contentHash, kind: { in: [...preReviewGateKinds] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const latest = new Map<QuestionBankValidationKind, QuestionBankValidation>();
    for (const validation of validations) {
      if (!latest.has(validation.kind)) latest.set(validation.kind, validation);
    }
    for (const kind of preReviewGateKinds) {
      if (latest.get(kind)?.status !== "PASSED") notFound();
    }
    const licenseReview = await transaction.questionBankLicenseReview.findFirst({
      where: {
        questionBankItemId: item.id,
        contentHash: item.contentHash,
        decision: item.licenseStatus,
        attestation: "HUMAN_LICENSE_REVIEW_COMPLETED",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (licenseReview === null) notFound();
    const pendingSemanticMatches = await transaction.questionBankSemanticDuplicate.count({
      where: {
        questionBankItemId: item.id,
        contentHash: item.contentHash,
        embeddingModel: item.semanticEmbeddingModel ?? "",
        decision: "PENDING",
        candidateItem: { status: { in: ["DEDUPLICATED", "FACT_CHECKED", "REVIEWED", "PUBLISHED"] } },
      },
    });
    if (pendingSemanticMatches !== 0) notFound();
    const humanReviewerIds = new Set<string>([licenseReview.reviewerUserId]);
    for (const kind of ["HUMAN_SUBJECT_REVIEW", "LICENSE_REVIEW"] as const) {
      const reviewerId = latest.get(kind)?.performedByUserId;
      if (reviewerId !== null && reviewerId !== undefined) humanReviewerIds.add(reviewerId);
    }
    return {
      validationIds: new Set(preReviewGateKinds.map((kind) => latest.get(kind)?.id ?? notFound())),
      licenseReviewId: licenseReview.id,
      humanReviewerIds,
    };
  }

  private async createSemanticValidation(
    transaction: Prisma.TransactionClient,
    item: QuestionBankItem,
    actorUserId: string,
    status: "PENDING" | "PASSED" | "FAILED",
    details: Record<string, unknown>,
  ): Promise<void> {
    await transaction.questionBankValidation.create({
      data: {
        questionBankItemId: item.id,
        kind: "SEMANTIC_DEDUPLICATION",
        status,
        contentHash: item.contentHash,
        performedByUserId: actorUserId,
        details: json(details),
      },
    });
  }

  private async auditSemantic(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    itemId: string,
    status: "PENDING" | "PASSED" | "FAILED",
    uncoveredItemCount: number,
    candidateCount: number,
  ): Promise<void> {
    await transaction.auditEvent.create({
      data: {
        actorUserId,
        action: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
        resourceType: "QuestionBankItem",
        resourceId: itemId,
        metadata: { status, uncoveredItemCount, candidateCount, threshold: semanticSimilarityThreshold },
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
