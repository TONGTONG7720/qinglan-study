import type {
  ConfirmOcrInput,
  CreatePrivateObjectInput,
  CurrentUser,
  OcrResult,
  PrivateObjectReadGrantResponse,
  PrivateObjectResponse,
} from "@study/contracts";
import {
  OcrResultSchema,
  PrivateObjectReadGrantResponseSchema,
  PrivateObjectResponseSchema,
} from "@study/contracts";
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";

import { ClamAvScannerService } from "../common/storage/clamav-scanner.service.js";
import { PrivateImageInspectionService } from "../common/storage/private-image-inspection.service.js";
import { PrivateObjectDeletionService } from "../common/storage/private-object-deletion.service.js";
import type { UploadGrant } from "../common/storage/s3-object-storage.service.js";
import { S3ObjectStorageService } from "../common/storage/s3-object-storage.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { PrivateObject, Question } from "../generated/prisma/client.js";
import { ModelGatewayService } from "./model-gateway.service.js";

const maximumObjectBytes = 10_000_000;
const maximumOcrAttempts = 3;

function notFound(): never { throw new NotFoundException(); }

function uniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

@Injectable()
export class OcrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ModelGatewayService,
    private readonly storage: S3ObjectStorageService,
    private readonly scanner: ClamAvScannerService,
    private readonly inspector: PrivateImageInspectionService,
    private readonly deletion: PrivateObjectDeletionService,
  ) {}

  async createObject(
    actor: CurrentUser,
    studentId: string,
    input: CreatePrivateObjectInput,
    idempotencyKey: string,
    now = new Date(),
  ): Promise<PrivateObjectResponse> {
    const familyId = await this.requireOwnStudent(actor, studentId);
    this.requireUploadChain();
    const dedupeKey = createHash("sha256")
      .update(`${studentId}\0${idempotencyKey}`, "utf8")
      .digest("hex");
    const existing = await this.prisma.privateObject.findUnique({ where: { dedupeKey } });
    if (existing !== null) {
      this.assertSameDeclaration(existing, input);
      if (existing.status !== "PENDING_UPLOAD" || existing.uploadKey === null) {
        return this.objectResult(existing, null);
      }
      const upload = await this.storage.createUploadGrant({
        key: existing.uploadKey,
        mimeType: input.mimeType,
        sha256: input.sha256,
        width: input.width,
        height: input.height,
      }, now);
      const refreshed = await this.prisma.privateObject.update({
        where: { id: existing.id },
        data: { uploadExpiresAt: upload.expiresAt },
      });
      return this.objectResult(refreshed, upload);
    }

    const objectId = randomUUID();
    const uploadKey = `incoming/${studentId}/${objectId}/${randomUUID()}`;
    const storageKey = `private/${studentId}/${objectId}`;
    const upload = await this.storage.createUploadGrant({
      key: uploadKey,
      mimeType: input.mimeType,
      sha256: input.sha256,
      width: input.width,
      height: input.height,
    }, now);
    const expiresAt = this.storage.retentionExpiresAt(now);
    try {
      const object = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.privateObject.create({
          data: {
            id: objectId,
            ownerStudentUserId: studentId,
            dedupeKey,
            storageKey,
            uploadKey,
            ...input,
            status: "PENDING_UPLOAD",
            scanStatus: "PENDING",
            scanPassed: false,
            uploadExpiresAt: upload.expiresAt,
            expiresAt,
          },
        });
        await transaction.retentionJob.create({
          data: {
            kind: "TEMP_OBJECT_PURGE",
            dedupeKey: `private-object:${created.id}`,
            nextRunAt: expiresAt,
            payload: { objectId: created.id },
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "PRIVATE_OBJECT_UPLOAD_GRANTED",
            resourceType: "PrivateObject",
            resourceId: created.id,
            metadata: {
              mimeType: input.mimeType,
              sizeBytes: input.sizeBytes,
              uploadExpiresAt: upload.expiresAt.toISOString(),
              objectExpiresAt: expiresAt.toISOString(),
            },
          },
        });
        return created;
      });
      return this.objectResult(object, upload);
    } catch (error) {
      if (!uniqueConflict(error)) throw error;
      const concurrent = await this.prisma.privateObject.findUnique({ where: { dedupeKey } });
      if (concurrent === null) throw new ConflictException();
      this.assertSameDeclaration(concurrent, input);
      if (concurrent.status !== "PENDING_UPLOAD" || concurrent.uploadKey === null) {
        return this.objectResult(concurrent, null);
      }
      const concurrentUpload = await this.storage.createUploadGrant({
        key: concurrent.uploadKey,
        mimeType: input.mimeType,
        sha256: input.sha256,
        width: input.width,
        height: input.height,
      }, now);
      const refreshed = await this.prisma.privateObject.update({
        where: { id: concurrent.id },
        data: { uploadExpiresAt: concurrentUpload.expiresAt },
      });
      return this.objectResult(refreshed, concurrentUpload);
    }
  }

  async getObject(actor: CurrentUser, objectId: string): Promise<PrivateObjectResponse> {
    this.requireStudent(actor);
    const object = await this.prisma.privateObject.findFirst({
      where: { id: objectId, ownerStudentUserId: actor.id, status: { not: "DELETED" } },
    });
    if (object === null) return notFound();
    return this.objectResult(object, null);
  }

  async createReadGrant(
    actor: CurrentUser,
    objectId: string,
    now = new Date(),
  ): Promise<PrivateObjectReadGrantResponse> {
    this.requireStudent(actor);
    if (!this.storage.isEnabled()) throw new ServiceUnavailableException();
    const object = await this.prisma.privateObject.findFirst({
      where: {
        id: objectId,
        ownerStudentUserId: actor.id,
        status: "READY",
        scanStatus: "CLEAN",
        scanPassed: true,
        expiresAt: { gt: now },
      },
    });
    if (object === null) return notFound();
    const grant = await this.storage.createReadGrant(object.storageKey, object.storageVersionId, now);
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: object.ownerStudentUserId },
      select: { familyId: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: actor.id,
        familyId: profile?.familyId ?? null,
        action: "PRIVATE_OBJECT_READ_GRANTED",
        resourceType: "PrivateObject",
        resourceId: object.id,
        metadata: { expiresAt: grant.expiresAt.toISOString() },
      },
    });
    return PrivateObjectReadGrantResponseSchema.parse({
      objectId: object.id,
      url: grant.url,
      expiresAt: grant.expiresAt.toISOString(),
    });
  }

  async completeObject(actor: CurrentUser, objectId: string, now = new Date()): Promise<PrivateObjectResponse> {
    this.requireStudent(actor);
    this.requireUploadChain();
    let object = await this.prisma.privateObject.findFirst({
      where: { id: objectId, ownerStudentUserId: actor.id, status: { not: "DELETED" } },
    });
    if (object === null) return notFound();
    if (object.status === "READY" || object.status === "QUARANTINED" || object.status === "DELETE_FAILED") {
      return this.objectResult(object, null);
    }
    if (object.status !== "PENDING_UPLOAD" || object.uploadKey === null || object.uploadExpiresAt === null) {
      throw new ConflictException();
    }
    const uploadKey = object.uploadKey;
    const uploadExpiresAt = object.uploadExpiresAt;
    const claimed = await this.prisma.privateObject.updateMany({
      where: { id: object.id, status: "PENDING_UPLOAD" },
      data: { status: "VERIFYING", uploadedAt: now, lastErrorCode: null },
    });
    if (claimed.count !== 1) throw new ConflictException();
    object = { ...object, status: "VERIFYING", uploadedAt: now };

    if (uploadExpiresAt < now) {
      return this.rejectUpload(object, "UPLOAD_GRANT_EXPIRED", "FAILED", now);
    }
    let bytes: Uint8Array;
    try {
      const head = await this.storage.headObject(uploadKey);
      if (head === null) return await this.rejectUpload(object, "UPLOAD_NOT_FOUND", "FAILED", now);
      if (
        head.contentLength !== object.sizeBytes
        || head.contentType !== object.mimeType
        || (process.env.OBJECT_STORAGE_SSE === "AES256" && head.serverSideEncryption !== "AES256")
        || head.metadata.sha256 !== object.sha256
        || head.metadata["declared-width"] !== String(object.width)
        || head.metadata["declared-height"] !== String(object.height)
      ) {
        return await this.rejectUpload(object, "UPLOAD_METADATA_MISMATCH", "FAILED", now);
      }
      bytes = await this.storage.readObject(uploadKey, maximumObjectBytes);
    } catch {
      return this.rejectUpload(object, "UPLOAD_READ_FAILED", "FAILED", now);
    }

    const inspection = await this.inspector.inspect(bytes, {
      mimeType: object.mimeType as "image/jpeg" | "image/png" | "image/webp",
      sizeBytes: object.sizeBytes,
      width: object.width,
      height: object.height,
      sha256: object.sha256,
    });
    if (!inspection.accepted) {
      return this.rejectUpload(object, inspection.errorCode, inspection.scanStatus, now);
    }

    try {
      await this.storage.deleteObject(uploadKey);
    } catch {
      return this.markDeleteFailure(object, "STAGING_DELETE_FAILED");
    }

    let finalVersionId: string | null = null;
    try {
      const receipt = await this.storage.writeVerifiedObject({
        key: object.storageKey,
        body: bytes,
        mimeType: object.mimeType,
        sha256: object.sha256,
      });
      finalVersionId = receipt.versionId;
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: object.ownerStudentUserId },
        select: { familyId: true },
      });
      const verified = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.privateObject.update({
          where: { id: object.id },
          data: {
            status: "READY",
            scanStatus: "CLEAN",
            scanPassed: true,
            uploadKey: null,
            uploadExpiresAt: null,
            verifiedAt: now,
            scanCompletedAt: now,
            storageVersionId: receipt.versionId,
            storageETag: receipt.etag,
            lastErrorCode: null,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: profile?.familyId ?? null,
            action: "PRIVATE_OBJECT_VERIFIED",
            resourceType: "PrivateObject",
            resourceId: object.id,
            metadata: { mimeType: object.mimeType, sizeBytes: object.sizeBytes },
          },
        });
        return updated;
      });
      return this.objectResult(verified, null);
    } catch {
      try {
        await this.storage.deleteObject(object.storageKey, finalVersionId);
      } catch {
        return this.markDeleteFailure(object, "FINALIZATION_ROLLBACK_FAILED");
      }
      return this.rejectAfterStagingDeletion(object, "FINAL_STORAGE_WRITE_FAILED", now);
    }
  }

  async retryObjectUpload(actor: CurrentUser, objectId: string, now = new Date()): Promise<PrivateObjectResponse> {
    this.requireStudent(actor);
    this.requireUploadChain();
    const object = await this.prisma.privateObject.findFirst({
      where: { id: objectId, ownerStudentUserId: actor.id, status: { not: "DELETED" } },
    });
    if (object === null) return notFound();
    const retryable = object.status === "PENDING_UPLOAD"
      || (object.status === "QUARANTINED" && object.scanStatus === "FAILED");
    if (!retryable || object.scanStatus === "INFECTED") throw new ConflictException();
    if (object.uploadKey !== null) {
      try {
        await this.storage.deleteObject(object.uploadKey);
      } catch {
        return this.markDeleteFailure(object, "STAGING_DELETE_FAILED");
      }
    }
    const uploadKey = `incoming/${object.ownerStudentUserId}/${object.id}/${randomUUID()}`;
    const upload = await this.storage.createUploadGrant({
      key: uploadKey,
      mimeType: object.mimeType as "image/jpeg" | "image/png" | "image/webp",
      sha256: object.sha256,
      width: object.width,
      height: object.height,
    }, now);
    const refreshed = await this.prisma.privateObject.update({
      where: { id: object.id },
      data: {
        status: "PENDING_UPLOAD",
        scanStatus: "PENDING",
        scanPassed: false,
        uploadKey,
        uploadExpiresAt: upload.expiresAt,
        uploadedAt: null,
        verifiedAt: null,
        scanCompletedAt: null,
        storageVersionId: null,
        storageETag: null,
        lastErrorCode: null,
      },
    });
    return this.objectResult(refreshed, upload);
  }

  async deleteObject(actor: CurrentUser, objectId: string): Promise<PrivateObjectResponse> {
    this.requireStudent(actor);
    const object = await this.prisma.privateObject.findFirst({
      where: { id: objectId, ownerStudentUserId: actor.id },
    });
    if (object === null) return notFound();
    const deleted = await this.deletion.deleteById(object.id, "USER_REQUEST", actor.id);
    return this.objectResult(deleted, null);
  }

  async start(actor: CurrentUser, studentId: string, objectId: string): Promise<OcrResult> {
    const familyId = await this.requireOwnStudent(actor, studentId);
    if (!this.storage.isEnabled()) throw new ServiceUnavailableException();
    const object = await this.prisma.privateObject.findFirst({
      where: {
        id: objectId,
        ownerStudentUserId: studentId,
        status: "READY",
        scanStatus: "CLEAN",
        scanPassed: true,
        expiresAt: { gt: new Date() },
      },
    });
    if (object === null) return notFound();

    let question = await this.prisma.question.findUnique({ where: { objectId } });
    if (question === null) {
      try {
        question = await this.prisma.question.create({
          data: { studentUserId: studentId, objectId, status: "OCR_PENDING" },
        });
      } catch (error) {
        if (!uniqueConflict(error)) throw error;
        question = await this.prisma.question.findUnique({ where: { objectId } });
      }
    }
    if (question === null) throw new ConflictException();
    if (question.status !== "OCR_PENDING" || question.attemptCount !== 0) {
      return this.questionResult(question);
    }
    const claimed = await this.prisma.question.updateMany({
      where: { id: question.id, status: "OCR_PENDING", attemptCount: 0 },
      data: { attemptCount: 1, lastAttemptAt: new Date(), errorCode: null },
    });
    if (claimed.count !== 1) {
      return this.questionResult(await this.prisma.question.findUniqueOrThrow({ where: { id: question.id } }));
    }
    return this.executeOcrAttempt(question.id, object, familyId, 1);
  }

  async retry(actor: CurrentUser, questionId: string): Promise<OcrResult> {
    this.requireStudent(actor);
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, studentUserId: actor.id, status: "FAILED" },
      include: { object: true, student: { include: { studentProfile: true } } },
    });
    if (question === null) return notFound();
    const object = question.object;
    const profile = question.student.studentProfile;
    if (object === null || profile === null) return notFound();
    if (
      question.attemptCount >= maximumOcrAttempts
      || object.status !== "READY"
      || object.scanStatus !== "CLEAN"
      || !object.scanPassed
    ) {
      throw new ConflictException();
    }
    const nextAttempt = question.attemptCount + 1;
    const claimed = await this.prisma.question.updateMany({
      where: { id: question.id, status: "FAILED", attemptCount: question.attemptCount },
      data: { status: "OCR_PENDING", attemptCount: nextAttempt, lastAttemptAt: new Date(), errorCode: null },
    });
    if (claimed.count !== 1) throw new ConflictException();
    return this.executeOcrAttempt(
      question.id,
      object,
      profile.familyId,
      nextAttempt,
    );
  }

  async confirm(actor: CurrentUser, questionId: string, input: ConfirmOcrInput): Promise<OcrResult> {
    this.requireStudent(actor);
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, studentUserId: actor.id, status: "OCR_REVIEW" },
    });
    if (question === null) return notFound();
    const updated = await this.prisma.question.update({
      where: { id: question.id },
      data: { status: "READY", confirmedText: input.confirmedText },
    });
    return this.questionResult(updated);
  }

  async getQuestion(actor: CurrentUser, questionId: string): Promise<OcrResult> {
    this.requireStudent(actor);
    const question = await this.prisma.question.findFirst({ where: { id: questionId, studentUserId: actor.id } });
    if (question === null) return notFound();
    return this.questionResult(question);
  }

  private async executeOcrAttempt(
    questionId: string,
    object: PrivateObject,
    familyId: string,
    attemptCount: number,
  ): Promise<OcrResult> {
    let bytes: Uint8Array;
    try {
      bytes = await this.storage.readObject(object.storageKey, object.sizeBytes, object.storageVersionId);
      const actualSha = createHash("sha256").update(bytes).digest("hex");
      if (actualSha !== object.sha256) throw new Error("OBJECT_INTEGRITY_FAILED");
    } catch {
      const failed = await this.prisma.question.update({
        where: { id: questionId },
        data: { status: "FAILED", errorCode: "OBJECT_READ_FAILED" },
      });
      return this.questionResult(failed);
    }
    try {
      const result = await this.gateway.call(familyId, object.ownerStudentUserId, {
        purpose: "OCR",
        dedupeKey: `ocr:${object.id}:attempt:${String(attemptCount)}`,
        input: {
          sha256: object.sha256,
          imageMimeType: object.mimeType,
          imageBase64: Buffer.from(bytes).toString("base64"),
        },
      });
      const text = typeof result.output.text === "string" ? result.output.text : "";
      const confidence = typeof result.output.confidence === "number" ? result.output.confidence : 0;
      const status = confidence < 0.85 ? "OCR_REVIEW" : "READY";
      const updated = await this.prisma.question.update({
        where: { id: questionId },
        data: {
          status,
          ocrText: text,
          confidence,
          providerCallId: result.providerCallId,
          errorCode: null,
          ...(status === "READY" ? { confirmedText: text } : {}),
        },
      });
      return this.questionResult(updated);
    } catch {
      const failed = await this.prisma.question.update({
        where: { id: questionId },
        data: { status: "FAILED", errorCode: "PROVIDER_FAILED" },
      });
      return this.questionResult(failed);
    }
  }

  private async rejectUpload(
    object: PrivateObject,
    errorCode: string,
    scanStatus: "INFECTED" | "FAILED",
    now: Date,
  ): Promise<PrivateObjectResponse> {
    if (object.uploadKey !== null) {
      try {
        await this.storage.deleteObject(object.uploadKey);
      } catch {
        return this.markDeleteFailure(object, "QUARANTINE_DELETE_FAILED");
      }
    }
    return this.rejectAfterStagingDeletion(object, errorCode, now, scanStatus);
  }

  private async rejectAfterStagingDeletion(
    object: PrivateObject,
    errorCode: string,
    now: Date,
    scanStatus: "INFECTED" | "FAILED" = "FAILED",
  ): Promise<PrivateObjectResponse> {
    const rejected = await this.prisma.privateObject.update({
      where: { id: object.id },
      data: {
        status: "QUARANTINED",
        scanStatus,
        scanPassed: false,
        uploadKey: null,
        uploadExpiresAt: null,
        scanCompletedAt: now,
        lastErrorCode: errorCode,
      },
    });
    return this.objectResult(rejected, null);
  }

  private async markDeleteFailure(object: PrivateObject, errorCode: string): Promise<PrivateObjectResponse> {
    const failed = await this.prisma.privateObject.update({
      where: { id: object.id },
      data: { status: "DELETE_FAILED", scanPassed: false, lastErrorCode: errorCode },
    });
    return this.objectResult(failed, null);
  }

  private async requireOwnStudent(actor: CurrentUser, studentId: string): Promise<string> {
    if (actor.id !== studentId || !actor.roles.includes("STUDENT")) return notFound();
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: studentId, status: "ACTIVE", family: { status: "ACTIVE" } },
      select: { familyId: true },
    });
    if (profile === null) return notFound();
    return profile.familyId;
  }

  private requireStudent(actor: CurrentUser): void {
    if (!actor.roles.includes("STUDENT")) return notFound();
  }

  private requireUploadChain(): void {
    if (!this.storage.isEnabled() || !this.scanner.isEnabled()) {
      throw new ServiceUnavailableException();
    }
  }

  private assertSameDeclaration(object: PrivateObject, input: CreatePrivateObjectInput): void {
    if (
      object.mimeType !== input.mimeType
      || object.sizeBytes !== input.sizeBytes
      || object.width !== input.width
      || object.height !== input.height
      || object.sha256 !== input.sha256
    ) {
      throw new ConflictException();
    }
  }

  private objectResult(object: PrivateObject, upload: UploadGrant | null): PrivateObjectResponse {
    return PrivateObjectResponseSchema.parse({
      id: object.id,
      ownerStudentUserId: object.ownerStudentUserId,
      mimeType: object.mimeType,
      sizeBytes: object.sizeBytes,
      width: object.width,
      height: object.height,
      status: object.status,
      upload: upload === null ? null : {
        method: upload.method,
        url: upload.url,
        headers: upload.headers,
        expiresAt: upload.expiresAt.toISOString(),
      },
      errorCode: object.lastErrorCode,
      expiresAt: object.expiresAt.toISOString(),
      deletedAt: object.deletedAt?.toISOString() ?? null,
    });
  }

  private questionResult(question: Question): OcrResult {
    if (question.status === "FAILED") {
      return OcrResultSchema.parse({
        questionId: question.id,
        status: "FAILED",
        errorCode: question.errorCode ?? "OCR_FAILED",
      });
    }
    if (question.status === "OCR_PENDING" || question.status === "UPLOADING") {
      return OcrResultSchema.parse({
        questionId: question.id,
        status: "OCR_PENDING",
        attemptCount: question.attemptCount,
      });
    }
    const text = question.confirmedText ?? question.ocrText ?? "";
    if (question.status === "READY") {
      return OcrResultSchema.parse({
        questionId: question.id,
        status: "READY",
        text,
        confidence: question.confidence ?? 1,
      });
    }
    return OcrResultSchema.parse({
      questionId: question.id,
      status: "OCR_REVIEW",
      text,
      confidence: question.confidence ?? 0,
    });
  }
}
