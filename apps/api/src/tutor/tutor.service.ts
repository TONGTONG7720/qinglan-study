import type { ContentLicenseStatus, ContentType, CurrentUser, StartTutorInput, SubjectCode, TutorAdvanceInput, TutorSessionResponse, TutorStage } from "@study/contracts";
import { TutorSessionResponseSchema, nextTutorStage } from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { ModelGatewayService } from "../ai/model-gateway.service.js";
import { CurriculumRetriever } from "./curriculum-retriever.service.js";

function notFound(): never { throw new NotFoundException(); }

@Injectable()
export class TutorService {
  constructor(private readonly prisma: PrismaService, private readonly retriever: CurriculumRetriever, private readonly gateway: ModelGatewayService) {}

  async addReviewedContent(actor: CurrentUser, input: {
    subjectCode: SubjectCode;
    textbookEditionId: string;
    unitId: string;
    knowledgeNodeId: string;
    textbookAssetId: string | null;
    excerpt: string;
    sourceReference: string;
    pageStart: number;
    pageEnd: number;
    contentType: ContentType;
    sourceHash: string;
    licenseStatus: ContentLicenseStatus;
    contentVersion: string;
    embedding: [number, number, number];
  }) {
    if (!actor.roles.includes("ADMIN")) return notFound();
    if (!new Set<ContentLicenseStatus>(["AUTHORIZED", "PUBLIC_DOMAIN"]).has(input.licenseStatus)) return notFound();
    const [unit, node, asset] = await Promise.all([
      this.prisma.unit.count({ where: { id: input.unitId, textbookEditionId: input.textbookEditionId, textbookEdition: { subjectCode: input.subjectCode, status: "CONFIRMED" }, status: "CONFIRMED" } }),
      this.prisma.knowledgeNode.count({ where: { id: input.knowledgeNodeId, unitId: input.unitId, status: "CONFIRMED" } }),
      input.textbookAssetId === null
        ? Promise.resolve(1)
        : this.prisma.textbookAsset.count({ where: { id: input.textbookAssetId, textbookEditionId: input.textbookEditionId, status: "AVAILABLE", scanPassed: true, licenseStatus: { in: ["AUTHORIZED", "PUBLIC_DOMAIN"] } } }),
    ]);
    if (unit !== 1 || node !== 1 || asset !== 1) return notFound();
    const content = await this.prisma.reviewedContent.create({
      data: {
        subjectCode: input.subjectCode,
        textbookEditionId: input.textbookEditionId,
        unitId: input.unitId,
        knowledgeNodeId: input.knowledgeNodeId,
        textbookAssetId: input.textbookAssetId,
        excerpt: input.excerpt,
        sourceReference: input.sourceReference,
        pageStart: input.pageStart,
        pageEnd: input.pageEnd,
        contentType: input.contentType,
        sourceHash: input.sourceHash,
        licenseStatus: input.licenseStatus,
        contentVersion: input.contentVersion,
      },
    });
    const vector = `[${input.embedding.join(",")}]`;
    await this.prisma.$executeRaw`
      UPDATE "ReviewedContent" SET "status" = 'REVIEWED'::"ReviewedContentStatus",
        "reviewedByUserId" = ${actor.id}::uuid, "reviewedAt" = CURRENT_TIMESTAMP,
        "embedding" = ${vector}::vector WHERE "id" = ${content.id}::uuid
    `;
    return { id: content.id, status: "REVIEWED" as const };
  }

  async start(actor: CurrentUser, studentId: string, input: StartTutorInput): Promise<TutorSessionResponse> {
    if (actor.id !== studentId || !actor.roles.includes("STUDENT")) return notFound();
    const evidence = await this.retriever.retrieve(studentId, input.subjectCode, input.textbookEditionId, input.unitId, input.question);
    const stage: TutorStage = evidence.length === 0 ? "NEEDS_EVIDENCE" : "ASK_ATTEMPT";
    const response = stage === "NEEDS_EVIDENCE" ? "当前证据不足，无法生成教材引用。" : "请先写出你的解题尝试。";
    const session = await this.prisma.tutorSession.create({
      data: {
        studentUserId: studentId, subjectCode: input.subjectCode, textbookEditionId: input.textbookEditionId,
        unitId: input.unitId, stage, promptVersion: "tutor-v1", questionText: input.question,
        steps: { create: { ordinal: 1, stage, response, evidenceIds: evidence.map((item) => item.id), evidence: { connect: evidence.map((item) => ({ id: item.id })) } } },
      },
    });
    return this.result(session.id, studentId, stage, evidence.map((item) => item.id), response);
  }

  async advance(actor: CurrentUser, sessionId: string, input: TutorAdvanceInput): Promise<TutorSessionResponse> {
    const session = await this.prisma.tutorSession.findFirst({ where: { id: sessionId, studentUserId: actor.id }, include: { steps: { orderBy: { ordinal: "desc" }, take: 1 } } });
    if (session === null || !actor.roles.includes("STUDENT")) return notFound();
    const current = session.stage as TutorStage;
    let next: TutorStage;
    try { next = nextTutorStage(current, input.action); } catch { return notFound(); }
    const previous = session.steps[0]; const evidenceIds = Array.isArray(previous?.evidenceIds) ? previous.evidenceIds.filter((id): id is string => typeof id === "string") : [];
    if (evidenceIds.length === 0) return notFound();
    const reviewedEvidence = await this.prisma.reviewedContent.findMany({
      where: { id: { in: evidenceIds }, status: "REVIEWED" },
      select: { id: true, excerpt: true, sourceReference: true },
    });
    const evidenceById = new Map(reviewedEvidence.map((item) => [item.id, item]));
    const evidence = evidenceIds.flatMap((id) => {
      const item = evidenceById.get(id);
      return item === undefined
        ? []
        : [{ excerpt: item.excerpt, sourceReference: item.sourceReference }];
    });
    if (evidence.length === 0) return notFound();
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: actor.id }, select: { familyId: true } });
    if (profile === null) return notFound();
    let response: string; let modelCallId: string | null = null;
    try {
      const call = await this.gateway.call(profile.familyId, actor.id, {
        purpose: "TUTOR_FAST", dedupeKey: `tutor:${session.id}:${String((previous?.ordinal ?? 0) + 1)}`,
        input: {
          stage: next,
          question: session.questionText,
          studentInput: input.content,
          evidence,
          promptVersion: session.promptVersion,
        },
      });
      response = typeof call.output.text === "string" ? call.output.text : "请继续按当前步骤作答。"; modelCallId = call.providerCallId;
    } catch { next = "NEEDS_EVIDENCE"; response = "模型服务暂不可用，已保留会话且未重复扣费。"; }
    const ordinal = (previous?.ordinal ?? 0) + 1;
    await this.prisma.$transaction([
      this.prisma.tutorSession.update({ where: { id: session.id }, data: { stage: next } }),
      this.prisma.tutorStep.create({ data: {
        sessionId: session.id, ordinal, stage: next, action: input.action, content: input.content,
        response, evidenceIds: evidenceIds, modelCallId,
        evidence: { connect: evidenceIds.map((id) => ({ id })) },
      } }),
    ]);
    return this.result(session.id, actor.id, next, evidenceIds, response);
  }

  private result(id: string, studentUserId: string, stage: TutorStage, evidenceIds: string[], response: string): TutorSessionResponse {
    return TutorSessionResponseSchema.parse({ id, studentUserId, stage, evidenceIds, response, promptVersion: "tutor-v1" });
  }
}
