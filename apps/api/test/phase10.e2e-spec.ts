import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DeletionRequestResponseSchema, FamilyExportResponseSchema, RetentionRunResponseSchema } from "@study/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const prefix = "phase10-e2e-"; const password = "fictional-password-123";

describe("Phase 10 privacy deletion, retention jobs and safety", () => {
  let app: INestApplication | undefined; let prisma: PrismaService; let baseUrl: string;
  let familyId: string; let deleteFamilyId: string; let studentId: string; let memberId: string; let deleteStudentId: string;
  let ownerCookie: string; let ownerProof: string; let memberCookie: string; let memberProof: string;
  let deleteOwnerCookie: string; let deleteOwnerProof: string; let adminCookie: string; let adminProof: string;
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl; prisma = new PrismaService(); await prisma.onModuleInit(); await cleanup();
    const hash = await new PasswordService().hash(password);
    const fixture = await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { loginId: `${prefix}admin`, passwordHash: hash, displayName: "隐私管理员", roles: ["ADMIN"] } });
      const owner = await tx.user.create({ data: { loginId: `${prefix}owner`, passwordHash: hash, displayName: "导出家长", roles: ["GUARDIAN"] } });
      const member = await tx.user.create({ data: { loginId: `${prefix}member`, passwordHash: hash, displayName: "待删成员", roles: ["GUARDIAN"] } });
      const student = await tx.user.create({ data: { loginId: `${prefix}student`, passwordHash: hash, displayName: "导出学生", roles: ["STUDENT"] } });
      const deleteOwner = await tx.user.create({ data: { loginId: `${prefix}delete-owner`, passwordHash: hash, displayName: "删家庭家长", roles: ["GUARDIAN"] } });
      const deleteStudent = await tx.user.create({ data: { loginId: `${prefix}delete-student`, passwordHash: hash, displayName: "删家庭学生", roles: ["STUDENT"] } });
      const family = await tx.family.create({ data: { name: "Phase 10 Export Family", memberships: { create: [{ userId: owner.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: member.id, role: "GUARDIAN", accessLevel: "MEMBER" }, { userId: student.id, role: "STUDENT" }] }, studentProfiles: { create: { userId: student.id, grade: 8 } } } });
      await tx.guardianStudentRelation.create({ data: { familyId: family.id, guardianUserId: member.id, studentUserId: student.id } });
      const deleteFamily = await tx.family.create({ data: { name: "Phase 10 Delete Family", memberships: { create: [{ userId: deleteOwner.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: deleteStudent.id, role: "STUDENT" }] }, studentProfiles: { create: { userId: deleteStudent.id, grade: 8 } } } });
      await tx.modelCall.create({ data: { userId: student.id, purpose: "TUTOR_FAST", dedupeKey: "phase10-secret-output", provider: "fake", status: "FAILED", errorCode: "FAIL", output: { promptText: "secret-provider-payload" } } });
      const verifiedAt = new Date();
      await tx.privateObject.create({ data: { ownerStudentUserId: student.id, dedupeKey: "b".repeat(64), storageKey: "private/phase10-secret-key", mimeType: "image/png", sizeBytes: 10, width: 32, height: 32, sha256: "a".repeat(64), status: "READY", scanStatus: "CLEAN", scanPassed: true, verifiedAt, scanCompletedAt: verifiedAt, storageETag: "phase10-fixture-etag", expiresAt: new Date(Date.now() + 60_000) } });
      return { family, deleteFamily, student, member, deleteStudent };
    });
    familyId = fixture.family.id; deleteFamilyId = fixture.deleteFamily.id; studentId = fixture.student.id; memberId = fixture.member.id; deleteStudentId = fixture.deleteStudent.id;
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = ref.createNestApplication(); configureApplication(app, readAppConfig({ NODE_ENV: "test" })); await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl();
    ownerCookie = await login("owner"); ownerProof = await proof(ownerCookie); memberCookie = await login("member"); memberProof = await proof(memberCookie);
    deleteOwnerCookie = await login("delete-owner"); deleteOwnerProof = await proof(deleteOwnerCookie); adminCookie = await login("admin"); adminProof = await proof(adminCookie);
  });
  afterAll(async () => { await app?.close(); await cleanup(); await prisma.onModuleDestroy(); });

  it("creates an owner-only short-lived export without secrets or other families", async () => {
    const response = await write(`/v1/families/${familyId}/exports`, ownerCookie, ownerProof, "phase10-export-0001", { confirmation: "EXPORT_FAMILY_DATA" });
    expect(response.status).toBe(201); const result = FamilyExportResponseSchema.parse(await response.json());
    const serialized = JSON.stringify(result.archive);
    for (const forbidden of [password, "secret-provider-payload", "private/phase10-secret-key", "Phase 10 Delete Family"]) expect(serialized).not.toContain(forbidden);
    expect(result.archive?.family.id).toBe(familyId); expect(result.archive?.students[0]?.userId).toBe(studentId);
    const denied = await fetch(new URL(`/v1/families/${familyId}/exports/${result.id}`, baseUrl), { headers: { cookie: deleteOwnerCookie } }); expect(denied.status).toBe(404);
  });

  it("separates MEMBER personal deletion from OWNER and purges only that guardian", async () => {
    const ownerDenied = await write(`/v1/families/${familyId}/deletions/personal`, ownerCookie, ownerProof, "phase10-owner-personal-0001", { confirmation: "DELETE_PERSONAL_ACCOUNT" }); expect(ownerDenied.status).toBe(409);
    const requested = await write(`/v1/families/${familyId}/deletions/personal`, memberCookie, memberProof, "phase10-member-personal-0001", { confirmation: "DELETE_PERSONAL_ACCOUNT" });
    expect(requested.status).toBe(201); const deletion = DeletionRequestResponseSchema.parse(await requested.json()); expect(deletion.targetUserId).toBe(memberId);
    expect((await fetch(new URL("/v1/auth/me", baseUrl), { headers: { cookie: memberCookie } })).status).toBe(401);
    const run = RetentionRunResponseSchema.parse(await (await write("/v1/admin/retention-jobs/run", adminCookie, adminProof, "phase10-run-personal-0001", { limit: 10, confirmation: "RUN_RETENTION_JOBS" })).json()); expect(run.succeeded).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.count({ where: { id: memberId } })).toBe(0); expect(await prisma.family.count({ where: { id: familyId, status: "ACTIVE" } })).toBe(1); expect(await prisma.user.count({ where: { id: studentId } })).toBe(1);
  });

  it("marks an owner family deletion pending, revokes sessions, then purges on its deadline", async () => {
    const response = await write(`/v1/families/${deleteFamilyId}/deletions/family`, deleteOwnerCookie, deleteOwnerProof, "phase10-family-delete-0001", { confirmation: "DELETE_FAMILY" });
    const request = DeletionRequestResponseSchema.parse(await response.json()); expect(request.type).toBe("FAMILY"); expect(await prisma.family.count({ where: { id: deleteFamilyId, status: "DELETION_PENDING" } })).toBe(1);
    expect((await fetch(new URL("/v1/auth/me", baseUrl), { headers: { cookie: deleteOwnerCookie } })).status).toBe(401);
    const now = new Date(); await prisma.deletionRequest.update({ where: { id: request.id }, data: { executeAfter: now } }); await prisma.retentionJob.updateMany({ where: { kind: "FAMILY_PURGE", payload: { path: ["requestId"], equals: request.id } }, data: { nextRunAt: now } });
    await write("/v1/admin/retention-jobs/run", adminCookie, adminProof, "phase10-run-family-0001", { limit: 10, confirmation: "RUN_RETENTION_JOBS" });
    expect(await prisma.family.count({ where: { id: deleteFamilyId } })).toBe(0); expect(await prisma.user.count({ where: { id: deleteStudentId } })).toBe(0);
    const repeated = RetentionRunResponseSchema.parse(await (await write("/v1/admin/retention-jobs/run", adminCookie, adminProof, "phase10-run-repeat-0001", { limit: 10, confirmation: "RUN_RETENTION_JOBS" })).json()); expect(repeated.claimed).toBe(0);
  });

  it("retries failed jobs and records only redacted security codes", async () => {
    await prisma.retentionJob.create({ data: { kind: "AI_DEBUG_PURGE", dedupeKey: "phase10-malformed", payload: {}, nextRunAt: new Date() } });
    const first = RetentionRunResponseSchema.parse(await (await write("/v1/admin/retention-jobs/run", adminCookie, adminProof, "phase10-run-failed-0001", { limit: 10, confirmation: "RUN_RETENTION_JOBS" })).json()); expect(first.failed).toBe(1);
    const failed = await prisma.retentionJob.findUniqueOrThrow({ where: { dedupeKey: "phase10-malformed" } }); expect(failed).toMatchObject({ status: "FAILED", attemptCount: 1, lastErrorCode: "JOB_FAILED" });
    const safety = await post("/v1/security/evaluate", ownerCookie, { category: "ANSWER_SEEKING", signalCode: "DIRECT_ANSWER" }); expect(await safety.json()).toEqual({ decision: "SAFE_REDIRECT" });
    const invalid = await post("/v1/security/evaluate", ownerCookie, { category: "SELF_HARM", signalCode: "HIGH_RISK", rawText: "不得记录" }); expect(invalid.status).toBe(400);
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { actorUserId: { not: null }, action: "SECURITY_DECISION" }, orderBy: { createdAt: "desc" } }); expect(JSON.stringify(event.metadata)).not.toContain("不得记录");
  });

  async function login(name: string) { const r = await post("/v1/auth/login", "", { loginId: `${prefix}${name}`, password }); const c = r.headers.get("set-cookie")?.split(";", 1)[0]; if (c === undefined) throw new Error("cookie"); return c; }
  async function proof(cookie: string) { const r = await post("/v1/auth/reauthenticate", cookie, { password }); return z.object({ proof: z.string() }).parse(await r.json()).proof; }
  async function post(path: string, cookie: string, body: unknown) { return fetch(new URL(path, baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) }); }
  async function write(path: string, cookie: string, proofValue: string, key: string, body: unknown) { return fetch(new URL(path, baseUrl), { method: "POST", headers: { cookie, "content-type": "application/json", "x-reauth-proof": proofValue, "idempotency-key": key }, body: JSON.stringify(body) }); }
  async function cleanup() {
    const users = await prisma.user.findMany({ where: { loginId: { startsWith: prefix } }, select: { id: true } }); const ids = users.map((user) => user.id);
    const families = await prisma.family.findMany({ where: { name: { startsWith: "Phase 10" } }, select: { id: true } }); const familyIds = families.map((family) => family.id);
    const requests = await prisma.deletionRequest.findMany({ where: { OR: [{ familyId: { in: familyIds } }, { requestedByUserId: { in: ids } }] }, select: { id: true } }); const requestIds = requests.map((request) => request.id);
    const exports = await prisma.familyExportRequest.findMany({ where: { OR: [{ familyId: { in: familyIds } }, { requestedByUserId: { in: ids } }] }, select: { id: true } });
    await prisma.retentionJob.deleteMany({ where: { OR: [{ dedupeKey: "phase10-malformed" }, { dedupeKey: { startsWith: "private-object:" } }, { dedupeKey: { in: [...requestIds.map((id) => `personal:${id}`), ...requestIds.map((id) => `family:${id}`), ...exports.map((item) => `export:${item.id}`)] } }] } });
    await prisma.deletionRequest.deleteMany({ where: { id: { in: requestIds } } }); await prisma.familyExportRequest.deleteMany({ where: { id: { in: exports.map((item) => item.id) } } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: ids } } }); await prisma.operation.deleteMany({ where: { userId: { in: ids } } }); await prisma.family.deleteMany({ where: { id: { in: familyIds } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});
