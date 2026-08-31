import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  DailyPlanResponseSchema,
  MasteryEvidenceResultSchema,
  MasteryStateResponseSchema,
  MistakeResponseSchema,
  RecoveryAttemptResponseSchema,
} from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const prefix = "phase8-mastery-";
const password = "fictional-password-123";
const scopeKey = "unit:linear-equations";

describe("Phase 8 mistakes, recovery and deterministic mastery", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let baseUrl: string;
  let studentId: string;
  let cookie: string;
  let proof: string;
  let lowConfidenceSourceId: string;
  let firstAcceptedSourceId: string;
  let secondAcceptedSourceId: string;
  let foreignSourceId: string;
  let recoverySourceId: string;
  let concurrentSourceId: string;
  let invalidSourceId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    const passwordHash = await new PasswordService().hash(password);
    const fixture = await prisma.$transaction(async (transaction) => {
      const owner = await transaction.user.create({
        data: { loginId: `${prefix}owner`, passwordHash, displayName: "掌握度家长", roles: ["GUARDIAN"] },
      });
      const student = await transaction.user.create({
        data: { loginId: `${prefix}student`, passwordHash, displayName: "掌握度学生", roles: ["STUDENT"] },
      });
      const foreignOwner = await transaction.user.create({
        data: { loginId: `${prefix}foreign-owner`, passwordHash, displayName: "另一家长", roles: ["GUARDIAN"] },
      });
      const foreignStudent = await transaction.user.create({
        data: { loginId: `${prefix}foreign-student`, passwordHash, displayName: "另一学生", roles: ["STUDENT"] },
      });
      await transaction.family.create({
        data: {
          name: "Phase 8 Mastery Family",
          memberships: { create: [
            { userId: owner.id, role: "GUARDIAN", accessLevel: "OWNER" },
            { userId: student.id, role: "STUDENT" },
          ] },
          studentProfiles: { create: { userId: student.id, grade: 8, dailyMinutes: 45 } },
        },
      });
      await transaction.family.create({
        data: {
          name: "Phase 8 Foreign Family",
          memberships: { create: [
            { userId: foreignOwner.id, role: "GUARDIAN", accessLevel: "OWNER" },
            { userId: foreignStudent.id, role: "STUDENT" },
          ] },
          studentProfiles: { create: { userId: foreignStudent.id, grade: 8 } },
        },
      });
      const [low, first, second, foreign, recovery, concurrent, invalid] = await Promise.all([
        transaction.learningEvidence.create({
          data: { studentUserId: student.id, type: "ANSWER_EVALUATED", independent: true, valid: true, occurredAt: new Date("2026-08-17T00:00:00.000Z") },
        }),
        transaction.learningEvidence.create({
          data: { studentUserId: student.id, type: "ANSWER_EVALUATED", independent: true, valid: true, occurredAt: new Date("2026-08-18T00:00:00.000Z") },
        }),
        transaction.learningEvidence.create({
          data: { studentUserId: student.id, type: "REVIEW_SUCCEEDED", independent: true, valid: true, occurredAt: new Date("2026-08-19T00:00:00.000Z") },
        }),
        transaction.learningEvidence.create({
          data: { studentUserId: foreignStudent.id, type: "ANSWER_EVALUATED", independent: true, valid: true, occurredAt: new Date("2026-08-18T00:00:00.000Z") },
        }),
        transaction.learningEvidence.create({
          data: { studentUserId: student.id, type: "RECOVERY_ATTEMPT", independent: true, valid: true, occurredAt: new Date("2026-08-20T00:00:00.000Z") },
        }),
        transaction.learningEvidence.create({
          data: { studentUserId: student.id, type: "ANSWER_EVALUATED", independent: true, valid: true, occurredAt: new Date("2026-08-18T00:00:00.000Z") },
        }),
        transaction.learningEvidence.create({
          data: { studentUserId: student.id, type: "ANSWER_EVALUATED", independent: true, valid: false, occurredAt: new Date("2026-08-16T00:00:00.000Z") },
        }),
      ]);
      return { student, low, first, second, foreign, recovery, concurrent, invalid };
    });
    studentId = fixture.student.id;
    lowConfidenceSourceId = fixture.low.id;
    firstAcceptedSourceId = fixture.first.id;
    secondAcceptedSourceId = fixture.second.id;
    foreignSourceId = fixture.foreign.id;
    recoverySourceId = fixture.recovery.id;
    concurrentSourceId = fixture.concurrent.id;
    invalidSourceId = fixture.invalid.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, readAppConfig({ NODE_ENV: "test" }));
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
    cookie = await login();
    proof = await reauthenticate();
  });

  afterAll(async () => {
    await app?.close();
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it("records answer seeking separately and requires independent correct recovery", async () => {
    const created = await write(`/v1/students/${studentId}/mistakes`, "phase8-create-mistake-0001", {
      subjectCode: "MATH",
      knowledgeNodeId: null,
      cause: "ANSWER_SEEKING",
      promptSummary: "虚构题目中直接索取答案",
    });
    expect(created.status).toBe(201);
    const mistake = MistakeResponseSchema.parse(await created.json());
    expect(mistake.cause).toBe("ANSWER_SEEKING");

    const invalid = await write(
      `/v1/students/${studentId}/mistakes/${mistake.id}/recovery-attempts`,
      "phase8-invalid-recovery-0001",
      { sourceAttemptId: recoverySourceId, correct: true, independent: false },
    );
    expect(invalid.status).toBe(400);

    const recorded = await write(
      `/v1/students/${studentId}/mistakes/${mistake.id}/recovery-attempts`,
      "phase8-valid-recovery-0001",
      { sourceAttemptId: recoverySourceId, correct: true, independent: true },
    );
    expect(recorded.status).toBe(201);
    const recovery = RecoveryAttemptResponseSchema.parse(await recorded.json());
    expect(recovery).toMatchObject({ mistakeId: mistake.id, correct: true, independent: true });
  });

  it("does not update mastery for low-confidence or cross-student evidence", async () => {
    const low = await write(`/v1/students/${studentId}/mastery-evidence`, "phase8-low-confidence-0001", {
      ...evidenceBody(lowConfidenceSourceId, 4, 0.6),
      type: "INDEPENDENT_ANSWER",
    });
    expect(low.status).toBe(201);
    const lowResult = MasteryEvidenceResultSchema.parse(await low.json());
    expect(lowResult).toMatchObject({ status: "REVIEW_REQUIRED", state: null });
    expect(await prisma.masteryState.count({ where: { studentUserId: studentId } })).toBe(0);

    const foreign = await write(`/v1/students/${studentId}/mastery-evidence`, "phase8-cross-student-0001", {
      ...evidenceBody(foreignSourceId, 8, 0.9),
      type: "INDEPENDENT_ANSWER",
    });
    expect(foreign.status).toBe(404);

    const invalid = await write(`/v1/students/${studentId}/mastery-evidence`, "phase8-server-invalid-0001", {
      ...evidenceBody(invalidSourceId, 8, 0.9),
      type: "INDEPENDENT_ANSWER",
    });
    expect(invalid.status).toBe(404);
    expect(await prisma.masteryState.count({ where: { studentUserId: studentId } })).toBe(0);
  });

  it("deduplicates evidence, replays deterministically and prioritizes overdue review", async () => {
    const firstResponse = await write(`/v1/students/${studentId}/mastery-evidence`, "phase8-first-accepted-0001", {
      ...evidenceBody(firstAcceptedSourceId, 8, 0.9),
      type: "INDEPENDENT_ANSWER",
    });
    expect(firstResponse.status).toBe(201);
    const first = MasteryEvidenceResultSchema.parse(await firstResponse.json());
    expect(first.status).toBe("ACCEPTED");
    if (first.status !== "ACCEPTED") throw new Error("accepted evidence expected");
    expect(first.state).toMatchObject({ score: 58, confidence: 0.9, evidenceCount: 1 });
    expect(first.state.nextReviewAt).toBe("2026-08-19T00:00:00.000Z");

    const duplicateResponse = await write(`/v1/students/${studentId}/mastery-evidence`, "phase8-first-accepted-0002", {
      ...evidenceBody(firstAcceptedSourceId, 8, 0.9),
      type: "INDEPENDENT_ANSWER",
    });
    const duplicate = MasteryEvidenceResultSchema.parse(await duplicateResponse.json());
    expect(duplicate.evidenceId).toBe(first.evidenceId);
    if (duplicate.status !== "ACCEPTED") throw new Error("accepted duplicate expected");
    expect(duplicate.state.evidenceCount).toBe(1);

    const secondResponse = await write(`/v1/students/${studentId}/mastery-evidence`, "phase8-second-accepted-0001", {
      ...evidenceBody(secondAcceptedSourceId, 5, 0.8),
      type: "REVIEW_RESULT",
    });
    const second = MasteryEvidenceResultSchema.parse(await secondResponse.json());
    if (second.status !== "ACCEPTED") throw new Error("accepted evidence expected");
    expect(second.state).toMatchObject({ score: 63, confidence: 0.85, evidenceCount: 2 });
    expect(second.state.nextReviewAt).toBe("2026-08-22T00:00:00.000Z");

    const read = await fetch(new URL(`/v1/students/${studentId}/mastery/MATH/${scopeKey}`, baseUrl), {
      headers: { cookie },
    });
    expect(read.status).toBe(200);
    expect(MasteryStateResponseSchema.parse(await read.json())).toEqual(second.state);

    await prisma.masteryState.update({
      where: { studentUserId_subjectCode_scopeKey: { studentUserId: studentId, subjectCode: "MATH", scopeKey } },
      data: { score: 0, confidence: 0, evidenceCount: 99, nextReviewAt: new Date("2030-01-01T00:00:00.000Z") },
    });
    const replayedResponse = await write(
      `/v1/students/${studentId}/mastery/MATH/${scopeKey}/replay`,
      "phase8-replay-0001",
      undefined,
    );
    expect(replayedResponse.status).toBe(201);
    const replayed = MasteryStateResponseSchema.parse(await replayedResponse.json());
    expect(replayed).toEqual(second.state);

    const stateRow = await prisma.masteryState.findUniqueOrThrow({
      where: { studentUserId_subjectCode_scopeKey: { studentUserId: studentId, subjectCode: "MATH", scopeKey } },
    });
    const candidate = await prisma.planCandidate.findUniqueOrThrow({
      where: { studentUserId_sourceType_sourceId: { studentUserId: studentId, sourceType: "OVERDUE_REVIEW", sourceId: stateRow.id } },
    });
    expect(candidate.availableAt.toISOString()).toBe(replayed.nextReviewAt);

    await prisma.planCandidate.createMany({ data: [
      { studentUserId: studentId, sourceType: "EXAM_REMEDIATION", sourceId: "phase8-exam", title: "虚构考试补救", estimatedMinutes: 10 },
      { studentUserId: studentId, sourceType: "CURRENT_UNIT", sourceId: "phase8-unit", title: "虚构当前单元", estimatedMinutes: 10 },
    ] });
    const generated = await write(`/v1/students/${studentId}/daily-plans/generate`, "phase8-plan-0001", {});
    expect(generated.status).toBe(201);
    const plan = DailyPlanResponseSchema.parse(await generated.json());
    expect(plan.tasks[0]?.sourceType).toBe("OVERDUE_REVIEW");
    expect(plan.tasks[0]?.sourceId).toBe(stateRow.id);
  }, 30_000);

  it("collapses concurrent claims for one source attempt into one evidence row", async () => {
    const body = {
      ...evidenceBody(concurrentSourceId, 6, 0.95),
      scopeKey: "unit:concurrent",
      type: "INDEPENDENT_ANSWER",
    };
    const responses = await Promise.all(Array.from({ length: 5 }, (_, index) =>
      write(
        `/v1/students/${studentId}/mastery-evidence`,
        `phase8-concurrent-${String(index + 1).padStart(4, "0")}`,
        body,
      )));
    expect(responses.map((response) => response.status)).toEqual([201, 201, 201, 201, 201]);
    const results = await Promise.all(responses.map(async (response) =>
      MasteryEvidenceResultSchema.parse(await response.json())));
    expect(new Set(results.map((result) => result.evidenceId)).size).toBe(1);
    expect(await prisma.masteryEvidence.count({
      where: { sourceAttemptId: concurrentSourceId },
    })).toBe(1);
    expect(await prisma.operation.count({
      where: {
        kind: "RECORD_MASTERY_EVIDENCE",
        status: "RUNNING",
        userId: studentId,
      },
    })).toBe(0);

    const conflicting = await write(
      `/v1/students/${studentId}/mastery-evidence`,
      "phase8-concurrent-conflict-0001",
      { ...body, scoreDelta: -3 },
    );
    expect(conflicting.status).toBe(201);
    expect(MasteryEvidenceResultSchema.parse(await conflicting.json())).toMatchObject({
      status: "REVIEW_REQUIRED",
      state: null,
    });
    expect(await prisma.masteryEvidence.findUnique({
      where: { sourceAttemptId: concurrentSourceId },
      select: { status: true },
    })).toEqual({ status: "REVIEW_REQUIRED" });
    expect(await prisma.masteryState.count({
      where: { studentUserId: studentId, scopeKey: "unit:concurrent" },
    })).toBe(0);
    expect(await prisma.planCandidate.count({
      where: { studentUserId: studentId, active: true, title: { contains: "unit:concurrent" } },
    })).toBe(0);
  });

  function evidenceBody(sourceAttemptId: string, scoreDelta: number, confidence: number) {
    return {
      subjectCode: "MATH",
      knowledgeNodeId: null,
      scopeKey,
      sourceAttemptId,
      independent: true,
      valid: true,
      scoreDelta,
      confidence,
    };
  }

  async function login(): Promise<string> {
    const response = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: `${prefix}student`, password }),
    });
    const value = response.headers.get("set-cookie")?.split(";", 1)[0];
    if (value === undefined) throw new Error("missing cookie");
    return value;
  }

  async function reauthenticate(): Promise<string> {
    const response = await fetch(new URL("/v1/auth/reauthenticate", baseUrl), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return z.object({ proof: z.string() }).parse(await response.json()).proof;
  }

  async function write(path: string, key: string, body: unknown): Promise<Response> {
    return fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "idempotency-key": key,
        "x-reauth-proof": proof,
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { loginId: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.operation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.planTaskCompletion.deleteMany({ where: { planTask: { dailyPlan: { studentUserId: { in: ids } } } } });
    await prisma.dailyPlan.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.planCandidate.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.masteryEvidence.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.masteryState.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.recoveryAttempt.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.mistake.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.learningEvidence.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.family.deleteMany({ where: { name: { startsWith: "Phase 8" } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});
