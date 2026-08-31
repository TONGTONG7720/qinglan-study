import type { ConfirmOcrInput, CreatePrivateObjectInput, CurrentUser, OcrResult, PrivateObjectResponse } from "@study/contracts";
import { OcrResultSchema, PrivateObjectResponseSchema } from "@study/contracts";
import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { ModelGatewayService } from "./model-gateway.service.js";

function notFound(): never { throw new NotFoundException(); }

export function developmentObjectStorageAvailable(environment: NodeJS.ProcessEnv): boolean {
  return environment.NODE_ENV === "test"
    || (
      environment.NODE_ENV === "development"
      && environment.OBJECT_STORAGE_PROVIDER === "development-fixture"
    );
}

function requireObjectStorage(): void {
  if (!developmentObjectStorageAvailable(process.env)) {
    throw new ServiceUnavailableException();
  }
}

@Injectable()
export class OcrService {
  constructor(private readonly prisma: PrismaService, private readonly gateway: ModelGatewayService) {}

  async createObject(actor: CurrentUser, studentId: string, input: CreatePrivateObjectInput): Promise<PrivateObjectResponse> {
    this.requireOwnStudent(actor, studentId);
    requireObjectStorage();
    const object = await this.prisma.privateObject.create({
      data: {
        ownerStudentUserId: studentId, storageKey: `private/${studentId}/${randomUUID()}`,
        ...input, status: "READY", scanPassed: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      },
    });
    return this.objectResult(object);
  }

  async getObject(actor: CurrentUser, objectId: string): Promise<PrivateObjectResponse> {
    const object = await this.prisma.privateObject.findFirst({ where: { id: objectId, ownerStudentUserId: actor.id, status: { not: "DELETED" } } });
    if (object === null) return notFound();
    requireObjectStorage();
    return this.objectResult(object);
  }

  async start(actor: CurrentUser, studentId: string, objectId: string): Promise<OcrResult> {
    this.requireOwnStudent(actor, studentId);
    requireObjectStorage();
    const object = await this.prisma.privateObject.findFirst({
      where: { id: objectId, ownerStudentUserId: studentId, status: "READY", scanPassed: true },
    });
    if (object === null) return notFound();
    const prior = await this.prisma.question.findUnique({ where: { objectId } });
    if (prior !== null) return this.questionResult(prior);
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { familyId: true } });
    if (profile === null) return notFound();
    const question = await this.prisma.question.create({ data: { studentUserId: studentId, objectId, status: "OCR_PENDING" } });
    try {
      const result = await this.gateway.call(profile.familyId, studentId, {
        purpose: "OCR", dedupeKey: `ocr:${objectId}`, input: { sha256: object.sha256 },
      });
      const text = typeof result.output.text === "string" ? result.output.text : "";
      const confidence = typeof result.output.confidence === "number" ? result.output.confidence : 0;
      const status = confidence < 0.85 ? "OCR_REVIEW" : "READY";
      const updated = await this.prisma.question.update({
        where: { id: question.id },
        data: { status, ocrText: text, confidence, providerCallId: result.providerCallId, ...(status === "READY" ? { confirmedText: text } : {}) },
      });
      return this.questionResult(updated);
    } catch {
      const failed = await this.prisma.question.update({ where: { id: question.id }, data: { status: "FAILED", errorCode: "PROVIDER_FAILED" } });
      return this.questionResult(failed);
    }
  }

  async confirm(actor: CurrentUser, questionId: string, input: ConfirmOcrInput): Promise<OcrResult> {
    const question = await this.prisma.question.findFirst({ where: { id: questionId, studentUserId: actor.id, status: "OCR_REVIEW" } });
    if (question === null || !actor.roles.includes("STUDENT")) return notFound();
    const updated = await this.prisma.question.update({ where: { id: question.id }, data: { status: "READY", confirmedText: input.confirmedText } });
    return this.questionResult(updated);
  }

  async getQuestion(actor: CurrentUser, questionId: string): Promise<OcrResult> {
    const question = await this.prisma.question.findFirst({ where: { id: questionId, studentUserId: actor.id } });
    if (question === null) return notFound();
    return this.questionResult(question);
  }

  private requireOwnStudent(actor: CurrentUser, studentId: string): void {
    if (actor.id !== studentId || !actor.roles.includes("STUDENT")) return notFound();
  }
  private objectResult(object: { id: string; ownerStudentUserId: string; mimeType: string; sizeBytes: number; storageKey: string; expiresAt: Date }): PrivateObjectResponse {
    return PrivateObjectResponseSchema.parse({
      id: object.id,
      ownerStudentUserId: object.ownerStudentUserId,
      mimeType: object.mimeType,
      sizeBytes: object.sizeBytes,
      storageKey: object.storageKey,
      uploadUrl: `private-upload://${object.id}`,
      expiresAt: object.expiresAt.toISOString(),
    });
  }
  private questionResult(question: { id: string; status: "UPLOADING" | "OCR_PENDING" | "OCR_REVIEW" | "READY" | "FAILED"; ocrText: string | null; confirmedText: string | null; confidence: number | null; errorCode: string | null }): OcrResult {
    if (question.status === "FAILED") return OcrResultSchema.parse({ questionId: question.id, status: "FAILED", errorCode: question.errorCode ?? "OCR_FAILED" });
    const text = question.confirmedText ?? question.ocrText ?? "";
    if (question.status === "READY") return OcrResultSchema.parse({ questionId: question.id, status: "READY", text, confidence: question.confidence ?? 1 });
    return OcrResultSchema.parse({ questionId: question.id, status: "OCR_REVIEW", text, confidence: question.confidence ?? 0 });
  }
}
