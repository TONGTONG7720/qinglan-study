import type {
  CreateMistakeInput,
  CurrentUser,
  MasteryEvidenceInput,
  MasteryEvidenceResult,
  MasteryStateResponse,
  MistakeResponse,
  RecoveryAttemptInput,
  RecoveryAttemptResponse,
  SubjectCode,
} from "@study/contracts";
import {
  MasteryEvidenceResultSchema,
  MasteryStateResponseSchema,
  MistakeResponseSchema,
  RecoveryAttemptResponseSchema,
  nextReviewAt,
  reviewIntervalDays,
} from "@study/contracts";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";

const acceptedConfidence = 0.7;

function notFound(): never {
  throw new NotFoundException();
}

function uniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

@Injectable()
export class MasteryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async createMistake(
    actor: CurrentUser,
    studentUserId: string,
    input: CreateMistakeInput,
    key: string,
  ): Promise<MistakeResponse> {
    this.requireOwnStudent(actor, studentUserId);
    return this.idempotency.run({
      kind: "CREATE_MISTAKE",
      key,
      scope: studentUserId,
      actorUserId: actor.id,
      familyId: actor.activeFamilyId,
      request: input,
      resultSchema: MistakeResponseSchema,
      execute: async (transaction) => {
        await this.assertActiveStudent(transaction, studentUserId);
        await this.assertKnowledgeNode(transaction, input.subjectCode, input.knowledgeNodeId);
        const mistake = await transaction.mistake.create({
          data: { studentUserId, ...input },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: actor.activeFamilyId,
            action: "MISTAKE_CREATED",
            resourceType: "Mistake",
            resourceId: mistake.id,
            metadata: { subjectCode: input.subjectCode, cause: input.cause },
          },
        });
        return this.mistakeResult(mistake);
      },
    });
  }

  async recordRecoveryAttempt(
    actor: CurrentUser,
    studentUserId: string,
    mistakeId: string,
    input: RecoveryAttemptInput,
    key: string,
  ): Promise<RecoveryAttemptResponse> {
    this.requireOwnStudent(actor, studentUserId);
    return this.idempotency.run({
      kind: "RECORD_RECOVERY_ATTEMPT",
      key,
      scope: `${studentUserId}:${mistakeId}`,
      actorUserId: actor.id,
      familyId: actor.activeFamilyId,
      request: input,
      resultSchema: RecoveryAttemptResponseSchema,
      execute: async (transaction) => {
        await this.assertActiveStudent(transaction, studentUserId);
        const mistake = await transaction.mistake.findFirst({
          where: { id: mistakeId, studentUserId },
          select: { id: true },
        });
        const source = await transaction.learningEvidence.findFirst({
          where: { id: input.sourceAttemptId, studentUserId, type: "RECOVERY_ATTEMPT" },
          select: { id: true, occurredAt: true },
        });
        if (mistake === null || source === null) return notFound();
        const existing = await transaction.recoveryAttempt.findUnique({
          where: { sourceAttemptId: input.sourceAttemptId },
        });
        if (existing !== null) {
          if (
            existing.studentUserId !== studentUserId
            || existing.mistakeId !== mistakeId
            || existing.correct !== input.correct
            || existing.independent !== input.independent
          ) {
            throw new ConflictException();
          }
          return this.recoveryResult(existing);
        }
        const recovery = await transaction.recoveryAttempt.create({
          data: {
            mistakeId,
            studentUserId,
            sourceAttemptId: source.id,
            correct: input.correct,
            independent: input.independent,
            completedAt: source.occurredAt,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: actor.activeFamilyId,
            action: "RECOVERY_ATTEMPT_RECORDED",
            resourceType: "RecoveryAttempt",
            resourceId: recovery.id,
            metadata: { correct: recovery.correct, independent: recovery.independent },
          },
        });
        return this.recoveryResult(recovery);
      },
    });
  }

  async recordEvidence(
    actor: CurrentUser,
    studentUserId: string,
    input: MasteryEvidenceInput,
    key: string,
  ): Promise<MasteryEvidenceResult> {
    this.requireOwnStudent(actor, studentUserId);
    try {
      return await this.idempotency.run({
        kind: "RECORD_MASTERY_EVIDENCE",
        key,
        scope: studentUserId,
        actorUserId: actor.id,
        familyId: actor.activeFamilyId,
        request: input,
        resultSchema: MasteryEvidenceResultSchema,
        execute: async (transaction) => {
          await this.assertActiveStudent(transaction, studentUserId);
          await this.assertKnowledgeNode(transaction, input.subjectCode, input.knowledgeNodeId);
          const source = await transaction.learningEvidence.findFirst({
            where: { id: input.sourceAttemptId, studentUserId, independent: true, valid: true },
            select: { id: true, occurredAt: true },
          });
          if (source === null) return notFound();
          await this.assertScopeIdentity(transaction, studentUserId, input);
          const existing = await transaction.masteryEvidence.findUnique({
            where: { sourceAttemptId: input.sourceAttemptId },
          });
          if (existing !== null) {
            return this.resolveExistingEvidence(transaction, existing, studentUserId, input);
          }
          const evidence = await transaction.masteryEvidence.create({
            data: {
              studentUserId,
              subjectCode: input.subjectCode,
              knowledgeNodeId: input.knowledgeNodeId,
              scopeKey: input.scopeKey,
              sourceAttemptId: source.id,
              type: input.type,
              scoreDelta: input.scoreDelta,
              confidence: input.confidence,
              status: input.confidence >= acceptedConfidence ? "ACCEPTED" : "REVIEW_REQUIRED",
              createdAt: source.occurredAt,
            },
          });
          await transaction.auditEvent.create({
            data: {
              actorUserId: actor.id,
              familyId: actor.activeFamilyId,
              action: "MASTERY_EVIDENCE_RECORDED",
              resourceType: "MasteryEvidence",
              resourceId: evidence.id,
              metadata: { status: evidence.status, subjectCode: evidence.subjectCode, scopeKey: evidence.scopeKey },
            },
          });
          return this.resultForEvidence(transaction, evidence);
        },
      });
    } catch (error) {
      if (!uniqueConflict(error)) throw error;
      return this.resultAfterConcurrentInsert(studentUserId, input);
    }
  }

  async state(
    actor: CurrentUser,
    studentUserId: string,
    subjectCode: SubjectCode,
    scopeKey: string,
  ): Promise<MasteryStateResponse> {
    this.requireOwnStudent(actor, studentUserId);
    const state = await this.prisma.masteryState.findUnique({
      where: { studentUserId_subjectCode_scopeKey: { studentUserId, subjectCode, scopeKey } },
    });
    if (state === null) return notFound();
    return this.stateResult(state);
  }

  async replay(
    actor: CurrentUser,
    studentUserId: string,
    subjectCode: SubjectCode,
    scopeKey: string,
    key: string,
  ): Promise<MasteryStateResponse> {
    this.requireOwnStudent(actor, studentUserId);
    return this.idempotency.run({
      kind: "REPLAY_MASTERY_STATE",
      key,
      scope: `${studentUserId}:${subjectCode}:${scopeKey}`,
      actorUserId: actor.id,
      familyId: actor.activeFamilyId,
      request: { studentUserId, subjectCode, scopeKey },
      resultSchema: MasteryStateResponseSchema,
      execute: async (transaction) => {
        await this.assertActiveStudent(transaction, studentUserId);
        const state = await this.recomputeState(transaction, studentUserId, subjectCode, scopeKey);
        if (state === null) return notFound();
        return state;
      },
    });
  }

  private async resultForEvidence(
    transaction: Prisma.TransactionClient,
    evidence: {
      id: string;
      studentUserId: string;
      subjectCode: SubjectCode;
      scopeKey: string;
      status: "ACCEPTED" | "REVIEW_REQUIRED";
    },
  ): Promise<MasteryEvidenceResult> {
    if (evidence.status === "REVIEW_REQUIRED") {
      return MasteryEvidenceResultSchema.parse({ status: evidence.status, evidenceId: evidence.id, state: null });
    }
    const state = await this.recomputeState(
      transaction,
      evidence.studentUserId,
      evidence.subjectCode,
      evidence.scopeKey,
    );
    if (state === null) throw new ConflictException();
    return MasteryEvidenceResultSchema.parse({ status: evidence.status, evidenceId: evidence.id, state });
  }

  private async recomputeState(
    transaction: Prisma.TransactionClient,
    studentUserId: string,
    subjectCode: SubjectCode,
    scopeKey: string,
  ): Promise<MasteryStateResponse | null> {
    const evidence = await transaction.masteryEvidence.findMany({
      where: { studentUserId, subjectCode, scopeKey, status: "ACCEPTED" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (evidence.length === 0) {
      const state = await transaction.masteryState.findUnique({
        where: { studentUserId_subjectCode_scopeKey: { studentUserId, subjectCode, scopeKey } },
        select: { id: true },
      });
      if (state !== null) {
        await transaction.planCandidate.updateMany({
          where: { studentUserId, sourceType: "OVERDUE_REVIEW", sourceId: state.id },
          data: { active: false },
        });
        await transaction.masteryState.delete({ where: { id: state.id } });
      }
      return null;
    }
    const latest = evidence[evidence.length - 1];
    const first = evidence[0];
    if (latest === undefined || first === undefined) throw new ConflictException();
    const score = Math.min(100, Math.max(0, 50 + evidence.reduce((sum, item) => sum + item.scoreDelta, 0)));
    const confidence = Math.round(
      evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length * 1_000_000,
    ) / 1_000_000;
    const reviewAt = nextReviewAt(latest.createdAt, evidence.length);
    const state = await transaction.masteryState.upsert({
      where: { studentUserId_subjectCode_scopeKey: { studentUserId, subjectCode, scopeKey } },
      create: {
        studentUserId,
        subjectCode,
        knowledgeNodeId: first.knowledgeNodeId,
        scopeKey,
        score,
        confidence,
        evidenceCount: evidence.length,
        nextReviewAt: reviewAt,
      },
      update: {
        knowledgeNodeId: first.knowledgeNodeId,
        score,
        confidence,
        evidenceCount: evidence.length,
        nextReviewAt: reviewAt,
      },
    });
    await transaction.reviewSchedule.upsert({
      where: { masteryStateId: state.id },
      create: {
        masteryStateId: state.id,
        dueAt: reviewAt,
        intervalDays: reviewIntervalDays(evidence.length),
      },
      update: {
        dueAt: reviewAt,
        intervalDays: reviewIntervalDays(evidence.length),
        active: true,
      },
    });
    await transaction.planCandidate.upsert({
      where: {
        studentUserId_sourceType_sourceId: {
          studentUserId,
          sourceType: "OVERDUE_REVIEW",
          sourceId: state.id,
        },
      },
      create: {
        studentUserId,
        sourceType: "OVERDUE_REVIEW",
        sourceId: state.id,
        title: `复习 ${subjectCode} · ${scopeKey}`,
        estimatedMinutes: 10,
        availableAt: reviewAt,
      },
      update: {
        title: `复习 ${subjectCode} · ${scopeKey}`,
        estimatedMinutes: 10,
        availableAt: reviewAt,
        active: true,
      },
    });
    return this.stateResult(state);
  }

  private async resultAfterConcurrentInsert(
    studentUserId: string,
    input: MasteryEvidenceInput,
  ): Promise<MasteryEvidenceResult> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.masteryEvidence.findUnique({
        where: { sourceAttemptId: input.sourceAttemptId },
      });
      if (existing === null) throw new ConflictException();
      return this.resolveExistingEvidence(transaction, existing, studentUserId, input);
    }, { isolationLevel: "Serializable" });
  }

  private async assertActiveStudent(
    transaction: Prisma.TransactionClient,
    studentUserId: string,
  ): Promise<void> {
    const profile = await transaction.studentProfile.count({
      where: { userId: studentUserId, status: "ACTIVE", user: { status: "ACTIVE" } },
    });
    if (profile !== 1) return notFound();
  }

  private async assertKnowledgeNode(
    transaction: Prisma.TransactionClient,
    subjectCode: SubjectCode,
    knowledgeNodeId: string | null,
  ): Promise<void> {
    if (knowledgeNodeId === null) return;
    const count = await transaction.knowledgeNode.count({
      where: {
        id: knowledgeNodeId,
        status: "CONFIRMED",
        unit: { textbookEdition: { subjectCode, status: "CONFIRMED" } },
      },
    });
    if (count !== 1) return notFound();
  }

  private async assertScopeIdentity(
    transaction: Prisma.TransactionClient,
    studentUserId: string,
    input: MasteryEvidenceInput,
  ): Promise<void> {
    const existing = await transaction.masteryEvidence.findFirst({
      where: { studentUserId, subjectCode: input.subjectCode, scopeKey: input.scopeKey },
      select: { knowledgeNodeId: true },
    });
    if (existing !== null && existing.knowledgeNodeId !== input.knowledgeNodeId) {
      throw new ConflictException();
    }
  }

  private async resolveExistingEvidence(
    transaction: Prisma.TransactionClient,
    evidence: {
      id: string;
      studentUserId: string;
      subjectCode: SubjectCode;
      knowledgeNodeId: string | null;
      scopeKey: string;
      type: "INDEPENDENT_ANSWER" | "REVIEW_RESULT" | "EXAM_RESULT";
      scoreDelta: number;
      confidence: number;
      status: "ACCEPTED" | "REVIEW_REQUIRED";
    },
    studentUserId: string,
    input: MasteryEvidenceInput,
  ): Promise<MasteryEvidenceResult> {
    if (this.sameEvidence(evidence, studentUserId, input)) {
      return this.resultForEvidence(transaction, evidence);
    }
    if (evidence.studentUserId !== studentUserId) throw new ConflictException();
    if (evidence.status === "ACCEPTED") {
      await transaction.masteryEvidence.update({
        where: { id: evidence.id },
        data: { status: "REVIEW_REQUIRED" },
      });
      await this.recomputeState(
        transaction,
        evidence.studentUserId,
        evidence.subjectCode,
        evidence.scopeKey,
      );
    }
    return MasteryEvidenceResultSchema.parse({
      status: "REVIEW_REQUIRED",
      evidenceId: evidence.id,
      state: null,
    });
  }

  private sameEvidence(
    evidence: {
      studentUserId: string;
      subjectCode: SubjectCode;
      knowledgeNodeId: string | null;
      scopeKey: string;
      type: "INDEPENDENT_ANSWER" | "REVIEW_RESULT" | "EXAM_RESULT";
      scoreDelta: number;
      confidence: number;
    },
    studentUserId: string,
    input: MasteryEvidenceInput,
  ): boolean {
    return (
      evidence.studentUserId === studentUserId
      && evidence.subjectCode === input.subjectCode
      && evidence.knowledgeNodeId === input.knowledgeNodeId
      && evidence.scopeKey === input.scopeKey
      && evidence.type === input.type
      && evidence.scoreDelta === input.scoreDelta
      && evidence.confidence === input.confidence
    );
  }

  private requireOwnStudent(actor: CurrentUser, studentUserId: string): void {
    if (actor.id !== studentUserId || !actor.roles.includes("STUDENT")) return notFound();
  }

  private mistakeResult(value: {
    id: string;
    studentUserId: string;
    subjectCode: SubjectCode;
    knowledgeNodeId: string | null;
    cause: CreateMistakeInput["cause"];
    promptSummary: string;
    createdAt: Date;
  }): MistakeResponse {
    return MistakeResponseSchema.parse({ ...value, createdAt: value.createdAt.toISOString() });
  }

  private recoveryResult(value: {
    id: string;
    mistakeId: string;
    studentUserId: string;
    sourceAttemptId: string;
    correct: boolean;
    independent: boolean;
    completedAt: Date;
  }): RecoveryAttemptResponse {
    return RecoveryAttemptResponseSchema.parse({ ...value, completedAt: value.completedAt.toISOString() });
  }

  private stateResult(value: {
    studentUserId: string;
    subjectCode: SubjectCode;
    knowledgeNodeId: string | null;
    scopeKey: string;
    score: number;
    confidence: number;
    evidenceCount: number;
    nextReviewAt: Date;
  }): MasteryStateResponse {
    return MasteryStateResponseSchema.parse({
      studentUserId: value.studentUserId,
      subjectCode: value.subjectCode,
      knowledgeNodeId: value.knowledgeNodeId,
      scopeKey: value.scopeKey,
      score: value.score,
      confidence: value.confidence,
      evidenceCount: value.evidenceCount,
      nextReviewAt: value.nextReviewAt.toISOString(),
    });
  }
}
