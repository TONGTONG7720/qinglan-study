import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { TutorSessionResponseSchema } from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const prefix = "phase7-tutor-"; const password = "fictional-password-123";
describe("Phase 7 reviewed retrieval and tutor state", () => {
  let app: INestApplication | undefined; let prisma: PrismaService; let baseUrl: string;
  let adminCookie: string; let adminProof: string; let studentCookie: string; let studentProof: string;
  let studentId: string; let textbookId: string; let unitId: string; let knowledgeNodeId: string;
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl; prisma = new PrismaService(); await prisma.onModuleInit(); await cleanup(); const hash = await new PasswordService().hash(password);
    const f = await prisma.$transaction(async (tx) => {
      const admin = await tx.user.create({ data: { loginId: `${prefix}admin`, passwordHash: hash, displayName: "审核员", roles: ["ADMIN"] } });
      const owner = await tx.user.create({ data: { loginId: `${prefix}owner`, passwordHash: hash, displayName: "家长", roles: ["GUARDIAN"] } });
      const student = await tx.user.create({ data: { loginId: `${prefix}student`, passwordHash: hash, displayName: "学生", roles: ["STUDENT"] } });
      const family = await tx.family.create({ data: { name: "Phase 7 Tutor Family", memberships: { create: [{ userId: owner.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: student.id, role: "STUDENT" }] }, studentProfiles: { create: { userId: student.id, grade: 8 } } } });
      const textbook = await tx.textbookEdition.create({ data: { subjectCode: "MATH", grade: 8, publisher: "Phase 7 Publisher", editionName: "Test", volume: "8上", status: "CONFIRMED", sourceReference: "虚构 ISBN 00000000", verifiedByUserId: admin.id, verifiedAt: new Date(), units: { create: { ordinal: 1, title: "第一章", status: "CONFIRMED", knowledgeNodes: { create: { title: "1.1 虚构知识点", objective: "仅供 Tutor E2E。", status: "CONFIRMED", prerequisiteKnowledge: [], commonErrors: [], abilityLevels: ["UNDERSTAND"], questionTypes: ["SHORT_ANSWER"], pageStart: 1, pageEnd: 1 } } } } }, include: { units: { include: { knowledgeNodes: true } } } });
      const unit = textbook.units[0]; if (unit === undefined) throw new Error("unit missing");
      await tx.studentTextbookContext.create({ data: { studentUserId: student.id, subjectCode: "MATH", reportedPublisher: "Phase 7 Publisher", reportedEdition: "Test", reportedVolume: "8上", reportedDirectory: ["第一章"], textbookEditionId: textbook.id, currentUnitId: unit.id, status: "CONFIRMED", submittedByUserId: owner.id, verifiedByUserId: admin.id, verifiedAt: new Date() } });
      return { admin, student, textbook, unit, family };
    }); studentId = f.student.id; textbookId = f.textbook.id; unitId = f.unit.id; knowledgeNodeId = f.textbook.units[0]?.knowledgeNodes[0]?.id ?? "";
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = ref.createNestApplication(); configureApplication(app, readAppConfig({ NODE_ENV: "test" })); await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
    adminCookie = await login("admin"); adminProof = await proof(adminCookie); studentCookie = await login("student"); studentProof = await proof(studentCookie);
  });
  afterAll(async () => { await app?.close(); await cleanup(); await prisma.onModuleDestroy(); });
  it("returns NEEDS_EVIDENCE, then enforces the hint-first sequence with traces", async () => {
    const startBody = { subjectCode: "MATH", textbookEditionId: textbookId, unitId, question: "如何解这道虚构数学题？" };
    const none = TutorSessionResponseSchema.parse(await (await post(`/v1/students/${studentId}/tutor-sessions`, studentCookie, studentProof, startBody)).json());
    expect(none.stage).toBe("NEEDS_EVIDENCE"); expect(none.evidenceIds).toEqual([]);
    const content = await post("/v1/admin/reviewed-content", adminCookie, adminProof, { subjectCode: "MATH", textbookEditionId: textbookId, unitId, knowledgeNodeId, textbookAssetId: null, excerpt: "虚构审核内容：先移项，再化简。", sourceReference: "虚构公开许可资料 001", pageStart: 1, pageEnd: 1, contentType: "EXAMPLE", sourceHash: "a".repeat(64), licenseStatus: "AUTHORIZED", contentVersion: "test-v1", embedding: [0.1, 0.2, 0.3] });
    expect(content.status).toBe(201);
    const started = TutorSessionResponseSchema.parse(await (await post(`/v1/students/${studentId}/tutor-sessions`, studentCookie, studentProof, startBody)).json());
    expect(started.stage).toBe("ASK_ATTEMPT"); expect(started.evidenceIds).toHaveLength(1);
    const skipped = await post(`/v1/tutor-sessions/${started.id}/advance`, studentCookie, studentProof, { action: "REQUEST_NEXT", content: "跳过" }); expect(skipped.status).toBe(404);
    const sequence = [
      ["SUBMIT_ATTEMPT", "HINT_ONE"], ["REQUEST_NEXT", "HINT_TWO"], ["REQUEST_NEXT", "EXPLANATION"],
      ["SUBMIT_INDEPENDENT", "INDEPENDENT_ANSWER"], ["REQUEST_EVALUATION", "EVALUATION"], ["COMPLETE_EVALUATION", "COMPLETE"],
    ] as const;
    let current = started;
    for (const [action, expected] of sequence) {
      current = TutorSessionResponseSchema.parse(await (await post(`/v1/tutor-sessions/${current.id}/advance`, studentCookie, studentProof, { action, content: "虚构学生输入" })).json());
      expect(current.stage).toBe(expected); expect(current.evidenceIds).toEqual(started.evidenceIds);
    }
    expect(await prisma.modelCall.count({ where: { userId: studentId, purpose: "TUTOR_FAST", status: "SUCCEEDED" } })).toBe(6);
    expect(await prisma.usageLedger.count({ where: { reservation: { userId: studentId, purpose: "TUTOR_FAST" } } })).toBe(6);
    const steps = await prisma.tutorStep.findMany({ where: { sessionId: started.id } }); expect(steps.every((step) => Array.isArray(step.evidenceIds) && step.modelCallId !== null || step.ordinal === 1)).toBe(true);
  }, 30_000);
  async function login(s: string) { const r = await fetch(new URL("/v1/auth/login", baseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loginId: `${prefix}${s}`, password }) }); const c = r.headers.get("set-cookie")?.split(";", 1)[0]; if (c === undefined) throw new Error("cookie"); return c; }
  async function proof(cookie: string) { const r = await fetch(new URL("/v1/auth/reauthenticate", baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ password }) }); return z.object({ proof: z.string() }).parse(await r.json()).proof; }
  async function post(path: string, cookie: string, proofValue: string, body: unknown) { return fetch(new URL(path, baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json", "x-reauth-proof": proofValue }, body: JSON.stringify(body) }); }
  async function cleanup() {
    const users = await prisma.user.findMany({ where: { loginId: { startsWith: prefix } }, select: { id: true } });
    const ids = users.map((user) => user.id);
    await prisma.tutorSession.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.reviewedContent.deleteMany({ where: { textbookEdition: { publisher: "Phase 7 Publisher" } } });
    await prisma.studentTextbookContext.deleteMany({ where: { studentUserId: { in: ids } } });
    await prisma.textbookEdition.deleteMany({ where: { publisher: "Phase 7 Publisher" } });
    await prisma.family.deleteMany({ where: { name: "Phase 7 Tutor Family" } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});
