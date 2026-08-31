import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AdminOverviewResponseSchema,
  DailyPlanResponseSchema,
  ExamResponseSchema,
  PlanTaskCompletionResponseSchema,
  WeeklyReportResponseSchema,
} from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const prefix = "phase9-e2e-";
const password = "fictional-password-123";
const weekStart = "2026-08-17";

describe("Phase 9 exams, reports and minimal admin overview", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let baseUrl: string;
  let studentId: string;
  let foreignStudentId: string;
  let knowledgeNodeId: string;
  let examId: string;
  let studentCookie: string;
  let studentProof: string;
  let guardianCookie: string;
  let guardianProof: string;
  let foreignGuardianCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    const passwordHash = await new PasswordService().hash(password);
    const fixture = await prisma.$transaction(async (transaction) => {
      const admin = await transaction.user.create({ data: { loginId: `${prefix}admin`, passwordHash, displayName: "虚构管理员", roles: ["ADMIN"] } });
      const owner = await transaction.user.create({ data: { loginId: `${prefix}owner`, passwordHash, displayName: "虚构家长", roles: ["GUARDIAN"] } });
      const guardian = await transaction.user.create({ data: { loginId: `${prefix}guardian`, passwordHash, displayName: "关联家长", roles: ["GUARDIAN"] } });
      const student = await transaction.user.create({ data: { loginId: `${prefix}student`, passwordHash, displayName: "虚构学生", roles: ["STUDENT"] } });
      const foreignOwner = await transaction.user.create({ data: { loginId: `${prefix}foreign-owner`, passwordHash, displayName: "另一家长", roles: ["GUARDIAN"] } });
      const foreignStudent = await transaction.user.create({ data: { loginId: `${prefix}foreign-student`, passwordHash, displayName: "另一学生", roles: ["STUDENT"] } });
      const family = await transaction.family.create({
        data: {
          name: "Phase 9 Report Family",
          memberships: { create: [
            { userId: owner.id, role: "GUARDIAN", accessLevel: "OWNER" },
            { userId: guardian.id, role: "GUARDIAN", accessLevel: "MEMBER" },
            { userId: student.id, role: "STUDENT" },
          ] },
          studentProfiles: { create: { userId: student.id, grade: 8, dailyMinutes: 45 } },
        },
      });
      await transaction.guardianStudentRelation.create({
        data: { familyId: family.id, guardianUserId: guardian.id, studentUserId: student.id },
      });
      await transaction.family.create({
        data: {
          name: "Phase 9 Foreign Family",
          memberships: { create: [
            { userId: foreignOwner.id, role: "GUARDIAN", accessLevel: "OWNER" },
            { userId: foreignStudent.id, role: "STUDENT" },
          ] },
          studentProfiles: { create: { userId: foreignStudent.id, grade: 8 } },
        },
      });
      const textbook = await transaction.textbookEdition.create({
        data: {
          subjectCode: "MATH", grade: 8, publisher: "Phase 9 Fictional Publisher", editionName: "Test", volume: "8上",
          status: "CONFIRMED", sourceReference: "虚构许可资料", verifiedByUserId: admin.id, verifiedAt: new Date(),
          units: { create: { ordinal: 1, title: "方程", status: "CONFIRMED", knowledgeNodes: { create: { title: "一次方程", objective: "虚构学习目标", status: "CONFIRMED" } } } },
        },
        include: { units: { include: { knowledgeNodes: true } } },
      });
      const node = textbook.units[0]?.knowledgeNodes[0];
      if (node === undefined) throw new Error("knowledge node fixture missing");
      await transaction.masteryState.create({
        data: { studentUserId: student.id, subjectCode: "MATH", knowledgeNodeId: node.id, scopeKey: `knowledge:${node.id}`, score: 45, confidence: 0.8, evidenceCount: 1, nextReviewAt: new Date("2026-08-18T00:00:00.000Z") },
      });
      await transaction.dailyPlan.create({
        data: {
          studentUserId: student.id, learningDay: new Date("2026-08-17T00:00:00.000Z"), totalMinutes: 20,
          tasks: { create: [
            { sourceType: "CURRENT_UNIT", sourceId: "phase9-week-task-1", title: "虚构任务一", estimatedMinutes: 10, ordinal: 1, status: "COMPLETED" },
            { sourceType: "DIAGNOSTIC", sourceId: "phase9-week-task-2", title: "虚构任务二", estimatedMinutes: 10, ordinal: 2 },
          ] },
        },
      });
      await transaction.learningEvidence.createMany({ data: [
        { studentUserId: student.id, type: "ANSWER_EVALUATED", independent: true, valid: true, occurredAt: new Date("2026-08-17T02:00:00.000Z") },
        { studentUserId: student.id, type: "ANSWER_EVALUATED", independent: true, valid: true, occurredAt: new Date("2026-08-18T02:00:00.000Z") },
      ] });
      const previous = await transaction.exam.create({
        data: {
          studentUserId: student.id, createdByUserId: student.id, subjectCode: "MATH", title: "虚构上次测验", occurredAt: new Date("2026-08-10T08:00:00.000Z"),
          items: { create: [{ ordinal: 1, label: "第1题", scoreHundredths: 800, maxScoreHundredths: 1000, knowledgeNodeId: node.id, lossCause: "CARELESS" }] },
        },
      });
      await transaction.exam.update({ where: { id: previous.id }, data: { status: "CONFIRMED", totalScoreHundredths: 800, totalMaxScoreHundredths: 1000, confirmedAt: new Date("2026-08-10T09:00:00.000Z") } });
      await transaction.modelCall.create({
        data: { userId: student.id, purpose: "TUTOR_FAST", dedupeKey: "phase9-sensitive-output", provider: "fake", status: "FAILED", errorCode: "PROVIDER_FAILED", output: { promptText: "不得泄露", storageKey: "private/object" } },
      });
      return { admin, guardian, student, foreignOwner, foreignStudent, node };
    });
    studentId = fixture.student.id;
    foreignStudentId = fixture.foreignStudent.id;
    knowledgeNodeId = fixture.node.id;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, readAppConfig({ NODE_ENV: "test" }));
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
    studentCookie = await login("student");
    studentProof = await proof(studentCookie);
    guardianCookie = await login("guardian");
    guardianProof = await proof(guardianCookie);
    foreignGuardianCookie = await login("foreign-owner");
    adminCookie = await login("admin");
  });

  afterAll(async () => {
    await app?.close();
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it("confirms explainable rows and creates only the two largest remediations", async () => {
    const invalid = await write(`/v1/students/${studentId}/exams`, studentCookie, studentProof, "phase9-invalid-exam-0001", {
      title: "无失分原因", subjectCode: "MATH", occurredAt: "2026-08-20T08:00:00.000Z", confirmation: "CREATE_EXAM_DRAFT",
      items: [{ ordinal: 1, label: "第1题", score: 8, maxScore: 10, knowledgeNodeId, lossCause: null }],
    });
    expect(invalid.status).toBe(400);
    const created = await write(`/v1/students/${studentId}/exams`, studentCookie, studentProof, "phase9-create-exam-0001", {
      title: "虚构本周测验", subjectCode: "MATH", occurredAt: "2026-08-20T08:00:00.000Z", confirmation: "CREATE_EXAM_DRAFT",
      items: [
        { ordinal: 1, label: "第1题", score: 8, maxScore: 10, knowledgeNodeId, lossCause: "CALCULATION_ERROR" },
        { ordinal: 2, label: "第2题", score: 2, maxScore: 10, knowledgeNodeId, lossCause: "KNOWLEDGE_GAP" },
        { ordinal: 3, label: "第3题", score: 3, maxScore: 10, knowledgeNodeId, lossCause: "METHOD_ERROR" },
      ],
    });
    expect(created.status).toBe(201);
    const draft = ExamResponseSchema.parse(await created.json());
    expect(draft.status).toBe("DRAFT");
    examId = draft.id;
    const confirmedResponse = await write(`/v1/students/${studentId}/exams/${examId}/confirm`, studentCookie, studentProof, "phase9-confirm-exam-0001", { confirmation: "CONFIRM_EXAM" });
    expect(confirmedResponse.status).toBe(201);
    const confirmed = ExamResponseSchema.parse(await confirmedResponse.json());
    expect(confirmed).toMatchObject({ status: "CONFIRMED", totalScore: 13, totalMaxScore: 30 });
    expect(confirmed.remediations.map((item) => item.examItemId)).toEqual([confirmed.items[1]?.id, confirmed.items[2]?.id]);
    expect(await prisma.planCandidate.count({ where: { studentUserId: studentId, sourceType: "EXAM_REMEDIATION" } })).toBe(2);
    const repeated = ExamResponseSchema.parse(await (await write(`/v1/students/${studentId}/exams/${examId}/confirm`, studentCookie, studentProof, "phase9-confirm-exam-0002", { confirmation: "CONFIRM_EXAM" })).json());
    expect(repeated.remediations).toEqual(confirmed.remediations);
    const firstItem = confirmed.items[0];
    if (firstItem === undefined) throw new Error("confirmed item missing");
    await expect(prisma.examItem.update({ where: { id: firstItem.id }, data: { scoreHundredths: 900 } })).rejects.toThrow();
  });

  it("allows only the student or linked guardian to read the exam", async () => {
    const linked = await fetch(new URL(`/v1/students/${studentId}/exams/${examId}`, baseUrl), { headers: { cookie: guardianCookie } });
    expect(linked.status).toBe(200);
    expect(ExamResponseSchema.parse(await linked.json()).id).toBe(examId);
    const foreign = await fetch(new URL(`/v1/students/${studentId}/exams/${examId}`, baseUrl), { headers: { cookie: foreignGuardianCookie } });
    expect(foreign.status).toBe(404);
  });

  it("links valid recovery evidence without changing confirmed exam scores", async () => {
    const generated = await write(`/v1/students/${studentId}/daily-plans/generate`, studentCookie, studentProof, "phase9-generate-plan-0001", {});
    const plan = DailyPlanResponseSchema.parse(await generated.json());
    const task = plan.tasks.find((item) => item.sourceType === "EXAM_REMEDIATION");
    if (task === undefined) throw new Error("exam remediation task missing");
    const invalidEvidence = await prisma.learningEvidence.create({ data: { studentUserId: studentId, type: "ANSWER_EVALUATED", independent: true, valid: true } });
    const rejected = await write(`/v1/plan-tasks/${task.id}/complete`, studentCookie, studentProof, "phase9-reject-completion-0001", { evidence: { type: "ANSWER_EVALUATED", evidenceId: invalidEvidence.id }, confirmation: "COMPLETE_PLAN_TASK" });
    expect(rejected.status).toBe(404);
    const evidence = await prisma.learningEvidence.create({ data: { studentUserId: studentId, type: "RECOVERY_ATTEMPT", independent: true, valid: true, occurredAt: new Date("2026-08-20T10:00:00.000Z") } });
    const completed = await write(`/v1/plan-tasks/${task.id}/complete`, studentCookie, studentProof, "phase9-complete-remediation-0001", { evidence: { type: "RECOVERY_ATTEMPT", evidenceId: evidence.id }, confirmation: "COMPLETE_PLAN_TASK" });
    expect(completed.status).toBe(201);
    expect(PlanTaskCompletionResponseSchema.parse(await completed.json()).evidenceId).toBe(evidence.id);
    expect(await prisma.remediationLink.count({ where: { id: task.sourceId, evidenceId: evidence.id, completedAt: { not: null } } })).toBe(1);
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
    expect([exam.totalScoreHundredths, exam.totalMaxScoreHundredths]).toEqual([1300, 3000]);
  });

  it("serves only aggregate weekly facts to a linked guardian", async () => {
    const [generated, concurrent] = await Promise.all([
      write(`/v1/students/${studentId}/weekly-reports/generate`, guardianCookie, guardianProof, "phase9-weekly-report-0001", { weekStart, confirmation: "GENERATE_WEEKLY_REPORT" }),
      write(`/v1/students/${studentId}/weekly-reports/generate`, guardianCookie, guardianProof, "phase9-weekly-report-0002", { weekStart, confirmation: "GENERATE_WEEKLY_REPORT" }),
    ]);
    expect([generated.status, concurrent.status]).toEqual([201, 201]);
    const report = WeeklyReportResponseSchema.parse(await generated.json());
    expect(WeeklyReportResponseSchema.parse(await concurrent.json()).id).toBe(report.id);
    expect(await prisma.weeklyReport.count({ where: { studentUserId: studentId, weekStart: new Date("2026-08-17T00:00:00.000Z") } })).toBe(1);
    expect(report.summary).toMatchObject({ completedTasks: 1, totalTasks: 2, completionRate: 0.5, activeDays: 3 });
    expect(report.summary.weakKnowledgeNodes[0]?.knowledgeNodeId).toBe(knowledgeNodeId);
    expect(report.summary.examChanges[0]).toMatchObject({ subjectCode: "MATH", previousPercent: 80, currentPercent: 43.33, deltaPercent: -36.67 });
    expect(report.suggestions.length).toBeLessThanOrEqual(3);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("promptText");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("transcript");
    const read = await fetch(new URL(`/v1/students/${studentId}/weekly-reports/${weekStart}`, baseUrl), { headers: { cookie: guardianCookie } });
    expect(WeeklyReportResponseSchema.parse(await read.json()).id).toBe(report.id);
    const foreign = await fetch(new URL(`/v1/students/${studentId}/weekly-reports/${weekStart}`, baseUrl), { headers: { cookie: foreignGuardianCookie } });
    expect(foreign.status).toBe(404);
    const unrelated = await fetch(new URL(`/v1/students/${foreignStudentId}/weekly-reports/${weekStart}`, baseUrl), { headers: { cookie: guardianCookie } });
    expect(unrelated.status).toBe(404);
  });

  it("returns an aggregate-only admin allowlist", async () => {
    const response = await fetch(new URL("/v1/admin/overview", baseUrl), { headers: { cookie: adminCookie } });
    expect(response.status).toBe(200);
    const overview = AdminOverviewResponseSchema.parse(await response.json());
    expect(overview.aiErrors).toMatchObject({ failedCalls: 1, byCode: [{ code: "PROVIDER_FAILED", count: 1 }] });
    const serialized = JSON.stringify(overview);
    expect(serialized).not.toContain("promptText");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("不得泄露");
    const studentDenied = await fetch(new URL("/v1/admin/overview", baseUrl), { headers: { cookie: studentCookie } });
    expect(studentDenied.status).toBe(404);
  });

  async function login(name: string): Promise<string> {
    const response = await fetch(new URL("/v1/auth/login", baseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loginId: `${prefix}${name}`, password }) });
    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    if (cookie === undefined) throw new Error("missing cookie");
    return cookie;
  }
  async function proof(cookie: string): Promise<string> {
    const response = await fetch(new URL("/v1/auth/reauthenticate", baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ password }) });
    return z.object({ proof: z.string() }).parse(await response.json()).proof;
  }
  async function write(path: string, cookie: string, proofValue: string, key: string, body: unknown): Promise<Response> {
    return fetch(new URL(path, baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json", "x-reauth-proof": proofValue, "idempotency-key": key }, body: JSON.stringify(body) });
  }
  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({ where: { loginId: { startsWith: prefix } }, select: { id: true } });
    const ids = users.map((user) => user.id);
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.operation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.weeklyReport.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.planTaskCompletion.deleteMany({ where: { planTask: { dailyPlan: { studentUserId: { in: ids } } } } });
    await prisma.dailyPlan.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.planCandidate.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.remediationLink.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.exam.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.masteryState.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.learningEvidence.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.modelCall.deleteMany({ where: { userId: { in: ids } } });
    await prisma.textbookEdition.deleteMany({ where: { publisher: "Phase 9 Fictional Publisher" } });
    await prisma.family.deleteMany({ where: { name: { startsWith: "Phase 9" } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});
