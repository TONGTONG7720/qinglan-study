import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import type { Prisma, PrivateObject } from "../../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { S3ObjectStorageService } from "./s3-object-storage.service.js";

export type PrivateObjectDeletionReason = "USER_REQUEST" | "RETENTION_EXPIRY" | "FAMILY_PURGE";

@Injectable()
export class PrivateObjectDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3ObjectStorageService,
  ) {}

  async deleteById(
    objectId: string,
    reason: PrivateObjectDeletionReason,
    actorUserId: string | null,
    now = new Date(),
  ): Promise<PrivateObject> {
    const object = await this.prisma.privateObject.findUnique({ where: { id: objectId } });
    if (object === null) throw new Error("PRIVATE_OBJECT_NOT_FOUND");
    if (object.status === "DELETED") return object;

    await this.prisma.privateObject.updateMany({
      where: { id: object.id, status: { not: "DELETED" } },
      data: { status: "DELETE_PENDING", lastErrorCode: null },
    });
    try {
      const uploadReceipt = object.uploadKey === null
        ? null
        : await this.storage.deleteObject(object.uploadKey);
      const finalReceipt = await this.storage.deleteObject(object.storageKey, object.storageVersionId);
      const receipt = JSON.parse(JSON.stringify({
        schemaVersion: 1,
        reason,
        confirmedAt: now.toISOString(),
        upload: uploadReceipt,
        final: finalReceipt,
      })) as Prisma.InputJsonValue;
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: object.ownerStudentUserId },
        select: { familyId: true },
      });
      return await this.prisma.$transaction(async (transaction) => {
        const deleted = await transaction.privateObject.update({
          where: { id: object.id },
          data: {
            status: "DELETED",
            scanPassed: false,
            uploadKey: null,
            uploadExpiresAt: null,
            deletedAt: now,
            deletionReceipt: receipt,
            lastErrorCode: null,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId,
            familyId: profile?.familyId ?? null,
            action: "PRIVATE_OBJECT_DELETE_CONFIRMED",
            resourceType: "PrivateObject",
            resourceId: object.id,
            metadata: { reason, confirmedAt: now.toISOString() },
          },
        });
        return deleted;
      });
    } catch {
      await this.prisma.privateObject.updateMany({
        where: { id: object.id, status: { not: "DELETED" } },
        data: { status: "DELETE_FAILED", lastErrorCode: "STORAGE_DELETE_FAILED" },
      });
      throw new ServiceUnavailableException();
    }
  }
}
