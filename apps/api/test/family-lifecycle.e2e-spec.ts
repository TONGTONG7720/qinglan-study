import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  IssuedInvitationSchema,
  JoinAuthorizationSchema,
  OwnershipTransferSchema,
  RedeemedInvitationSchema,
  StudentSummarySchema,
} from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "phase3-e2e-";
const password = "fictional-password-123";
const JsonObjectSchema = z.record(z.string(), z.unknown());

describe("Phase 3 invitation and family lifecycle", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let baseUrl: string;
  let adminCookie: string;
  let adminProof: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.INVITATION_TOKEN_SECRET = "phase3-test-invitation-secret-32-characters";
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();

    const passwordHash = await new PasswordService().hash(password);
    await prisma.user.create({
      data: {
        loginId: `${loginPrefix}admin@example.test`,
        passwordHash,
        displayName: "Phase 3 管理员",
        roles: ["ADMIN"],
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, readAppConfig({ NODE_ENV: "test" }));
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
    adminCookie = await login(`${loginPrefix}admin@example.test`);
    adminProof = await reauthenticate(adminCookie);
  });

  afterAll(async () => {
    await app?.close();
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it("runs NEW_FAMILY -> student -> JOIN_FAMILY -> revocation -> atomic transfer", async () => {
    const newFamilyRequest = {
      mode: "NEW_FAMILY",
      expiresInHours: 24,
      confirmation: "ISSUE_INVITATION",
    } as const;
    const issuedResponse = await authenticatedPost(
      "/v1/invitations",
      adminCookie,
      adminProof,
      "phase3-issue-new-0001",
      newFamilyRequest,
    );
    expect(issuedResponse.status).toBe(201);
    const issued = IssuedInvitationSchema.parse(await issuedResponse.json());

    const repeatedIssue = await authenticatedPost(
      "/v1/invitations",
      adminCookie,
      adminProof,
      "phase3-issue-new-0001",
      newFamilyRequest,
    );
    expect(repeatedIssue.status).toBe(201);
    expect(IssuedInvitationSchema.parse(await repeatedIssue.json())).toEqual(issued);

    const storedInvitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: issued.invitation.id },
    });
    expect(storedInvitation.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(storedInvitation.tokenHash).not.toBe(issued.token);
    const issueOperation = await prisma.operation.findFirstOrThrow({
      where: { kind: "ISSUE_INVITATION" },
      orderBy: { createdAt: "asc" },
    });
    expect(JSON.stringify(issueOperation.payload)).not.toContain(issued.token);

    const validation = await postJson("/v1/invitations/validate", { token: issued.token });
    expect(validation.status).toBe(200);
    const validationBody = JsonObjectSchema.parse(await validation.json());
    expect(validationBody.mode).toBe("NEW_FAMILY");
    expect(validationBody).not.toHaveProperty("familyId");

    const redemptionBody = {
      token: issued.token,
      mode: "NEW_FAMILY",
      loginId: `${loginPrefix}owner@example.test`,
      password,
      displayName: "Phase 3 家庭所有者",
      familyName: "Phase 3 Lifecycle Family",
      idempotencyKey: "phase3-redeem-new-0001",
      confirmation: "CREATE_FAMILY",
    } as const;
    const redemption = await postJson("/v1/invitations/redeem", redemptionBody);
    expect(redemption.status).toBe(201);
    const ownerResult = RedeemedInvitationSchema.parse(await redemption.json());
    expect(ownerResult.accessLevel).toBe("OWNER");

    const replay = await postJson("/v1/invitations/redeem", {
      ...redemptionBody,
      loginId: `${loginPrefix}replay@example.test`,
      idempotencyKey: "phase3-redeem-new-0002",
    });
    expect(replay.status).toBe(409);

    const ownerCookie = await login(redemptionBody.loginId);
    const ownerProof = await reauthenticate(ownerCookie);
    const createStudentBody = {
      loginId: `${loginPrefix}student@example.test`,
      password,
      displayName: "Phase 3 测试学生",
      grade: 8,
      dailyMinutes: 40,
      confirmation: "CREATE_STUDENT",
    } as const;
    const studentResponse = await authenticatedPost(
      `/v1/families/${ownerResult.familyId}/students`,
      ownerCookie,
      ownerProof,
      "phase3-create-student-0001",
      createStudentBody,
    );
    expect(studentResponse.status).toBe(201);
    const student = StudentSummarySchema.parse(await studentResponse.json());

    const repeatedStudent = await authenticatedPost(
      `/v1/families/${ownerResult.familyId}/students`,
      ownerCookie,
      ownerProof,
      "phase3-create-student-0001",
      createStudentBody,
    );
    expect(repeatedStudent.status).toBe(201);
    expect(StudentSummarySchema.parse(await repeatedStudent.json()).userId).toBe(student.userId);
    expect(await prisma.user.count({ where: { loginId: createStudentBody.loginId } })).toBe(1);

    const authorizationResponse = await authenticatedPost(
      `/v1/families/${ownerResult.familyId}/join-authorizations`,
      ownerCookie,
      ownerProof,
      "phase3-authorize-join-0001",
      {
        linkedStudentIds: [student.userId],
        expiresInHours: 24,
        confirmation: "AUTHORIZE_JOIN",
      },
    );
    expect(authorizationResponse.status).toBe(201);
    const authorization = JoinAuthorizationSchema.parse(await authorizationResponse.json());

    const joinIssue = await authenticatedPost(
      "/v1/invitations",
      adminCookie,
      adminProof,
      "phase3-issue-join-0001",
      {
        mode: "JOIN_FAMILY",
        authorizationId: authorization.id,
        expiresInHours: 24,
        confirmation: "ISSUE_INVITATION",
      },
    );
    expect(joinIssue.status).toBe(201);
    const joinInvitation = IssuedInvitationSchema.parse(await joinIssue.json());

    const joinRedemption = await postJson("/v1/invitations/redeem", {
      token: joinInvitation.token,
      mode: "JOIN_FAMILY",
      loginId: `${loginPrefix}member@example.test`,
      password,
      displayName: "Phase 3 家庭成员",
      idempotencyKey: "phase3-redeem-join-0001",
      confirmation: "JOIN_FAMILY",
    });
    expect(joinRedemption.status).toBe(201);
    const memberResult = RedeemedInvitationSchema.parse(await joinRedemption.json());
    expect(memberResult.linkedStudentIds).toEqual([student.userId]);

    const memberCookie = await login(`${loginPrefix}member@example.test`);
    const memberProof = await reauthenticate(memberCookie);
    const memberFamily = await fetch(new URL(`/v1/families/${ownerResult.familyId}`, baseUrl), {
      headers: { cookie: memberCookie },
    });
    expect(memberFamily.status).toBe(200);
    expect(JsonObjectSchema.parse(await memberFamily.json()).students).toMatchObject([
      { userId: student.userId },
    ]);

    const memberManagement = await authenticatedPost(
      `/v1/families/${ownerResult.familyId}/students`,
      memberCookie,
      memberProof,
      "phase3-member-denied-0001",
      { ...createStudentBody, loginId: `${loginPrefix}forbidden@example.test` },
    );
    expect(memberManagement.status).toBe(404);

    const revokeRelation = await authenticatedPost(
      `/v1/families/${ownerResult.familyId}/relations/revoke`,
      ownerCookie,
      ownerProof,
      "phase3-revoke-link-0001",
      {
        guardianUserId: memberResult.userId,
        studentUserId: student.userId,
        confirmation: "REVOKE_RELATION",
      },
    );
    expect(revokeRelation.status).toBe(201);
    const familyAfterRevocation = await fetch(
      new URL(`/v1/families/${ownerResult.familyId}`, baseUrl),
      { headers: { cookie: memberCookie } },
    );
    expect(JsonObjectSchema.parse(await familyAfterRevocation.json()).students).toEqual([]);

    const proposalResponse = await authenticatedPost(
      `/v1/families/${ownerResult.familyId}/ownership-transfers`,
      ownerCookie,
      ownerProof,
      "phase3-propose-transfer-0001",
      {
        targetUserId: memberResult.userId,
        confirmation: "PROPOSE_OWNERSHIP_TRANSFER",
      },
    );
    expect(proposalResponse.status).toBe(201);
    const transfer = OwnershipTransferSchema.parse(await proposalResponse.json());

    const acceptPath = `/v1/families/${ownerResult.familyId}/ownership-transfers/${transfer.id}/accept`;
    const acceptanceBody = { confirmation: "ACCEPT_OWNERSHIP_TRANSFER" };
    const acceptanceResponses = await Promise.all([
      authenticatedPost(acceptPath, memberCookie, memberProof, "phase3-accept-transfer-0001", acceptanceBody),
      authenticatedPost(acceptPath, memberCookie, memberProof, "phase3-accept-transfer-0002", acceptanceBody),
    ]);
    expect(acceptanceResponses.map((response) => response.status).sort()).toEqual([200, 404]);

    const owners = await prisma.familyMembership.findMany({
      where: { familyId: ownerResult.familyId, accessLevel: "OWNER", revokedAt: null },
      select: { userId: true },
    });
    expect(owners).toEqual([{ userId: memberResult.userId }]);

    const formerOwnerManagement = await authenticatedPost(
      `/v1/families/${ownerResult.familyId}/students`,
      ownerCookie,
      ownerProof,
      "phase3-former-owner-denied-0001",
      { ...createStudentBody, loginId: `${loginPrefix}former-owner-denied@example.test` },
    );
    expect(formerOwnerManagement.status).toBe(404);

    const auditActions = await prisma.auditEvent.findMany({
      where: { familyId: ownerResult.familyId },
      select: { action: true },
    });
    expect(auditActions.map((event) => event.action)).toEqual(expect.arrayContaining([
      "FAMILY_CREATED",
      "STUDENT_CREATED",
      "JOIN_INVITATION_AUTHORIZED",
      "GUARDIAN_RELATION_REVOKED",
      "OWNERSHIP_TRANSFER_PROPOSED",
      "OWNERSHIP_TRANSFER_ACCEPTED",
    ]));
  }, 30_000);

  it("allows only one concurrent redemption of a one-time invitation", async () => {
    const issuedResponse = await authenticatedPost(
      "/v1/invitations",
      adminCookie,
      adminProof,
      "phase3-issue-race-0001",
      {
        mode: "NEW_FAMILY",
        expiresInHours: 24,
        confirmation: "ISSUE_INVITATION",
      },
    );
    const issued = IssuedInvitationSchema.parse(await issuedResponse.json());
    const common = {
      token: issued.token,
      mode: "NEW_FAMILY",
      password,
      displayName: "并发兑换家长",
      familyName: "Phase 3 Concurrent Redemption Family",
      confirmation: "CREATE_FAMILY",
    } as const;
    const responses = await Promise.all([
      postJson("/v1/invitations/redeem", {
        ...common,
        loginId: `${loginPrefix}race-a@example.test`,
        idempotencyKey: "phase3-redeem-race-0001",
      }),
      postJson("/v1/invitations/redeem", {
        ...common,
        loginId: `${loginPrefix}race-b@example.test`,
        idempotencyKey: "phase3-redeem-race-0002",
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.count({
      where: { loginId: { in: [`${loginPrefix}race-a@example.test`, `${loginPrefix}race-b@example.test`] } },
    })).toBe(1);
    const family = await prisma.family.findFirstOrThrow({
      where: { name: "Phase 3 Concurrent Redemption Family" },
    });
    expect(await prisma.familyMembership.count({
      where: { familyId: family.id, accessLevel: "OWNER", revokedAt: null },
    })).toBe(1);
  }, 30_000);

  async function login(loginId: string): Promise<string> {
    const response = await postJson("/v1/auth/login", { loginId, password });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    const cookie = setCookie?.split(";", 1)[0];
    if (cookie === undefined) {
      throw new Error("Login did not return a session cookie");
    }
    return cookie;
  }

  async function reauthenticate(cookie: string): Promise<string> {
    const response = await fetch(new URL("/v1/auth/reauthenticate", baseUrl), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    expect(response.status).toBe(200);
    const body = z.object({ proof: z.string(), expiresAt: z.iso.datetime() }).strict()
      .parse(await response.json());
    return body.proof;
  }

  async function authenticatedPost(
    path: string,
    cookie: string,
    proof: string,
    idempotencyKey: string,
    body: unknown,
  ): Promise<Response> {
    return fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-reauth-proof": proof,
      },
      body: JSON.stringify(body),
    });
  }

  async function postJson(path: string, body: unknown): Promise<Response> {
    return fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { loginId: { startsWith: loginPrefix } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    const families = await prisma.family.findMany({
      where: { name: { startsWith: "Phase 3" } },
      select: { id: true },
    });
    const familyIds = families.map((family) => family.id);
    await prisma.auditEvent.deleteMany({
      where: { OR: [
        { familyId: { in: familyIds } },
        { actorUserId: { in: userIds } },
      ] },
    });

    if (userIds.length > 0) {
      await prisma.invitation.deleteMany({ where: { createdByUserId: { in: userIds } } });
    }
    await prisma.family.deleteMany({
      where: { name: { startsWith: "Phase 3" } },
    });
    await prisma.operation.deleteMany({
      where: {
        kind: { in: [
          "ISSUE_INVITATION",
          "REDEEM_INVITATION",
          "AUTHORIZE_JOIN_INVITATION",
          "CREATE_STUDENT",
          "REVOKE_GUARDIAN_RELATION",
          "PROPOSE_OWNERSHIP_TRANSFER",
          "ACCEPT_OWNERSHIP_TRANSFER",
        ] },
      },
    });
    await prisma.user.deleteMany({ where: { loginId: { startsWith: loginPrefix } } });
  }
});
