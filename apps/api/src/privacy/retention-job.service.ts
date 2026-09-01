import type { CurrentUser, RetentionRunResponse, RunRetentionJobsInput } from "@study/contracts";
import { RetentionRunResponseSchema } from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { PrivateObjectDeletionService } from "../common/storage/private-object-deletion.service.js";
import { Prisma } from "../generated/prisma/client.js";

const PayloadSchema = z.object({ requestId: z.uuid().optional(), userId: z.uuid().optional(), familyId: z.uuid().optional(), exportId: z.uuid().optional(), objectId: z.uuid().optional(), modelCallId: z.uuid().optional() }).strict();

@Injectable()
export class RetentionJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectDeletion: PrivateObjectDeletionService,
  ) {}

  async run(actor: CurrentUser, input: RunRetentionJobsInput, now = new Date()): Promise<RetentionRunResponse> {
    if (!actor.roles.includes("ADMIN")) throw new NotFoundException();
    const owner = `admin:${actor.id}:${randomUUID()}`;
    const leaseUntil = new Date(now.getTime() + 5 * 60 * 1_000);
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH candidates AS (
        SELECT "id" FROM "RetentionJob"
        WHERE (("status" IN ('PENDING', 'FAILED') AND "nextRunAt" <= ${now}) OR ("status" = 'RUNNING' AND "leaseExpiresAt" < ${now}))
        ORDER BY "nextRunAt", "id" FOR UPDATE SKIP LOCKED LIMIT ${input.limit}
      )
      UPDATE "RetentionJob" job SET "status" = 'RUNNING', "leaseOwner" = ${owner}, "leaseExpiresAt" = ${leaseUntil},
        "attemptCount" = job."attemptCount" + 1, "updatedAt" = CURRENT_TIMESTAMP
      FROM candidates WHERE job."id" = candidates."id" RETURNING job."id"
    `;
    let succeeded = 0; let failed = 0;
    for (const row of claimed) {
      try { await this.execute(row.id, owner, now); succeeded += 1; }
      catch { failed += 1; await this.prisma.retentionJob.update({ where: { id: row.id }, data: { status: "FAILED", leaseOwner: null, leaseExpiresAt: null, lastErrorCode: "JOB_FAILED", nextRunAt: new Date(now.getTime() + 60 * 1_000) } }); }
    }
    return RetentionRunResponseSchema.parse({ claimed: claimed.length, succeeded, failed });
  }

  private async execute(jobId: string, owner: string, now: Date): Promise<void> {
    const job = await this.prisma.retentionJob.findFirstOrThrow({ where: { id: jobId, status: "RUNNING", leaseOwner: owner } });
    const payload = PayloadSchema.parse(job.payload);
    if (job.kind === "EXPORT_EXPIRE") {
      if (payload.exportId === undefined) throw new Error("payload");
      await this.prisma.familyExportRequest.updateMany({ where: { id: payload.exportId, status: "READY", expiresAt: { lte: now } }, data: { status: "EXPIRED", archive: Prisma.DbNull } });
    } else if (job.kind === "PERSONAL_PURGE") {
      const requestId = payload.requestId; const userId = payload.userId;
      if (requestId === undefined || userId === undefined) throw new Error("payload");
      await this.prisma.$transaction(async (transaction) => {
        const request = await transaction.deletionRequest.findFirstOrThrow({ where: { id: requestId, type: "PERSONAL_GUARDIAN", status: "PENDING", targetUserId: userId, executeAfter: { lte: now } } });
        await transaction.familyExportRequest.updateMany({ where: { familyId: request.familyId, status: "READY" }, data: { status: "EXPIRED", archive: Prisma.DbNull } });
        await transaction.user.delete({ where: { id: userId } });
        await transaction.deletionRequest.update({ where: { id: request.id }, data: { status: "COMPLETED", completedAt: now } });
      });
    } else if (job.kind === "FAMILY_PURGE") {
      const requestId = payload.requestId; const familyId = payload.familyId;
      if (requestId === undefined || familyId === undefined) throw new Error("payload");
      await this.prisma.deletionRequest.findFirstOrThrow({
        where: { id: requestId, familyId, type: "FAMILY", status: "PENDING", executeAfter: { lte: now } },
      });
      const studentIds = (await this.prisma.studentProfile.findMany({
        where: { familyId },
        select: { userId: true },
      })).map((student) => student.userId);
      const privateObjects = await this.prisma.privateObject.findMany({
        where: { ownerStudentUserId: { in: studentIds }, status: { not: "DELETED" } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      for (const object of privateObjects) {
        await this.objectDeletion.deleteById(object.id, "FAMILY_PURGE", null, now);
      }
      await this.prisma.$transaction(async (transaction) => {
        const request = await transaction.deletionRequest.findFirstOrThrow({ where: { id: requestId, familyId, type: "FAMILY", status: "PENDING", executeAfter: { lte: now } } });
        const students = await transaction.studentProfile.findMany({ where: { familyId }, select: { userId: true } });
        await transaction.familyExportRequest.updateMany({ where: { familyId, status: "READY" }, data: { status: "EXPIRED", archive: Prisma.DbNull } });
        await transaction.family.delete({ where: { id: familyId, status: "DELETION_PENDING" } });
        await transaction.user.deleteMany({ where: { id: { in: students.map((student) => student.userId) }, memberships: { none: {} } } });
        await transaction.deletionRequest.update({ where: { id: request.id }, data: { status: "COMPLETED", completedAt: now } });
      });
    } else if (job.kind === "AI_DEBUG_PURGE") {
      if (payload.modelCallId === undefined) throw new Error("payload");
      await this.prisma.modelCall.updateMany({ where: { id: payload.modelCallId }, data: { output: Prisma.DbNull } });
    } else {
      if (payload.objectId === undefined) throw new Error("payload");
      await this.objectDeletion.deleteById(payload.objectId, "RETENTION_EXPIRY", null, now);
    }
    await this.prisma.retentionJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", leaseOwner: null, leaseExpiresAt: null, lastErrorCode: null } });
  }
}
