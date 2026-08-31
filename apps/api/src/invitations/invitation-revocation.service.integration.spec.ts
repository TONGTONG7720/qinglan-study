import type { CurrentUser } from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PasswordService } from "../auth/password.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { InvitationService } from "./invitation.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "phase3-invitation-revoke-";

describe("Phase 3 invitation revocation", () => {
  let prisma: PrismaService;
  let service: InvitationService;
  let admin: CurrentUser;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.INVITATION_TOKEN_SECRET = "phase3-test-invitation-secret-32-characters";
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    const user = await prisma.user.create({
      data: {
        loginId: `${loginPrefix}admin@example.test`,
        passwordHash: "$argon2id$fictional",
        displayName: "邀请撤销管理员",
        roles: ["ADMIN"],
      },
    });
    admin = { id: user.id, displayName: user.displayName, roles: ["ADMIN"], activeFamilyId: null };
    service = new InvitationService(
      prisma,
      new PasswordService(),
      new IdempotencyService(prisma),
    );
  });

  afterAll(async () => {
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it("makes a revoked invitation immediately invalid and unredeemable", async () => {
    const issued = await service.issue(admin, {
      mode: "NEW_FAMILY",
      expiresInHours: 24,
      confirmation: "ISSUE_INVITATION",
    }, "phase3-revoke-issue-0001");
    await expect(service.validate(issued.token)).resolves.toMatchObject({ valid: true });

    await expect(service.revoke(
      admin,
      issued.invitation.id,
      "phase3-revoke-action-0001",
    )).resolves.toEqual({ id: issued.invitation.id, revoked: true });
    await expect(service.validate(issued.token)).rejects.toThrow();
    await expect(service.redeem({
      token: issued.token,
      mode: "NEW_FAMILY",
      loginId: `${loginPrefix}guardian@example.test`,
      password: "fictional-password-123",
      displayName: "不可兑换监护人",
      familyName: "不可创建家庭",
      idempotencyKey: "phase3-revoke-redeem-0001",
      confirmation: "CREATE_FAMILY",
    })).rejects.toThrow();
    expect(await prisma.user.count({
      where: { loginId: `${loginPrefix}guardian@example.test` },
    })).toBe(0);
    expect(await prisma.auditEvent.count({
      where: { action: "INVITATION_REVOKED", resourceId: issued.invitation.id },
    })).toBe(1);
  });

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { loginId: { startsWith: loginPrefix } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    if (userIds.length > 0) {
      await prisma.invitation.deleteMany({ where: { createdByUserId: { in: userIds } } });
    }
    await prisma.operation.deleteMany({
      where: { kind: { in: ["ISSUE_INVITATION", "REVOKE_INVITATION", "REDEEM_INVITATION"] } },
    });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });
  }
});
