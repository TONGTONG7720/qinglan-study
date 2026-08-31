import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DailyPlanResponseSchema, PlanTaskCompletionResponseSchema, OperationResponseSchema } from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginPrefix = "phase5-e2e-";
const password = "fictional-password-123";

describe("Phase 5 deterministic daily plans", () => {
  let app: INestApplication | undefined; let prisma: PrismaService; let baseUrl: string;
  let studentId: string; let cookie: string; let proof: string;
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl; prisma = new PrismaService(); await prisma.onModuleInit(); await cleanup();
    const passwordHash = await new PasswordService().hash(password);
    const fixture = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({ data: { loginId: `${loginPrefix}owner`, passwordHash, displayName: "计划家长", roles: ["GUARDIAN"] } });
      const student = await tx.user.create({ data: { loginId: `${loginPrefix}student`, passwordHash, displayName: "计划学生", roles: ["STUDENT"] } });
      const family = await tx.family.create({ data: { name: "Phase 5 Daily Plan Family", memberships: { create: [
        { userId: owner.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: student.id, role: "STUDENT" },
      ] }, studentProfiles: { create: { userId: student.id, grade: 8, dailyMinutes: 45 } } } });
      return { student, family };
    });
    studentId = fixture.student.id;
    await prisma.planCandidate.createMany({ data: [
      { studentUserId: studentId, sourceType: "DIAGNOSTIC", sourceId: "diagnostic", title: "诊断", estimatedMinutes: 10 },
      { studentUserId: studentId, sourceType: "CURRENT_UNIT", sourceId: "unit", title: "当前单元", estimatedMinutes: 15 },
      { studentUserId: studentId, sourceType: "OVERDUE_REVIEW", sourceId: "review", title: "逾期复习", estimatedMinutes: 10 },
      { studentUserId: studentId, sourceType: "EXAM_REMEDIATION", sourceId: "exam", title: "考试补救", estimatedMinutes: 20 },
    ] });
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = ref.createNestApplication();
    configureApplication(app, readAppConfig({ NODE_ENV: "test" })); await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
    cookie = await login(); proof = await reauthenticate();
  });
  afterAll(async () => { await app?.close(); await cleanup(); await prisma.onModuleDestroy(); });

  it("returns one stable plan and requires unique server evidence for completion", async () => {
    const first = await write(`/v1/students/${studentId}/daily-plans/generate`, "phase5-generate-plan-0001", {});
    expect(first.status).toBe(201); const plan = DailyPlanResponseSchema.parse(await first.json());
    expect(plan.tasks.map((task) => task.sourceId)).toEqual(["review", "exam", "unit"]);
    expect(plan.totalMinutes).toBe(45);
    const task = plan.tasks[0];
    if (task === undefined) throw new Error("generated plan has no task");
    const repeated = await write(`/v1/students/${studentId}/daily-plans/generate`, "phase5-generate-plan-0002", {});
    expect(DailyPlanResponseSchema.parse(await repeated.json()).id).toBe(plan.id);
    expect(await prisma.dailyPlan.count({ where: { studentUserId: studentId } })).toBe(1);

    const noEvidence = await write(`/v1/plan-tasks/${task.id}/complete`, "phase5-complete-missing-0001", {
      evidence: { type: "ANSWER_EVALUATED", evidenceId: "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c" }, confirmation: "COMPLETE_PLAN_TASK",
    });
    expect(noEvidence.status).toBe(404);
    const evidence = await prisma.learningEvidence.create({ data: { studentUserId: studentId, type: "REVIEW_SUCCEEDED" } });
    const completed = await write(`/v1/plan-tasks/${task.id}/complete`, "phase5-complete-task-0001", {
      evidence: { type: "REVIEW_SUCCEEDED", evidenceId: evidence.id }, confirmation: "COMPLETE_PLAN_TASK",
    });
    expect(completed.status).toBe(201); const result = PlanTaskCompletionResponseSchema.parse(await completed.json());
    const duplicate = await write(`/v1/plan-tasks/${task.id}/complete`, "phase5-complete-task-0002", {
      evidence: { type: "REVIEW_SUCCEEDED", evidenceId: evidence.id }, confirmation: "COMPLETE_PLAN_TASK",
    });
    expect(PlanTaskCompletionResponseSchema.parse(await duplicate.json()).id).toBe(result.id);
    expect(await prisma.planTaskCompletion.count({ where: { planTaskId: result.planTaskId } })).toBe(1);
    const operation = await prisma.operation.findFirstOrThrow({ where: { userId: studentId, kind: "COMPLETE_PLAN_TASK", status: "SUCCEEDED" } });
    const operationResponse = await fetch(new URL(`/v1/operations/${operation.id}`, baseUrl), { headers: { cookie } });
    expect(OperationResponseSchema.parse(await operationResponse.json()).status).toBe("SUCCEEDED");
  }, 30_000);

  async function login(): Promise<string> { const response = await fetch(new URL("/v1/auth/login", baseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loginId: `${loginPrefix}student`, password }) }); const value = response.headers.get("set-cookie")?.split(";", 1)[0]; if (value === undefined) throw new Error("missing cookie"); return value; }
  async function reauthenticate(): Promise<string> { const response = await fetch(new URL("/v1/auth/reauthenticate", baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ password }) }); return z.object({ proof: z.string() }).parse(await response.json()).proof; }
  async function write(path: string, key: string, body: unknown): Promise<Response> { return fetch(new URL(path, baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key, "x-reauth-proof": proof }, body: JSON.stringify(body) }); }
  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({ where: { loginId: { startsWith: loginPrefix } }, select: { id: true } }); const ids = users.map((user) => user.id);
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: ids } } }); await prisma.operation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.planTaskCompletion.deleteMany({ where: { planTask: { dailyPlan: { studentUserId: { in: ids } } } } });
    await prisma.dailyPlan.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.learningEvidence.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.planCandidate.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.family.deleteMany({ where: { name: "Phase 5 Daily Plan Family" } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});
