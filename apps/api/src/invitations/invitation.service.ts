import { createHash, createHmac } from "node:crypto";

import type {
  CurrentUser,
  IssueInvitationInput,
  IssuedInvitation,
  RedeemedInvitation,
  RedeemInvitationInput,
} from "@study/contracts";
import {
  IssuedInvitationSchema,
  InvitationSummarySchema,
  RedeemedInvitationSchema,
} from "@study/contracts";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { Prisma } from "../generated/prisma/client.js";
import { PasswordService } from "../auth/password.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";

const LinkedStudentIdsSchema = z.array(z.uuid()).min(1).max(30);
const RevocationResultSchema = z.object({ id: z.uuid(), revoked: z.literal(true) }).strict();
const ValidationResultSchema = z.object({
  valid: z.literal(true),
  mode: z.enum(["NEW_FAMILY", "JOIN_FAMILY"]),
  expiresAt: z.iso.datetime(),
}).strict();
const StoredIssuedInvitationSchema = z.object({
  invitation: InvitationSummarySchema,
  tokenHash: z.string().regex(/^[0-9a-f]{64}$/u),
}).strict();

export type InvitationValidation = z.infer<typeof ValidationResultSchema>;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function invitationTokenSecret(): string {
  const configured = process.env.INVITATION_TOKEN_SECRET;
  if (configured !== undefined && configured.length >= 32) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("INVITATION_TOKEN_SECRET must contain at least 32 characters in production");
  }
  return "development-only-invitation-secret-change-me";
}

function issueToken(context: string): { rawToken: string; tokenHash: string } {
  const rawToken = createHmac("sha256", invitationTokenSecret()).update(context, "utf8").digest("base64url");
  return { rawToken, tokenHash: hashToken(rawToken) };
}

function requireAdmin(actor: CurrentUser): void {
  if (!actor.roles.includes("ADMIN")) {
    throw new NotFoundException();
  }
}

function expiresAt(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1_000);
}

