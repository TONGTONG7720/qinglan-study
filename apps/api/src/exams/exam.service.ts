import type {
  ConfirmExamInput,
  CreateExamInput,
  CurrentUser,
  ExamResponse,
  SubjectCode,
} from "@study/contracts";
import { ExamResponseSchema, selectRemediationItems } from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { StudentRecordAccessService } from "../common/auth/student-record-access.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { Prisma } from "../generated/prisma/client.js";

function notFound(): never {
  throw new NotFoundException();
}

function toHundredths(value: number): number {
  return Math.round(value * 100);
}

@Injectable()
export class ExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudentRecordAccessService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(
    actor: CurrentUser,
    studentUserId: string,
    input: CreateExamInput,
    key: string,
  ): Promise<ExamResponse> {
    const boundary = await this.access.assertOwnOrLinked(actor, studentUserId);
    return this.idempotency.run({
      kind: "CREATE_EXAM_DRAFT",
      key,
      scope: studentUserId,
      actorUserId: actor.id,
      familyId: boundary.familyId,
      request: input,
      resultSchema: ExamResponseSchema,
      execute: async (transaction) => {
        await this.assertKnowledgeNodes(transaction, input.subjectCode, input.items.map((item) => item.knowledgeNodeId));
        const exam = await transaction.exam.create({
          data: {
            studentUserId,
            createdByUserId: actor.id,
            subjectCode: input.subjectCode,
            title: input.title,
            occurredAt: new Date(input.occurredAt),
            items: {
              create: input.items.map((item) => ({
                ordinal: item.ordinal,
                label: item.label,
                scoreHundredths: toHundredths(item.score),
                maxScoreHundredths: toHundredths(item.maxScore),
                knowledgeNodeId: item.knowledgeNodeId,
                lossCause: item.lossCause,
              })),
            },
          },
          include: { items: { orderBy: { ordinal: "asc" } }, remediations: { orderBy: { priority: "asc" } } },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: boundary.familyId,
            action: "EXAM_DRAFT_CREATED",
            resourceType: "Exam",
            resourceId: exam.id,
            metadata: { subjectCode: input.subjectCode, itemCount: input.items.length },
          },
        });
        return this.result(exam);
      },
    });
  }

  async confirm(
    actor: CurrentUser,
    studentUserId: string,
    examId: string,
    input: ConfirmExamInput,
    key: string,
  ): Promise<ExamResponse> {
    const boundary = await this.access.assertOwnOrLinked(actor, studentUserId);
    return this.idempotency.run({
      kind: "CONFIRM_EXAM",
      key,
      scope: `${studentUserId}:${examId}`,
      actorUserId: actor.id,
      familyId: boundary.familyId,
      request: input,
      resultSchema: ExamResponseSchema,
      execute: async (transaction) => {
        const exam = await transaction.exam.findFirst({
          where: { id: examId, studentUserId },
          include: { items: { orderBy: { ordinal: "asc" } }, remediations: { orderBy: { priority: "asc" } } },
        });
        if (exam === null) return notFound();
        if (exam.status === "CONFIRMED") return this.result(exam);
        const totalScoreHundredths = exam.items.reduce((sum, item) => sum + item.scoreHundredths, 0);
        const totalMaxScoreHundredths = exam.items.reduce((sum, item) => sum + item.maxScoreHundredths, 0);
        const confirmedAt = new Date();
        await transaction.exam.update({
          where: { id: exam.id },
          data: { status: "CONFIRMED", totalScoreHundredths, totalMaxScoreHundredths, confirmedAt },
        });
        const selected = selectRemediationItems(exam.items);
        for (const [index, item] of selected.entries()) {
          const remediation = await transaction.remediationLink.create({
            data: {
              examId: exam.id,
              examItemId: item.id,
              studentUserId,
              priority: index + 1,
            },
          });
          await transaction.planCandidate.upsert({
            where: {
              studentUserId_sourceType_sourceId: {
                studentUserId,
                sourceType: "EXAM_REMEDIATION",
                sourceId: remediation.id,
              },
            },
            create: {
              studentUserId,
              sourceType: "EXAM_REMEDIATION",
              sourceId: remediation.id,
              title: `考试补救：${exam.subjectCode} ${item.label}`,
              estimatedMinutes: 15,
              availableAt: confirmedAt,
            },
            update: { active: true, availableAt: confirmedAt },
          });
        }
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: boundary.familyId,
            action: "EXAM_CONFIRMED",
            resourceType: "Exam",
            resourceId: exam.id,
            metadata: { itemCount: exam.items.length, remediationCount: selected.length },
          },
        });
        const confirmed = await transaction.exam.findUniqueOrThrow({
          where: { id: exam.id },
          include: { items: { orderBy: { ordinal: "asc" } }, remediations: { orderBy: { priority: "asc" } } },
        });
        return this.result(confirmed);
      },
    });
  }

  async get(actor: CurrentUser, studentUserId: string, examId: string): Promise<ExamResponse> {
    await this.access.assertOwnOrLinked(actor, studentUserId);
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, studentUserId },
      include: { items: { orderBy: { ordinal: "asc" } }, remediations: { orderBy: { priority: "asc" } } },
    });
    if (exam === null) return notFound();
    return this.result(exam);
  }

  private async assertKnowledgeNodes(
    transaction: Prisma.TransactionClient,
    subjectCode: SubjectCode,
    ids: readonly (string | null)[],
  ): Promise<void> {
    const uniqueIds = [...new Set(ids.filter((id): id is string => id !== null))];
    if (uniqueIds.length === 0) return;
    const count = await transaction.knowledgeNode.count({
      where: {
        id: { in: uniqueIds },
        status: "CONFIRMED",
        unit: { textbookEdition: { subjectCode, status: "CONFIRMED" } },
      },
    });
    if (count !== uniqueIds.length) return notFound();
  }

  private result(exam: {
    id: string;
    studentUserId: string;
    title: string;
    subjectCode: SubjectCode;
    occurredAt: Date;
    status: "DRAFT" | "CONFIRMED";
    totalScoreHundredths: number | null;
    totalMaxScoreHundredths: number | null;
    confirmedAt: Date | null;
    items: {
      id: string;
      ordinal: number;
      label: string;
      scoreHundredths: number;
      maxScoreHundredths: number;
      knowledgeNodeId: string | null;
      lossCause: CreateExamInput["items"][number]["lossCause"];
    }[];
    remediations: {
      id: string;
      examItemId: string;
      priority: number;
      evidenceId: string | null;
      completedAt: Date | null;
    }[];
  }): ExamResponse {
    return ExamResponseSchema.parse({
      id: exam.id,
      studentUserId: exam.studentUserId,
      title: exam.title,
      subjectCode: exam.subjectCode,
      occurredAt: exam.occurredAt.toISOString(),
      status: exam.status,
      totalScore: exam.totalScoreHundredths === null ? null : exam.totalScoreHundredths / 100,
      totalMaxScore: exam.totalMaxScoreHundredths === null ? null : exam.totalMaxScoreHundredths / 100,
      confirmedAt: exam.confirmedAt?.toISOString() ?? null,
      items: exam.items.map((item) => ({
        id: item.id,
        ordinal: item.ordinal,
        label: item.label,
        score: item.scoreHundredths / 100,
        maxScore: item.maxScoreHundredths / 100,
        knowledgeNodeId: item.knowledgeNodeId,
        lossCause: item.lossCause,
      })),
      remediations: exam.remediations.map((remediation) => ({
        id: remediation.id,
        examItemId: remediation.examItemId,
        priority: remediation.priority,
        evidenceId: remediation.evidenceId,
        completedAt: remediation.completedAt?.toISOString() ?? null,
      })),
    });
  }
}
