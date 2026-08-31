import type {
  CreateJoinAuthorizationInput,
  CreateStudentInput,
  CurrentUser,
  FamilySummary,
  GrantStudentConsentInput,
  GrantGuardianRelationInput,
  JoinAuthorization,
  OwnershipTransfer,
  ProposeOwnershipTransferInput,
  RevokeGuardianRelationInput,
  RevokeStudentConsentInput,
  StudentConsent,
  StudentSummary,
} from "@study/contracts";
import {
  FamilySummarySchema,
  JoinAuthorizationSchema,
  OwnershipTransferSchema,
  StudentSummarySchema,
  StudentConsentSchema,
} from "@study/contracts";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import { PasswordService } from "../auth/password.service.js";
import type { Prisma } from "../generated/prisma/client.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";

const MutationResultSchema = z.object({ id: z.uuid(), status: z.string().min(1).max(40) }).strict();
type MutationResult = z.infer<typeof MutationResultSchema>;
const transferLifetimeMilliseconds = 24 * 60 * 60 * 1_000;

function resourceNotFound(): never {
  throw new NotFoundException();
}

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async get(actor: CurrentUser, familyId: string): Promise<FamilySummary> {
    const membership = await this.prisma.familyMembership.findFirst({
      where: {
        familyId,
        userId: actor.id,
        revokedAt: null,
        family: { status: "ACTIVE" },
      },
      select: { role: true, accessLevel: true },
    });
    if (membership === null) {
      return resourceNotFound();
    }

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
        memberships: {
          where: { revokedAt: null },
          select: {
            userId: true,
            role: true,
            accessLevel: true,
            user: { select: { displayName: true } },
          },
          orderBy: { activeAt: "asc" },
        },
      },
    });
    if (family === null) {
      return resourceNotFound();
    }

    const allowedStudentIds = await this.allowedStudentIds(actor.id, familyId, membership);
    const students = allowedStudentIds.length === 0
      ? []
      : await this.prisma.studentProfile.findMany({
        where: { familyId, userId: { in: allowedStudentIds } },
        select: {
          userId: true,
          grade: true,
          dailyMinutes: true,
          status: true,
          user: { select: { displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      });

    return FamilySummarySchema.parse({
      id: family.id,
      name: family.name,
      members: family.memberships.map((item) => ({
        userId: item.userId,
        displayName: item.user.displayName,
        role: item.role,
        accessLevel: item.accessLevel,
      })),
      students: students.map((student) => ({
        userId: student.userId,
        displayName: student.user.displayName,
        grade: student.grade,
        dailyMinutes: student.dailyMinutes,
        status: student.status,
      })),
    });
  }

  async authorizeJoin(
    actor: CurrentUser,
    familyId: string,
    input: CreateJoinAuthorizationInput,
    idempotencyKey: string,
  ): Promise<JoinAuthorization> {
    return this.idempotency.run({
      kind: "AUTHORIZE_JOIN_INVITATION",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}`,
      actorUserId: actor.id,
      familyId,
      request: input,
      resultSchema: JoinAuthorizationSchema,
      execute: async (transaction) => {
        await this.requireOwner(transaction, actor.id, familyId);
        const studentCount = await transaction.studentProfile.count({
          where: {
            familyId,
            userId: { in: input.linkedStudentIds },
            status: "ACTIVE",
            user: { status: "ACTIVE" },
          },
        });
        if (studentCount !== input.linkedStudentIds.length) {
          return resourceNotFound();
        }
        const authorization = await transaction.joinInvitationAuthorization.create({
          data: {
            familyId,
            authorizedByOwnerUserId: actor.id,
            linkedStudentIds: input.linkedStudentIds,
            expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1_000),
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "JOIN_INVITATION_AUTHORIZED",
            resourceType: "JoinInvitationAuthorization",
            resourceId: authorization.id,
            metadata: { linkedStudentIds: input.linkedStudentIds },
          },
        });
        return JoinAuthorizationSchema.parse({
          id: authorization.id,
          familyId,
          linkedStudentIds: input.linkedStudentIds,
          expiresAt: authorization.expiresAt.toISOString(),
        });
      },
    });
  }

  async createStudent(
    actor: CurrentUser,
    familyId: string,
    input: CreateStudentInput,
    idempotencyKey: string,
  ): Promise<StudentSummary> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.idempotency.run({
        kind: "CREATE_STUDENT",
        key: idempotencyKey,
        scope: `${actor.id}:${familyId}`,
        actorUserId: actor.id,
        familyId,
        request: { ...input, password: "[REDACTED]" },
        resultSchema: StudentSummarySchema,
        execute: async (transaction) => {
          await this.requireOwner(transaction, actor.id, familyId);
          const student = await transaction.user.create({
            data: {
              loginId: input.loginId,
              passwordHash,
              displayName: input.displayName,
              roles: ["STUDENT"],
              memberships: { create: { familyId, role: "STUDENT" } },
              studentProfile: {
                create: {
                  familyId,
                  grade: input.grade,
                  dailyMinutes: input.dailyMinutes,
                  ...(input.schoolName === undefined
                    ? {}
                    : { schoolName: input.schoolName }),
                  ...(input.cohortYear === undefined
                    ? {}
                    : { cohortYear: input.cohortYear }),
                },
              },
            },
            include: { studentProfile: true },
          });
          await transaction.guardianStudentRelation.create({
            data: {
              familyId,
              guardianUserId: actor.id,
              studentUserId: student.id,
            },
          });
          await transaction.auditEvent.create({
            data: {
              actorUserId: actor.id,
              familyId,
              action: "STUDENT_CREATED",
              resourceType: "User",
              resourceId: student.id,
              metadata: { grade: input.grade },
            },
          });
          return StudentSummarySchema.parse({
            userId: student.id,
            displayName: student.displayName,
            grade: student.studentProfile?.grade,
            dailyMinutes: student.studentProfile?.dailyMinutes,
            status: student.studentProfile?.status,
          });
        },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException();
      }
      throw error;
    }
  }

  async grantStudentConsent(
    actor: CurrentUser,
    familyId: string,
    studentUserId: string,
    input: GrantStudentConsentInput,
    idempotencyKey: string,
  ): Promise<StudentConsent> {
    return this.idempotency.run({
      kind: "GRANT_STUDENT_CONSENT",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}:${studentUserId}:${input.policyVersion}`,
      actorUserId: actor.id,
      familyId,
      request: input,
      resultSchema: StudentConsentSchema,
      execute: async (transaction) => {
        await this.requireGuardianStudentRelation(transaction, actor, familyId, studentUserId);
        const now = new Date();
        const consent = await transaction.consent.upsert({
          where: {
            guardianUserId_studentUserId_policyVersion: {
              guardianUserId: actor.id,
              studentUserId,
              policyVersion: input.policyVersion,
            },
          },
          create: {
            guardianUserId: actor.id,
            studentUserId,
            policyVersion: input.policyVersion,
            grantedAt: now,
          },
          update: { grantedAt: now, revokedAt: null },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "STUDENT_CONSENT_GRANTED",
            resourceType: "Consent",
            resourceId: consent.id,
            metadata: { policyVersion: input.policyVersion, studentUserId },
          },
        });
        return this.studentConsentResult(consent);
      },
    });
  }

  async revokeStudentConsent(
    actor: CurrentUser,
    familyId: string,
    studentUserId: string,
    input: RevokeStudentConsentInput,
    idempotencyKey: string,
  ): Promise<StudentConsent> {
    return this.idempotency.run({
      kind: "REVOKE_STUDENT_CONSENT",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}:${studentUserId}:${input.policyVersion}`,
      actorUserId: actor.id,
      familyId,
      request: input,
      resultSchema: StudentConsentSchema,
      execute: async (transaction) => {
        await this.requireGuardianStudentRelation(transaction, actor, familyId, studentUserId);
        const existing = await transaction.consent.findFirst({
          where: {
            guardianUserId: actor.id,
            studentUserId,
            policyVersion: input.policyVersion,
            revokedAt: null,
          },
        });
        if (existing === null) {
          return resourceNotFound();
        }
        const consent = await transaction.consent.update({
          where: { id: existing.id },
          data: { revokedAt: new Date() },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "STUDENT_CONSENT_REVOKED",
            resourceType: "Consent",
            resourceId: consent.id,
            metadata: { policyVersion: input.policyVersion, studentUserId },
          },
        });
        return this.studentConsentResult(consent);
      },
    });
  }

  async disableStudent(
    actor: CurrentUser,
    familyId: string,
    studentUserId: string,
    idempotencyKey: string,
  ): Promise<StudentSummary> {
    return this.idempotency.run({
      kind: "DISABLE_STUDENT",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}`,
      actorUserId: actor.id,
      familyId,
      request: { studentUserId },
      resultSchema: StudentSummarySchema,
      execute: async (transaction) => {
        await this.requireOwner(transaction, actor.id, familyId);
        const profile = await transaction.studentProfile.findFirst({
          where: { familyId, userId: studentUserId, status: "ACTIVE" },
          include: { user: true },
        });
        if (profile === null) {
          return resourceNotFound();
        }
        const now = new Date();
        await transaction.studentProfile.update({
          where: { userId: studentUserId },
          data: { status: "DISABLED" },
        });
        await transaction.user.update({
          where: { id: studentUserId },
          data: { status: "DISABLED" },
        });
        await transaction.session.updateMany({
          where: { userId: studentUserId, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.guardianStudentRelation.updateMany({
          where: { familyId, studentUserId, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "STUDENT_DISABLED",
            resourceType: "User",
            resourceId: studentUserId,
          },
        });
        return StudentSummarySchema.parse({
          userId: profile.userId,
          displayName: profile.user.displayName,
          grade: profile.grade,
          dailyMinutes: profile.dailyMinutes,
          status: "DISABLED",
        });
      },
    });
  }

  async grantRelation(
    actor: CurrentUser,
    familyId: string,
    input: GrantGuardianRelationInput,
    idempotencyKey: string,
  ): Promise<MutationResult> {
    return this.idempotency.run({
      kind: "GRANT_GUARDIAN_RELATION",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}`,
      actorUserId: actor.id,
      familyId,
      request: input,
      resultSchema: MutationResultSchema,
      execute: async (transaction) => {
        await this.requireOwner(transaction, actor.id, familyId);
        await this.requireGuardianMember(transaction, input.guardianUserId, familyId);
        await this.requireActiveStudent(transaction, input.studentUserId, familyId);
        const relation = await transaction.guardianStudentRelation.upsert({
          where: {
            familyId_guardianUserId_studentUserId: {
              familyId,
              guardianUserId: input.guardianUserId,
              studentUserId: input.studentUserId,
            },
          },
          create: { familyId, guardianUserId: input.guardianUserId, studentUserId: input.studentUserId },
          update: { revokedAt: null, grantedAt: new Date() },
        });
        await this.auditRelation(transaction, actor.id, familyId, "GUARDIAN_RELATION_GRANTED", relation.id, input);
        return { id: relation.id, status: "ACTIVE" };
      },
    });
  }

  async revokeRelation(
    actor: CurrentUser,
    familyId: string,
    input: RevokeGuardianRelationInput,
    idempotencyKey: string,
  ): Promise<MutationResult> {
    return this.idempotency.run({
      kind: "REVOKE_GUARDIAN_RELATION",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}`,
      actorUserId: actor.id,
      familyId,
      request: input,
      resultSchema: MutationResultSchema,
      execute: async (transaction) => {
        const membership = await this.requireGuardianMember(transaction, actor.id, familyId);
        if (membership.accessLevel !== "OWNER" && input.guardianUserId !== actor.id) {
          return resourceNotFound();
        }
        const relation = await transaction.guardianStudentRelation.findFirst({
          where: {
            familyId,
            guardianUserId: input.guardianUserId,
            studentUserId: input.studentUserId,
            revokedAt: null,
          },
        });
        if (relation === null) {
          return resourceNotFound();
        }
        await transaction.guardianStudentRelation.update({
          where: { id: relation.id },
          data: { revokedAt: new Date() },
        });
        await this.auditRelation(transaction, actor.id, familyId, "GUARDIAN_RELATION_REVOKED", relation.id, input);
        return { id: relation.id, status: "REVOKED" };
      },
    });
  }

  async removeMember(
    actor: CurrentUser,
    familyId: string,
    memberUserId: string,
    idempotencyKey: string,
  ): Promise<MutationResult> {
    return this.idempotency.run({
      kind: "REMOVE_FAMILY_MEMBER",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}`,
      actorUserId: actor.id,
      familyId,
      request: { memberUserId },
      resultSchema: MutationResultSchema,
      execute: async (transaction) => {
        await this.requireOwner(transaction, actor.id, familyId);
        const member = await this.requireGuardianMember(transaction, memberUserId, familyId);
        if (member.accessLevel !== "MEMBER") {
          return resourceNotFound();
        }
        const now = new Date();
        await transaction.familyMembership.update({
          where: { id: member.id },
          data: { revokedAt: now },
        });
        await transaction.guardianStudentRelation.updateMany({
          where: { familyId, guardianUserId: memberUserId, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "FAMILY_MEMBER_REMOVED",
            resourceType: "FamilyMembership",
            resourceId: member.id,
            metadata: { memberUserId },
          },
        });
        return { id: member.id, status: "REVOKED" };
      },
    });
  }

  async leave(
    actor: CurrentUser,
    familyId: string,
    idempotencyKey: string,
  ): Promise<MutationResult> {
    return this.idempotency.run({
      kind: "LEAVE_FAMILY",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}`,
      actorUserId: actor.id,
      familyId,
      request: { actorUserId: actor.id },
      resultSchema: MutationResultSchema,
      execute: async (transaction) => {
        const member = await this.requireGuardianMember(transaction, actor.id, familyId);
        if (member.accessLevel !== "MEMBER") {
          return resourceNotFound();
        }
        const now = new Date();
        await transaction.familyMembership.update({
          where: { id: member.id },
          data: { revokedAt: now },
        });
        await transaction.guardianStudentRelation.updateMany({
          where: { familyId, guardianUserId: actor.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "FAMILY_MEMBER_LEFT",
            resourceType: "FamilyMembership",
            resourceId: member.id,
          },
        });
        return { id: member.id, status: "REVOKED" };
      },
    });
  }

  async proposeOwnershipTransfer(
    actor: CurrentUser,
    familyId: string,
    input: ProposeOwnershipTransferInput,
    idempotencyKey: string,
  ): Promise<OwnershipTransfer> {
    return this.idempotency.run({
      kind: "PROPOSE_OWNERSHIP_TRANSFER",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}`,
      actorUserId: actor.id,
      familyId,
      request: input,
      resultSchema: OwnershipTransferSchema,
      execute: async (transaction) => {
        await this.requireOwner(transaction, actor.id, familyId);
        const target = await this.requireGuardianMember(transaction, input.targetUserId, familyId);
        if (target.accessLevel !== "MEMBER") {
          return resourceNotFound();
        }
        const transfer = await transaction.ownershipTransfer.create({
          data: {
            familyId,
            proposedByUserId: actor.id,
            targetUserId: input.targetUserId,
            expiresAt: new Date(Date.now() + transferLifetimeMilliseconds),
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "OWNERSHIP_TRANSFER_PROPOSED",
            resourceType: "OwnershipTransfer",
            resourceId: transfer.id,
            metadata: { targetUserId: input.targetUserId },
          },
        });
        return this.transferResult(transfer);
      },
    });
  }

  async acceptOwnershipTransfer(
    actor: CurrentUser,
    familyId: string,
    transferId: string,
    idempotencyKey: string,
  ): Promise<OwnershipTransfer> {
    return this.idempotency.run({
      kind: "ACCEPT_OWNERSHIP_TRANSFER",
      key: idempotencyKey,
      scope: `${actor.id}:${familyId}`,
      actorUserId: actor.id,
      familyId,
      request: { transferId },
      resultSchema: OwnershipTransferSchema,
      execute: async (transaction) => {
        const transfer = await transaction.ownershipTransfer.findFirst({
          where: {
            id: transferId,
            familyId,
            targetUserId: actor.id,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
        });
        if (transfer === null) {
          return resourceNotFound();
        }
        const owner = await this.requireOwner(transaction, transfer.proposedByUserId, familyId);
        const target = await this.requireGuardianMember(transaction, actor.id, familyId);
        if (target.accessLevel !== "MEMBER") {
          return resourceNotFound();
        }
        const oldOwner = await transaction.familyMembership.updateMany({
          where: { id: owner.id, accessLevel: "OWNER", revokedAt: null },
          data: { accessLevel: "MEMBER" },
        });
        const newOwner = await transaction.familyMembership.updateMany({
          where: { id: target.id, accessLevel: "MEMBER", revokedAt: null },
          data: { accessLevel: "OWNER" },
        });
        const accepted = await transaction.ownershipTransfer.updateMany({
          where: { id: transfer.id, status: "PENDING" },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
        if (oldOwner.count !== 1 || newOwner.count !== 1 || accepted.count !== 1) {
          throw new ConflictException();
        }
        const completed = await transaction.ownershipTransfer.findUniqueOrThrow({
          where: { id: transfer.id },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId,
            action: "OWNERSHIP_TRANSFER_ACCEPTED",
            resourceType: "OwnershipTransfer",
            resourceId: transfer.id,
            metadata: { previousOwnerUserId: transfer.proposedByUserId, newOwnerUserId: actor.id },
          },
        });
        return this.transferResult(completed);
      },
    });
  }

  private async allowedStudentIds(
    actorUserId: string,
    familyId: string,
    membership: { role: "STUDENT" | "GUARDIAN" | "ADMIN"; accessLevel: "OWNER" | "MEMBER" | null },
  ): Promise<string[]> {
    if (membership.role === "STUDENT") {
      return [actorUserId];
    }
    if (membership.role !== "GUARDIAN") {
      return [];
    }
    if (membership.accessLevel === "OWNER") {
      const profiles = await this.prisma.studentProfile.findMany({
        where: { familyId },
        select: { userId: true },
      });
      return profiles.map((profile) => profile.userId);
    }
    const relations = await this.prisma.guardianStudentRelation.findMany({
      where: { familyId, guardianUserId: actorUserId, revokedAt: null },
      select: { studentUserId: true },
    });
    return relations.map((relation) => relation.studentUserId);
  }

  private async requireOwner(
    transaction: Prisma.TransactionClient,
    userId: string,
    familyId: string,
  ): Promise<{ id: string; accessLevel: "OWNER" }> {
    const membership = await transaction.familyMembership.findFirst({
      where: {
        familyId,
        userId,
        role: "GUARDIAN",
        accessLevel: "OWNER",
        revokedAt: null,
        family: { status: "ACTIVE" },
        user: { status: "ACTIVE" },
      },
      select: { id: true, accessLevel: true },
    });
    if (membership?.accessLevel !== "OWNER") {
      return resourceNotFound();
    }
    return { id: membership.id, accessLevel: "OWNER" };
  }

  private async requireGuardianMember(
    transaction: Prisma.TransactionClient,
    userId: string,
    familyId: string,
  ): Promise<{ id: string; accessLevel: "OWNER" | "MEMBER" }>
  {
    const membership = await transaction.familyMembership.findFirst({
      where: {
        familyId,
        userId,
        role: "GUARDIAN",
        revokedAt: null,
        family: { status: "ACTIVE" },
        user: { status: "ACTIVE" },
      },
      select: { id: true, accessLevel: true },
    });
    if (membership?.accessLevel === null || membership === null) {
      return resourceNotFound();
    }
    return { id: membership.id, accessLevel: membership.accessLevel };
  }

  private async requireActiveStudent(
    transaction: Prisma.TransactionClient,
    userId: string,
    familyId: string,
  ): Promise<void> {
    const count = await transaction.studentProfile.count({
      where: { familyId, userId, status: "ACTIVE", user: { status: "ACTIVE" } },
    });
    if (count !== 1) {
      return resourceNotFound();
    }
  }

  private async requireGuardianStudentRelation(
    transaction: Prisma.TransactionClient,
    actor: CurrentUser,
    familyId: string,
    studentUserId: string,
  ): Promise<void> {
    if (!actor.roles.includes("GUARDIAN")) {
      return resourceNotFound();
    }
    await this.requireGuardianMember(transaction, actor.id, familyId);
    await this.requireActiveStudent(transaction, studentUserId, familyId);
    const relationCount = await transaction.guardianStudentRelation.count({
      where: {
        familyId,
        guardianUserId: actor.id,
        studentUserId,
        revokedAt: null,
      },
    });
    if (relationCount !== 1) {
      return resourceNotFound();
    }
  }

  private async auditRelation(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    familyId: string,
    action: string,
    resourceId: string,
    input: GrantGuardianRelationInput | RevokeGuardianRelationInput,
  ): Promise<void> {
    await transaction.auditEvent.create({
      data: {
        actorUserId,
        familyId,
        action,
        resourceType: "GuardianStudentRelation",
        resourceId,
        metadata: {
          guardianUserId: input.guardianUserId,
          studentUserId: input.studentUserId,
        },
      },
    });
  }

  private transferResult(transfer: {
    id: string;
    familyId: string;
    proposedByUserId: string;
    targetUserId: string;
    status: "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED";
    expiresAt: Date;
  }): OwnershipTransfer {
    return OwnershipTransferSchema.parse({
      id: transfer.id,
      familyId: transfer.familyId,
      proposedByUserId: transfer.proposedByUserId,
      targetUserId: transfer.targetUserId,
      status: transfer.status,
      expiresAt: transfer.expiresAt.toISOString(),
    });
  }

  private studentConsentResult(consent: {
    id: string;
    guardianUserId: string;
    studentUserId: string;
    policyVersion: string;
    grantedAt: Date;
    revokedAt: Date | null;
  }): StudentConsent {
    return StudentConsentSchema.parse({
      id: consent.id,
      guardianUserId: consent.guardianUserId,
      studentUserId: consent.studentUserId,
      policyVersion: consent.policyVersion,
      grantedAt: consent.grantedAt.toISOString(),
      revokedAt: consent.revokedAt?.toISOString() ?? null,
    });
  }
}