function invitationUnavailable(): never {
  throw new ConflictException();
}

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async issue(
    actor: CurrentUser,
    input: IssueInvitationInput,
    idempotencyKey: string,
  ): Promise<IssuedInvitation> {
    requireAdmin(actor);
    const token = issueToken(`${actor.id}\u0000${idempotencyKey}\u0000${JSON.stringify(input)}`);
    return this.idempotency.run({
      kind: "ISSUE_INVITATION",
      key: idempotencyKey,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: input,
      resultSchema: IssuedInvitationSchema,
      serializeResult: (result) => ({
        invitation: result.invitation,
        tokenHash: hashToken(result.token),
      }),
      restoreResult: (storedResult) => {
        const stored = StoredIssuedInvitationSchema.parse(storedResult);
        if (stored.tokenHash !== token.tokenHash) {
          throw new ConflictException();
        }
        return IssuedInvitationSchema.parse({ invitation: stored.invitation, token: token.rawToken });
      },
      execute: async (transaction) => input.mode === "NEW_FAMILY"
        ? this.issueNewFamily(transaction, actor, input.expiresInHours, token)
        : this.issueJoinFamily(
          transaction,
          actor,
          input.authorizationId,
          input.expiresInHours,
          token,
        ),
    });
  }

  async revoke(
    actor: CurrentUser,
    invitationId: string,
    idempotencyKey: string,
  ): Promise<{ id: string; revoked: true }> {
    requireAdmin(actor);
    return this.idempotency.run({
      kind: "REVOKE_INVITATION",
      key: idempotencyKey,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { invitationId },
      resultSchema: RevocationResultSchema,
      execute: async (transaction) => {
        const invitation = await transaction.invitation.findUnique({
          where: { id: invitationId },
          select: { id: true, familyId: true, usedAt: true, revokedAt: true },
        });
        if (invitation?.usedAt !== null || invitation.revokedAt !== null) {
          throw new NotFoundException();
        }
        const revoked = await transaction.invitation.updateMany({
          where: { id: invitationId, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (revoked.count !== 1) {
          throw new ConflictException();
        }
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: invitation.familyId,
            action: "INVITATION_REVOKED",
            resourceType: "Invitation",
            resourceId: invitation.id,
          },
        });
        return { id: invitation.id, revoked: true };
      },
    });
  }

  async validate(rawToken: string): Promise<InvitationValidation> {
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        tokenHash: hashToken(rawToken),
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { mode: true, expiresAt: true },
    });
    if (invitation === null) {
      throw new NotFoundException();
    }
    return ValidationResultSchema.parse({
      valid: true,
      mode: invitation.mode,
      expiresAt: invitation.expiresAt.toISOString(),
    });
  }

  async redeem(input: RedeemInvitationInput): Promise<RedeemedInvitation> {
    const tokenHash = hashToken(input.token);
    const passwordHash = await this.passwords.hash(input.password);
    const request = { ...input, token: tokenHash, password: "[REDACTED]" };

    return this.idempotency.run({
      kind: "REDEEM_INVITATION",
      key: input.idempotencyKey,
      scope: tokenHash,
      actorUserId: null,
      familyId: null,
      request,
      resultSchema: RedeemedInvitationSchema,
      execute: async (transaction) => {
        const invitation = await transaction.invitation.findUnique({
          where: { tokenHash },
        });
        if (
          invitation?.mode !== input.mode
          || invitation.usedAt !== null
          || invitation.revokedAt !== null
          || invitation.expiresAt.getTime() <= Date.now()
        ) {
          return invitationUnavailable();
        }
        const claimed = await transaction.invitation.updateMany({
          where: {
            id: invitation.id,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });
        if (claimed.count !== 1) {
          return invitationUnavailable();
        }

        return input.mode === "NEW_FAMILY"
          ? this.redeemNewFamily(transaction, invitation.id, passwordHash, input)
          : this.redeemJoinFamily(transaction, invitation, passwordHash, input);
      },
    });
  }

  private async issueNewFamily(
    transaction: Prisma.TransactionClient,
    actor: CurrentUser,
    lifetimeHours: number,
    token: { rawToken: string; tokenHash: string },
  ): Promise<IssuedInvitation> {
    const invitation = await transaction.invitation.create({
      data: {
        tokenHash: token.tokenHash,
        mode: "NEW_FAMILY",
        createdByUserId: actor.id,
        expiresAt: expiresAt(lifetimeHours),
      },
    });
    await transaction.auditEvent.create({
      data: {
        actorUserId: actor.id,
        action: "INVITATION_ISSUED",
        resourceType: "Invitation",
        resourceId: invitation.id,
        metadata: { mode: invitation.mode },
      },
    });
    return IssuedInvitationSchema.parse({
      invitation: {
        id: invitation.id,
        mode: invitation.mode,
        familyId: null,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      token: token.rawToken,
    });
  }

  private async issueJoinFamily(
    transaction: Prisma.TransactionClient,
    actor: CurrentUser,
    authorizationId: string,
    lifetimeHours: number,
    token: { rawToken: string; tokenHash: string },
  ): Promise<IssuedInvitation> {
    const authorization = await transaction.joinInvitationAuthorization.findUnique({
      where: { id: authorizationId },
    });
    if (
      authorization?.usedAt !== null
      || authorization.revokedAt !== null
      || authorization.expiresAt.getTime() <= Date.now()
    ) {
      return invitationUnavailable();
    }
    const ownerCount = await transaction.familyMembership.count({
      where: {
        familyId: authorization.familyId,
        userId: authorization.authorizedByOwnerUserId,
        role: "GUARDIAN",
        accessLevel: "OWNER",
        revokedAt: null,
        family: { status: "ACTIVE" },
      },
    });
    if (ownerCount !== 1) {
      return invitationUnavailable();
    }
    const linkedStudentIds = LinkedStudentIdsSchema.parse(authorization.linkedStudentIds);
    const activeStudentCount = await transaction.studentProfile.count({
      where: {
        familyId: authorization.familyId,
        userId: { in: linkedStudentIds },
        status: "ACTIVE",
        user: { status: "ACTIVE" },
      },
    });
    if (activeStudentCount !== linkedStudentIds.length) {
      return invitationUnavailable();
    }
    const consumed = await transaction.joinInvitationAuthorization.updateMany({
      where: { id: authorization.id, usedAt: null, revokedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      return invitationUnavailable();
    }

    const requestedExpiry = expiresAt(lifetimeHours);
    const invitation = await transaction.invitation.create({
      data: {
        tokenHash: token.tokenHash,
        mode: "JOIN_FAMILY",
        familyId: authorization.familyId,
        createdByUserId: actor.id,
        ownerAuthorizationId: authorization.id,
        linkedStudentIds,
        expiresAt: requestedExpiry < authorization.expiresAt
          ? requestedExpiry
          : authorization.expiresAt,
      },
    });
    await transaction.auditEvent.create({
      data: {
        actorUserId: actor.id,
        familyId: invitation.familyId,
        action: "INVITATION_ISSUED",
        resourceType: "Invitation",
        resourceId: invitation.id,
        metadata: {
          mode: invitation.mode,
          authorizationId: authorization.id,
          authorizedByOwnerUserId: authorization.authorizedByOwnerUserId,
          linkedStudentIds,
        },
      },
    });
    return IssuedInvitationSchema.parse({
      invitation: {
        id: invitation.id,
        mode: invitation.mode,
        familyId: invitation.familyId,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      token: token.rawToken,
    });
  }

  private async redeemNewFamily(
    transaction: Prisma.TransactionClient,
    invitationId: string,
    passwordHash: string,
    input: Extract<RedeemInvitationInput, { mode: "NEW_FAMILY" }>,
  ): Promise<RedeemedInvitation> {
    const guardian = await transaction.user.create({
      data: {
        loginId: input.loginId,
        passwordHash,
        displayName: input.displayName,
        roles: ["GUARDIAN"],
      },
    });
    const family = await transaction.family.create({
      data: {
        name: input.familyName,
        memberships: {
          create: {
            userId: guardian.id,
            role: "GUARDIAN",
            accessLevel: "OWNER",
          },
        },
      },
    });
    await transaction.auditEvent.createMany({
      data: [
        {
          actorUserId: guardian.id,
          familyId: family.id,
          action: "INVITATION_REDEEMED",
          resourceType: "Invitation",
          resourceId: invitationId,
          metadata: { mode: "NEW_FAMILY" },
        },
        {
          actorUserId: guardian.id,
          familyId: family.id,
          action: "FAMILY_CREATED",
          resourceType: "Family",
          resourceId: family.id,
        },
      ],
    });
    return RedeemedInvitationSchema.parse({
      userId: guardian.id,
      familyId: family.id,
      accessLevel: "OWNER",
      linkedStudentIds: [],
    });
  }

  private async redeemJoinFamily(
    transaction: Prisma.TransactionClient,
    invitation: { id: string; familyId: string | null; linkedStudentIds: Prisma.JsonValue | null },
    passwordHash: string,
    input: Extract<RedeemInvitationInput, { mode: "JOIN_FAMILY" }>,
  ): Promise<RedeemedInvitation> {
    if (invitation.familyId === null || invitation.linkedStudentIds === null) {
      return invitationUnavailable();
    }
    const linkedStudentIds = LinkedStudentIdsSchema.parse(invitation.linkedStudentIds);
    const family = await transaction.family.findFirst({
      where: { id: invitation.familyId, status: "ACTIVE" },
      select: { id: true },
    });
    const activeStudentCount = await transaction.studentProfile.count({
      where: {
        familyId: invitation.familyId,
        userId: { in: linkedStudentIds },
        status: "ACTIVE",
        user: { status: "ACTIVE" },
      },
    });
    if (family === null || activeStudentCount !== linkedStudentIds.length) {
      return invitationUnavailable();
    }

    const guardian = await transaction.user.create({
      data: {
        loginId: input.loginId,
        passwordHash,
        displayName: input.displayName,
        roles: ["GUARDIAN"],
        memberships: {
          create: {
            familyId: family.id,
            role: "GUARDIAN",
            accessLevel: "MEMBER",
          },
        },
      },
    });
    await transaction.guardianStudentRelation.createMany({
      data: linkedStudentIds.map((studentUserId) => ({
        familyId: family.id,
        guardianUserId: guardian.id,
        studentUserId,
      })),
    });
    await transaction.auditEvent.create({
      data: {
        actorUserId: guardian.id,
        familyId: family.id,
        action: "INVITATION_REDEEMED",
        resourceType: "Invitation",
        resourceId: invitation.id,
        metadata: { mode: "JOIN_FAMILY", linkedStudentIds },
      },
    });
    return RedeemedInvitationSchema.parse({
      userId: guardian.id,
      familyId: family.id,
      accessLevel: "MEMBER",
      linkedStudentIds,
    });
  }
}
