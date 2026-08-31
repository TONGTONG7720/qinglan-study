import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  StudentTextbookContextResponseSchema,
  SubjectAvailabilityResponseSchema,
  TextbookSummarySchema,
} from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "phase4-e2e-";
const password = "fictional-password-123";

describe("Phase 4 curriculum and textbook context", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let baseUrl: string;
  let adminCookie: string;
  let adminProof: string;
  let ownerCookie: string;
  let ownerProof: string;
  let studentCookie: string;
  let studentProof: string;
  let outsiderCookie: string;
  let studentUserId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    const passwordHash = await new PasswordService().hash(password);

    const fixture = await prisma.$transaction(async (transaction) => {
      const admin = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}admin@example.test`, passwordHash,
          displayName: "Phase 4 管理员", roles: ["ADMIN"],
        },
      });
      const owner = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}owner@example.test`, passwordHash,
          displayName: "Phase 4 家长", roles: ["GUARDIAN"],
        },
      });
      const student = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}student@example.test`, passwordHash,
          displayName: "Phase 4 学生", roles: ["STUDENT"],
        },
      });
      const outsider = await transaction.user.create({
        data: {
          loginId: `${loginPrefix}outsider@example.test`, passwordHash,
          displayName: "Phase 4 外部家长", roles: ["GUARDIAN"],
        },
      });
      const family = await transaction.family.create({
        data: {
          name: "Phase 4 Curriculum Family",
          memberships: { create: [
            { userId: owner.id, role: "GUARDIAN", accessLevel: "OWNER" },
            { userId: student.id, role: "STUDENT" },
          ] },
          studentProfiles: { create: { userId: student.id, grade: 8, dailyMinutes: 40 } },
          guardianLinks: { create: { guardianUserId: owner.id, studentUserId: student.id } },
        },
      });
      await transaction.family.create({
        data: {
          name: "Phase 4 Outsider Family",
          memberships: { create: {
            userId: outsider.id, role: "GUARDIAN", accessLevel: "OWNER",
          } },
        },
      });
      return { admin, owner, student, outsider, family };
    });
    studentUserId = fixture.student.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, readAppConfig({ NODE_ENV: "test" }));
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();

    adminCookie = await login(`${loginPrefix}admin@example.test`);
    adminProof = await reauthenticate(adminCookie);
    ownerCookie = await login(`${loginPrefix}owner@example.test`);
    ownerProof = await reauthenticate(ownerCookie);
    studentCookie = await login(`${loginPrefix}student@example.test`);
    studentProof = await reauthenticate(studentCookie);
    outsiderCookie = await login(`${loginPrefix}outsider@example.test`);
  });

  afterAll(async () => {
    await app?.close();
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it("enforces matrix, verification roles and deterministic generic fallback", async () => {
    const grade7 = await fetch(new URL("/v1/curriculum/availability/7", baseUrl));
    expect(SubjectAvailabilityResponseSchema.parse(await grade7.json()).subjects)
      .not.toContain("PHYSICS");
    const grade9 = await fetch(new URL("/v1/curriculum/availability/9", baseUrl));
    expect(SubjectAvailabilityResponseSchema.parse(await grade9.json()).subjects)
      .toContain("CHEMISTRY");

    const invalidTextbook = await writePost(
      "/v1/curriculum/textbooks", adminCookie, adminProof, "phase4-invalid-matrix-0001",
      textbookDraft("PHYSICS", 7, "Phase 4 Invalid Publisher"),
    );
    expect(invalidTextbook.status).toBe(404);

    const draftResponse = await writePost(
      "/v1/curriculum/textbooks", adminCookie, adminProof, "phase4-create-textbook-0001",
      textbookDraft("MATH", 8, "Phase 4 Fictional Publisher"),
    );
    expect(draftResponse.status).toBe(201);
    const draft = TextbookSummarySchema.parse(await draftResponse.json());
    expect(draft.status).toBe("DRAFT");
    const unit = await prisma.unit.findFirstOrThrow({
      where: { textbookEditionId: draft.id, ordinal: 1 },
    });

    const guardianConfirm = await writePost(
      `/v1/curriculum/textbooks/${draft.id}/confirm`,
      ownerCookie, ownerProof, "phase4-guardian-confirm-denied-0001",
      { sourceReference: "虚构 ISBN 与目录核验记录", confirmation: "CONFIRM_TEXTBOOK" },
    );
    expect(guardianConfirm.status).toBe(404);

    const submitted = await writePost(
      `/v1/students/${studentUserId}/textbook-contexts/MATH/submit`,
      ownerCookie, ownerProof, "phase4-submit-context-0001",
      {
        reportedPublisher: "家长提交待核验出版社",
        reportedEdition: "家长提交待核验版次",
        reportedVolume: "八年级上册",
        reportedDirectory: ["第一章", "第二章"],
        confirmation: "SUBMIT_TEXTBOOK_INFORMATION",
      },
    );
    expect(submitted.status).toBe(201);
    const generic = StudentTextbookContextResponseSchema.parse(await submitted.json());
    expect(generic).toEqual({
      mode: "GENERIC_GUIDANCE",
      studentUserId,
      subjectCode: "MATH",
      grade: 8,
      hasPendingSubmission: true,
    });
    expect(JSON.stringify(generic)).not.toContain("出版社");
    expect(JSON.stringify(generic)).not.toContain("版次");

    const studentRead = await readContext(studentCookie, studentUserId, "MATH");
    expect(studentRead.mode).toBe("GENERIC_GUIDANCE");
    const crossFamily = await fetch(
      new URL(`/v1/students/${studentUserId}/textbook-contexts/MATH`, baseUrl),
      { headers: { cookie: outsiderCookie } },
    );
    expect(crossFamily.status).toBe(404);

    const confirmedTextbookResponse = await writePost(
      `/v1/curriculum/textbooks/${draft.id}/confirm`,
      adminCookie, adminProof, "phase4-confirm-textbook-0001",
      { sourceReference: "虚构 ISBN 000-0-00-000000-0 与目录核验记录", confirmation: "CONFIRM_TEXTBOOK" },
    );
    expect(confirmedTextbookResponse.status).toBe(201);
    expect(TextbookSummarySchema.parse(await confirmedTextbookResponse.json()).status)
      .toBe("CONFIRMED");

    const alignedResponse = await writePost(
      `/v1/students/${studentUserId}/textbook-contexts/MATH/confirm`,
      adminCookie, adminProof, "phase4-confirm-context-0001",
      { textbookEditionId: draft.id, confirmation: "CONFIRM_STUDENT_TEXTBOOK" },
    );
    expect(alignedResponse.status).toBe(201);
    const aligned = StudentTextbookContextResponseSchema.parse(await alignedResponse.json());
    expect(aligned.mode).toBe("TEXTBOOK_ALIGNED");

    const progressedResponse = await writePost(
      `/v1/students/${studentUserId}/textbook-contexts/MATH/current-unit`,
      studentCookie, studentProof, "phase4-current-unit-0001",
      { unitId: unit.id, confirmation: "UPDATE_CURRENT_UNIT" },
    );
    expect(progressedResponse.status).toBe(201);
    const progressed = StudentTextbookContextResponseSchema.parse(await progressedResponse.json());
    expect(progressed.mode === "TEXTBOOK_ALIGNED" ? progressed.currentUnit?.id : null).toBe(unit.id);

    const retiredResponse = await writePost(
      `/v1/curriculum/textbooks/${draft.id}/retire`,
      adminCookie, adminProof, "phase4-retire-textbook-0001",
      { reason: "虚构测试退役", confirmation: "RETIRE_TEXTBOOK" },
    );
    expect(TextbookSummarySchema.parse(await retiredResponse.json()).status).toBe("RETIRED");
    expect((await readContext(studentCookie, studentUserId, "MATH")).mode)
      .toBe("GENERIC_GUIDANCE");
  }, 30_000);

  function textbookDraft(subjectCode: "MATH" | "PHYSICS", grade: 7 | 8, publisher: string) {
    return {
      subjectCode,
      grade,
      publisher,
      editionName: "虚构测试版",
      volume: `${String(grade)}年级上册`,
      units: [{
        ordinal: 1,
        title: "虚构第一章",
        knowledgeNodes: [{ title: "虚构知识点", objective: "仅用于自动化测试" }],
      }],
      confirmation: "CREATE_TEXTBOOK_DRAFT",
    };
  }

  async function login(loginId: string): Promise<string> {
    const response = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
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
    const body = z.object({ proof: z.string(), expiresAt: z.iso.datetime() }).strict()
      .parse(await response.json());
    return body.proof;
  }

  async function writePost(
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

  async function readContext(cookie: string, studentId: string, subjectCode: string) {
    const response = await fetch(
      new URL(`/v1/students/${studentId}/textbook-contexts/${subjectCode}`, baseUrl),
      { headers: { cookie } },
    );
    expect(response.status).toBe(200);
    return StudentTextbookContextResponseSchema.parse(await response.json());
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { loginId: { startsWith: loginPrefix } }, select: { id: true },
    });
    const families = await prisma.family.findMany({
      where: { name: { startsWith: "Phase 4" } }, select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    const familyIds = families.map((family) => family.id);
    await prisma.auditEvent.deleteMany({
      where: { OR: [
        { actorUserId: { in: userIds } },
        { familyId: { in: familyIds } },
      ] },
    });
    await prisma.operation.deleteMany({
      where: { kind: { in: [
        "CREATE_TEXTBOOK_DRAFT",
        "CONFIRM_TEXTBOOK",
        "RETIRE_TEXTBOOK",
        "SUBMIT_STUDENT_TEXTBOOK_CONTEXT",
        "CONFIRM_STUDENT_TEXTBOOK_CONTEXT",
        "UPDATE_STUDENT_CURRENT_UNIT",
      ] } },
    });
    await prisma.studentTextbookContext.deleteMany({
      where: { studentUserId: { in: userIds } },
    });
    await prisma.textbookEdition.deleteMany({
      where: { publisher: { startsWith: "Phase 4" } },
    });
    await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
