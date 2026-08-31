import type {
  CreateFamilyExportInput,
  CurrentUser,
  DeletionRequestResponse,
  FamilyDeletionInput,
  FamilyExportResponse,
  PersonalDeletionInput,
} from "@study/contracts";
import {
  DeletionRequestResponseSchema,
  ExportArchiveSchema,
  FamilyExportResponseSchema,
} from "@study/contracts";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";

const day = 24 * 60 * 60 * 1_000;
function notFound(): never { throw new NotFoundException(); }
function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService, private readonly idempotency: IdempotencyService) {}

  async createExport(actor: CurrentUser, familyId: string, input: CreateFamilyExportInput, key: string): Promise<FamilyExportResponse> {
    await this.assertOwner(actor, familyId);
    return this.idempotency.run({
      kind: "EXPORT_FAMILY_DATA", key, scope: familyId, actorUserId: actor.id, familyId,
      request: input, resultSchema: FamilyExportResponseSchema,
      execute: async (transaction) => {
        await this.assertOwnerIn(transaction, actor.id, familyId);
        const family = await transaction.family.findFirst({
          where: { id: familyId, status: "ACTIVE" },
          include: {
            memberships: { where: { revokedAt: null }, include: { user: true }, orderBy: { activeAt: "asc" } },
            studentProfiles: {
              where: { status: "ACTIVE" }, include: {
                user: true,
                family: false,
              }, orderBy: { userId: "asc" },
            },
          },
        });
        if (family === null) return notFound();
        const students = await Promise.all(family.studentProfiles.map(async (profile) => {
          const [mastery, exams, reports] = await Promise.all([
            transaction.masteryState.findMany({ where: { studentUserId: profile.userId }, orderBy: [{ subjectCode: "asc" }, { scopeKey: "asc" }] }),
            transaction.exam.findMany({ where: { studentUserId: profile.userId, status: "CONFIRMED" }, orderBy: { occurredAt: "asc" } }),
            transaction.weeklyReport.findMany({ where: { studentUserId: profile.userId }, select: { weekStart: true }, orderBy: { weekStart: "asc" } }),
          ]);
          return {
            userId: profile.userId, displayName: profile.user.displayName, grade: profile.grade, dailyMinutes: profile.dailyMinutes,
            mastery: mastery.map((item) => ({ subjectCode: item.subjectCode, scopeKey: item.scopeKey, score: item.score, confidence: item.confidence, evidenceCount: item.evidenceCount })),
            exams: exams.flatMap((exam) => exam.totalScoreHundredths === null || exam.totalMaxScoreHundredths === null ? [] : [{ title: exam.title, subjectCode: exam.subjectCode, occurredAt: exam.occurredAt.toISOString(), totalScore: exam.totalScoreHundredths / 100, totalMaxScore: exam.totalMaxScoreHundredths / 100 }]),
            weeklyReportWeeks: reports.map((report) => report.weekStart.toISOString().slice(0, 10)),
          };
        }));
        const archive = ExportArchiveSchema.parse({
          schemaVersion: 1, generatedAt: new Date().toISOString(), family: { id: family.id, name: family.name },
          members: family.memberships.map((membership) => ({ userId: membership.userId, displayName: membership.user.displayName, roles: membership.user.roles, accessLevel: membership.accessLevel })),
          students,
        });
        const expiresAt = new Date(Date.now() + day);
        const request = await transaction.familyExportRequest.create({ data: { familyId, requestedByUserId: actor.id, archive: json(archive), expiresAt } });
        await transaction.retentionJob.create({ data: { kind: "EXPORT_EXPIRE", dedupeKey: `export:${request.id}`, nextRunAt: expiresAt, payload: { exportId: request.id } } });
        await transaction.auditEvent.create({ data: { actorUserId: actor.id, familyId, action: "FAMILY_EXPORT_CREATED", resourceType: "FamilyExportRequest", resourceId: request.id, metadata: { expiresAt: expiresAt.toISOString() } } });
        return FamilyExportResponseSchema.parse({ id: request.id, familyId, status: request.status, expiresAt: expiresAt.toISOString(), archive });
      },
    });
  }

  async getExport(actor: CurrentUser, familyId: string, exportId: string, now = new Date()): Promise<FamilyExportResponse> {
    await this.assertOwner(actor, familyId);
    let request = await this.prisma.familyExportRequest.findFirst({ where: { id: exportId, familyId, requestedByUserId: actor.id } });
    if (request === null) return notFound();
    if (request.status === "READY" && request.expiresAt <= now) {
      request = await this.prisma.familyExportRequest.update({ where: { id: request.id }, data: { status: "EXPIRED", archive: Prisma.DbNull } });
    }
    return FamilyExportResponseSchema.parse({ id: request.id, familyId: request.familyId, status: request.status, expiresAt: request.expiresAt.toISOString(), archive: request.status === "READY" ? request.archive : null });
  }

  async requestPersonalDeletion(actor: CurrentUser, familyId: string, input: PersonalDeletionInput, key: string): Promise<DeletionRequestResponse> {
    await this.assertMemberGuardian(actor, familyId);
    return this.idempotency.run({
      kind: "DELETE_PERSONAL_ACCOUNT", key, scope: `${familyId}:${actor.id}`, actorUserId: actor.id, familyId,
      request: input, resultSchema: DeletionRequestResponseSchema,
      execute: async (transaction) => {
        await this.assertMemberGuardianIn(transaction, actor.id, familyId);
        const now = new Date();
        const request = await transaction.deletionRequest.create({ data: { familyId, requestedByUserId: actor.id, targetUserId: actor.id, type: "PERSONAL_GUARDIAN", executeAfter: now, createdAt: now } });
        await transaction.guardianStudentRelation.updateMany({ where: { familyId, guardianUserId: actor.id, revokedAt: null }, data: { revokedAt: now } });
        await transaction.familyMembership.updateMany({ where: { familyId, userId: actor.id, revokedAt: null }, data: { revokedAt: now } });
        await transaction.session.updateMany({ where: { userId: actor.id, revokedAt: null }, data: { revokedAt: now } });
        await transaction.retentionJob.create({ data: { kind: "PERSONAL_PURGE", dedupeKey: `personal:${request.id}`, nextRunAt: now, payload: { requestId: request.id, userId: actor.id } } });
        await transaction.auditEvent.create({ data: { actorUserId: actor.id, familyId, action: "PERSONAL_DELETION_REQUESTED", resourceType: "DeletionRequest", resourceId: request.id } });
        return this.deletionResult(request);
      },
    });
  }

  async requestFamilyDeletion(actor: CurrentUser, familyId: string, input: FamilyDeletionInput, key: string): Promise<DeletionRequestResponse> {
    await this.assertOwner(actor, familyId);
    return this.idempotency.run({
      kind: "DELETE_FAMILY", key, scope: familyId, actorUserId: actor.id, familyId,
      request: input, resultSchema: DeletionRequestResponseSchema,
      execute: async (transaction) => {
        await this.assertOwnerIn(transaction, actor.id, familyId);
        const now = new Date(); const executeAfter = new Date(now.getTime() + 30 * day);
        const members = await transaction.familyMembership.findMany({ where: { familyId, revokedAt: null }, select: { userId: true } });
        const request = await transaction.deletionRequest.create({ data: { familyId, requestedByUserId: actor.id, type: "FAMILY", executeAfter, createdAt: now } });
        await transaction.family.update({ where: { id: familyId }, data: { status: "DELETION_PENDING" } });
        await transaction.session.updateMany({ where: { userId: { in: members.map((member) => member.userId) }, revokedAt: null }, data: { revokedAt: now } });
        await transaction.retentionJob.create({ data: { kind: "FAMILY_PURGE", dedupeKey: `family:${request.id}`, nextRunAt: executeAfter, payload: { requestId: request.id, familyId } } });
        await transaction.auditEvent.create({ data: { actorUserId: actor.id, familyId, action: "FAMILY_DELETION_REQUESTED", resourceType: "DeletionRequest", resourceId: request.id, metadata: { executeAfter: executeAfter.toISOString() } } });
        return this.deletionResult(request);
      },
    });
  }

  private async assertOwner(actor: CurrentUser, familyId: string): Promise<void> { if (!actor.roles.includes("GUARDIAN") || actor.activeFamilyId !== familyId) return notFound(); await this.assertOwnerIn(this.prisma, actor.id, familyId); }
  private async assertMemberGuardian(actor: CurrentUser, familyId: string): Promise<void> { if (!actor.roles.includes("GUARDIAN") || actor.activeFamilyId !== familyId) return notFound(); await this.assertMemberGuardianIn(this.prisma, actor.id, familyId); }
  private async assertOwnerIn(client: Prisma.TransactionClient | PrismaService, userId: string, familyId: string): Promise<void> { const count = await client.familyMembership.count({ where: { familyId, userId, role: "GUARDIAN", accessLevel: "OWNER", revokedAt: null, family: { status: "ACTIVE" } } }); if (count !== 1) throw new ConflictException(); }
  private async assertMemberGuardianIn(client: Prisma.TransactionClient | PrismaService, userId: string, familyId: string): Promise<void> { const count = await client.familyMembership.count({ where: { familyId, userId, role: "GUARDIAN", accessLevel: "MEMBER", revokedAt: null, family: { status: "ACTIVE" } } }); if (count !== 1) throw new ConflictException(); }
  private deletionResult(request: { id: string; familyId: string; type: "PERSONAL_GUARDIAN" | "FAMILY"; targetUserId: string | null; status: "PENDING" | "COMPLETED" | "FAILED"; executeAfter: Date }): DeletionRequestResponse { return DeletionRequestResponseSchema.parse({ id: request.id, familyId: request.familyId, type: request.type, targetUserId: request.targetUserId, status: request.status, executeAfter: request.executeAfter.toISOString() }); }
}
