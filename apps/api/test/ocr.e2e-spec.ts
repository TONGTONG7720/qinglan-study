import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { OcrResultSchema, PrivateObjectResponseSchema } from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const prefix = "phase6-ocr-"; const password = "fictional-password-123";
describe("Phase 6 private OCR workflow", () => {
  let app: INestApplication | undefined; let prisma: PrismaService; let baseUrl: string;
  let studentA: string; let cookieA: string; let cookieB: string; let proofA: string;
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl; prisma = new PrismaService(); await prisma.onModuleInit(); await cleanup();
    const hash = await new PasswordService().hash(password);
    const ids = await prisma.$transaction(async (tx) => {
      const ownerA = await tx.user.create({ data: { loginId: `${prefix}owner-a`, passwordHash: hash, displayName: "A家长", roles: ["GUARDIAN"] } });
      const a = await tx.user.create({ data: { loginId: `${prefix}student-a`, passwordHash: hash, displayName: "A学生", roles: ["STUDENT"] } });
      const ownerB = await tx.user.create({ data: { loginId: `${prefix}owner-b`, passwordHash: hash, displayName: "B家长", roles: ["GUARDIAN"] } });
      const b = await tx.user.create({ data: { loginId: `${prefix}student-b`, passwordHash: hash, displayName: "B学生", roles: ["STUDENT"] } });
      await tx.family.create({ data: { name: "Phase 6 OCR Family A", memberships: { create: [{ userId: ownerA.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: a.id, role: "STUDENT" }] }, studentProfiles: { create: { userId: a.id, grade: 8 } } } });
      await tx.family.create({ data: { name: "Phase 6 OCR Family B", memberships: { create: [{ userId: ownerB.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: b.id, role: "STUDENT" }] }, studentProfiles: { create: { userId: b.id, grade: 8 } } } });
      return { a, b };
    }); studentA = ids.a.id;
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = ref.createNestApplication(); configureApplication(app, readAppConfig({ NODE_ENV: "test" })); await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
    cookieA = await login("student-a"); cookieB = await login("student-b"); proofA = await reauth(cookieA);
  });
  afterAll(async () => { await app?.close(); await cleanup(); await prisma.onModuleDestroy(); });
  it("keeps objects private, deduplicates OCR and requires low-confidence confirmation", async () => {
    const objectResponse = await post(`/v1/students/${studentA}/private-objects/presign`, cookieA, proofA, objectInput("a"));
    expect(objectResponse.status).toBe(201); const object = PrivateObjectResponseSchema.parse(await objectResponse.json());
    const cross = await fetch(new URL(`/v1/private-objects/${object.id}`, baseUrl), { headers: { cookie: cookieB } }); expect(cross.status).toBe(404);
    const first = await post(`/v1/students/${studentA}/questions/ocr`, cookieA, proofA, { objectId: object.id, confirmation: "START_OCR" });
    const review = OcrResultSchema.parse(await first.json()); expect(review.status).toBe("OCR_REVIEW");
    const second = await post(`/v1/students/${studentA}/questions/ocr`, cookieA, proofA, { objectId: object.id, confirmation: "START_OCR" });
    expect(OcrResultSchema.parse(await second.json()).questionId).toBe(review.questionId);
    expect(await prisma.modelCall.count({ where: { purpose: "OCR", userId: studentA } })).toBe(1);
    expect(await prisma.usageLedger.count({ where: { reservation: { userId: studentA, purpose: "OCR" } } })).toBe(1);
    const confirmed = await post(`/v1/questions/${review.questionId}/confirm-ocr`, cookieA, proofA, { confirmedText: "学生确认后的题目", confirmation: "CONFIRM_OCR" });
    expect(OcrResultSchema.parse(await confirmed.json()).status).toBe("READY");

    const failedObject = PrivateObjectResponseSchema.parse(await (await post(`/v1/students/${studentA}/private-objects/presign`, cookieA, proofA, objectInput("f"))).json());
    const failed = OcrResultSchema.parse(await (await post(`/v1/students/${studentA}/questions/ocr`, cookieA, proofA, { objectId: failedObject.id, confirmation: "START_OCR" })).json());
    expect(failed.status).toBe("FAILED"); expect(await prisma.usageLedger.count({ where: { reservation: { userId: studentA, purpose: "OCR" } } })).toBe(1);
    expect(await prisma.budgetReservation.count({ where: { userId: studentA, purpose: "OCR", status: "RELEASED" } })).toBe(1);
    const usage = await prisma.budgetPeriodUsage.findFirstOrThrow({ where: { family: { memberships: { some: { userId: studentA } } } } });
    expect(usage.reservedFen).toBe(0); expect(usage.settledFen).toBe(10);
  }, 30_000);
  function objectInput(first: string) { return { mimeType: "image/jpeg", sizeBytes: 500000, width: 1200, height: 1600, sha256: first.repeat(64) }; }
  async function login(suffix: string) { const response = await fetch(new URL("/v1/auth/login", baseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loginId: `${prefix}${suffix}`, password }) }); const value = response.headers.get("set-cookie")?.split(";", 1)[0]; if (value === undefined) throw new Error("missing cookie"); return value; }
  async function reauth(cookie: string) { const response = await fetch(new URL("/v1/auth/reauthenticate", baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ password }) }); return z.object({ proof: z.string() }).parse(await response.json()).proof; }
  async function post(path: string, cookie: string, proof: string, body: unknown) { return fetch(new URL(path, baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json", "x-reauth-proof": proof }, body: JSON.stringify(body) }); }
  async function cleanup() { const users = await prisma.user.findMany({ where: { loginId: { startsWith: prefix } }, select: { id: true } }); const ids = users.map((u) => u.id); await prisma.family.deleteMany({ where: { name: { startsWith: "Phase 6 OCR" } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } }); }
});
