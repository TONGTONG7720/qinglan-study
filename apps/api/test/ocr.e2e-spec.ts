import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  OcrResultSchema,
  PrivateObjectReadGrantResponseSchema,
  PrivateObjectResponseSchema,
  RetentionRunResponseSchema,
} from "@study/contracts";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";
import { ClamAvScannerService } from "../src/common/storage/clamav-scanner.service.js";
import { S3ObjectStorageService } from "../src/common/storage/s3-object-storage.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const prefix = "phase6-ocr-";
const password = "fictional-password-123";
const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

interface ImageFixture {
  bytes: Buffer;
  mimeType: "image/png";
  width: number;
  height: number;
  sha256: string;
}

describe("private S3 upload, malware scan and OCR workflow", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let storage: S3ObjectStorageService;
  let baseUrl: string;
  let studentA: string;
  let cookieA: string;
  let cookieB: string;
  let proofA: string;
  let proofB: string;
  let adminCookie: string;
  let adminProof: string;
  let requestSequence = 0;

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: databaseUrl,
      NODE_ENV: "test",
      MODEL_PROVIDER: "fake",
      OBJECT_STORAGE_PROVIDER: "s3",
      OBJECT_SCAN_PROVIDER: "clamav",
      OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:19000",
      OBJECT_STORAGE_REGION: "us-east-1",
      OBJECT_STORAGE_BUCKET: "qinglang-private-e2e",
      OBJECT_STORAGE_ACCESS_KEY_ID: "qinglang-ocr-service",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "qinglang-e2e-service-secret-7pL3cV9nR2xK8mQ4",
      OBJECT_STORAGE_FORCE_PATH_STYLE: "true",
      OBJECT_STORAGE_UPLOAD_TTL_SECONDS: "300",
      OBJECT_STORAGE_READ_TTL_SECONDS: "120",
      OBJECT_STORAGE_RETENTION_DAYS: "30",
      OBJECT_STORAGE_SSE: "AES256",
      CLAMAV_HOST: "127.0.0.1",
      CLAMAV_PORT: "13310",
      CLAMAV_TIMEOUT_MS: "30000",
    });
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    const hash = await new PasswordService().hash(password);
    const ids = await prisma.$transaction(async (transaction) => {
      await transaction.user.create({
        data: { loginId: `${prefix}admin`, passwordHash: hash, displayName: "OCR管理员", roles: ["ADMIN"] },
      });
      const ownerA = await transaction.user.create({
        data: { loginId: `${prefix}owner-a`, passwordHash: hash, displayName: "A家长", roles: ["GUARDIAN"] },
      });
      const a = await transaction.user.create({
        data: { loginId: `${prefix}student-a`, passwordHash: hash, displayName: "A学生", roles: ["STUDENT"] },
      });
      const ownerB = await transaction.user.create({
        data: { loginId: `${prefix}owner-b`, passwordHash: hash, displayName: "B家长", roles: ["GUARDIAN"] },
      });
      const b = await transaction.user.create({
        data: { loginId: `${prefix}student-b`, passwordHash: hash, displayName: "B学生", roles: ["STUDENT"] },
      });
      await transaction.family.create({
        data: {
          name: "Phase 6 OCR Family A",
          memberships: { create: [{ userId: ownerA.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: a.id, role: "STUDENT" }] },
          studentProfiles: { create: { userId: a.id, grade: 8 } },
        },
      });
      await transaction.family.create({
        data: {
          name: "Phase 6 OCR Family B",
          memberships: { create: [{ userId: ownerB.id, role: "GUARDIAN", accessLevel: "OWNER" }, { userId: b.id, role: "STUDENT" }] },
          studentProfiles: { create: { userId: b.id, grade: 8 } },
        },
      });
      return { a, b };
    });
    studentA = ids.a.id;
    const reference = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = reference.createNestApplication();
    configureApplication(app, readAppConfig(process.env));
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
    storage = app.get(S3ObjectStorageService);
    await Promise.all([storage.probe(), app.get(ClamAvScannerService).probe()]);
    cookieA = await login("student-a");
    cookieB = await login("student-b");
    adminCookie = await login("admin");
    proofA = await reauthenticate(cookieA);
    proofB = await reauthenticate(cookieB);
    adminProof = await reauthenticate(adminCookie);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it("keeps the bucket private and completes verified low-confidence OCR", async () => {
    const readiness = await fetch(new URL("/v1/health/ready", baseUrl));
    expect(readiness.status).toBe(200);
    expect(await readiness.json()).toMatchObject({
      checks: { objectStorage: "ok", malwareScanner: "ok" },
    });
    const image = await imageWithHashPrefix("a");
    const object = await createObject(image);
    await assertUploadCors(object);
    await upload(object, image.bytes);
    expect(object.status).toBe("PENDING_UPLOAD");
    expect(JSON.stringify(object)).not.toContain("storageKey");
    const cross = await fetch(new URL(`/v1/private-objects/${object.id}`, baseUrl), {
      headers: { cookie: cookieB },
    });
    expect(cross.status).toBe(404);

    const completed = await complete(object.id);
    expect(completed).toMatchObject({ status: "READY", errorCode: null, upload: null });
    const stored = await prisma.privateObject.findUniqueOrThrow({ where: { id: object.id } });
    expect(stored).toMatchObject({ scanStatus: "CLEAN", scanPassed: true });
    expect(stored.storageVersionId).not.toBeNull();
    const anonymous = await fetch(`http://127.0.0.1:19000/qinglang-private-e2e/${stored.storageKey}`);
    expect(anonymous.status).toBe(403);
    const readGrant = PrivateObjectReadGrantResponseSchema.parse(await (await post(
      `/v1/private-objects/${object.id}/presign-read`,
      cookieA,
      proofA,
      { confirmation: "READ_PRIVATE_OBJECT" },
    )).json());
    const privateRead = await fetch(readGrant.url);
    expect(privateRead.status).toBe(200);
    expect(Buffer.from(await privateRead.arrayBuffer()).equals(image.bytes)).toBe(true);
    const crossRead = await post(
      `/v1/private-objects/${object.id}/presign-read`,
      cookieB,
      proofB,
      { confirmation: "READ_PRIVATE_OBJECT" },
    );
    expect(crossRead.status).toBe(404);

    const first = await post(`/v1/students/${studentA}/questions/ocr`, cookieA, proofA, {
      objectId: object.id,
      confirmation: "START_OCR",
    });
    const review = OcrResultSchema.parse(await first.json());
    expect(review.status).toBe("OCR_REVIEW");
    const second = await post(`/v1/students/${studentA}/questions/ocr`, cookieA, proofA, {
      objectId: object.id,
      confirmation: "START_OCR",
    });
    expect(OcrResultSchema.parse(await second.json()).questionId).toBe(review.questionId);
    expect(await prisma.modelCall.count({ where: { purpose: "OCR", userId: studentA } })).toBe(1);
    const confirmed = await post(`/v1/questions/${review.questionId}/confirm-ocr`, cookieA, proofA, {
      confirmedText: "学生确认后的题目",
      confirmation: "CONFIRM_OCR",
    });
    expect(OcrResultSchema.parse(await confirmed.json()).status).toBe("READY");
  }, 90_000);

  it("rejects EICAR content and removes the untrusted staging object", async () => {
    const base = await imageWithHashPrefix();
    const bytes = Buffer.from(eicar, "ascii");
    const infected: ImageFixture = {
      ...base,
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    const object = await createAndUpload(infected);
    const storedBefore = await prisma.privateObject.findUniqueOrThrow({ where: { id: object.id } });
    const uploadKey = storedBefore.uploadKey;
    expect(uploadKey).not.toBeNull();
    const completed = await complete(object.id);
    expect(completed).toMatchObject({
      status: "QUARANTINED",
      errorCode: "MALWARE_DETECTED",
      upload: null,
    });
    if (uploadKey === null) throw new Error("missing upload key");
    expect(await storage.headObject(uploadKey)).toBeNull();
    expect(await storage.headObject(storedBefore.storageKey)).toBeNull();
  }, 90_000);

  it("reissues an isolated upload grant after a missing upload", async () => {
    const image = await imageWithHashPrefix();
    const object = await createObject(image);
    const missing = await complete(object.id);
    expect(missing).toMatchObject({ status: "QUARANTINED", errorCode: "UPLOAD_NOT_FOUND" });
    const retried = PrivateObjectResponseSchema.parse(await (await post(
      `/v1/private-objects/${object.id}/retry-upload`,
      cookieA,
      proofA,
      { confirmation: "RETRY_PRIVATE_OBJECT_UPLOAD" },
    )).json());
    expect(retried.status).toBe("PENDING_UPLOAD");
    await upload(retried, image.bytes);
    expect((await complete(object.id)).status).toBe("READY");
  }, 90_000);

  it("uses a new budget reservation when failed OCR is explicitly retried", async () => {
    const releasedBefore = await prisma.budgetReservation.count({
      where: { userId: studentA, purpose: "OCR", status: "RELEASED" },
    });
    const settledBefore = await prisma.budgetReservation.count({
      where: { userId: studentA, purpose: "OCR", status: "SETTLED" },
    });
    const image = await imageWithHashPrefix("f");
    const object = await createAndUpload(image);
    expect((await complete(object.id)).status).toBe("READY");
    const failed = OcrResultSchema.parse(await (await post(
      `/v1/students/${studentA}/questions/ocr`,
      cookieA,
      proofA,
      { objectId: object.id, confirmation: "START_OCR" },
    )).json());
    expect(failed.status).toBe("FAILED");
    const retried = OcrResultSchema.parse(await (await post(
      `/v1/questions/${failed.questionId}/retry-ocr`,
      cookieA,
      proofA,
      { confirmation: "RETRY_OCR" },
    )).json());
    expect(retried.status).toBe("READY");
    expect(await prisma.budgetReservation.count({
      where: { userId: studentA, purpose: "OCR", status: "RELEASED" },
    })).toBe(releasedBefore + 1);
    expect(await prisma.budgetReservation.count({
      where: { userId: studentA, purpose: "OCR", status: "SETTLED" },
    })).toBe(settledBefore + 1);
  }, 90_000);

  it("confirms physical deletion for user requests and retention expiry", async () => {
    const image = await imageWithHashPrefix();
    const explicit = await createAndUpload(image);
    expect((await complete(explicit.id)).status).toBe("READY");
    const explicitRow = await prisma.privateObject.findUniqueOrThrow({ where: { id: explicit.id } });
    const deleted = PrivateObjectResponseSchema.parse(await (await post(
      `/v1/private-objects/${explicit.id}/delete`,
      cookieA,
      proofA,
      { confirmation: "DELETE_PRIVATE_OBJECT" },
    )).json());
    expect(deleted.status).toBe("DELETED");
    expect(await storage.headObject(explicitRow.storageKey, explicitRow.storageVersionId)).toBeNull();
    const deletedRow = await prisma.privateObject.findUniqueOrThrow({ where: { id: explicit.id } });
    expect(deletedRow.deletionReceipt).not.toBeNull();

    const retained = await createAndUpload(await imageWithHashPrefix());
    expect((await complete(retained.id)).status).toBe("READY");
    const retentionRow = await prisma.privateObject.findUniqueOrThrow({ where: { id: retained.id } });
    const now = new Date();
    await prisma.privateObject.update({ where: { id: retained.id }, data: { expiresAt: now } });
    await prisma.retentionJob.update({
      where: { dedupeKey: `private-object:${retained.id}` },
      data: { nextRunAt: now },
    });
    const run = RetentionRunResponseSchema.parse(await (await post(
      "/v1/admin/retention-jobs/run",
      adminCookie,
      adminProof,
      { limit: 10, confirmation: "RUN_RETENTION_JOBS" },
      "ocr-retention-run-0001",
    )).json());
    expect(run.succeeded).toBeGreaterThanOrEqual(1);
    expect(await storage.headObject(retentionRow.storageKey, retentionRow.storageVersionId)).toBeNull();
    expect(await prisma.privateObject.findUniqueOrThrow({ where: { id: retained.id } })).toMatchObject({
      status: "DELETED",
      lastErrorCode: null,
    });
  }, 120_000);

  async function createAndUpload(image: ImageFixture) {
    const object = await createObject(image);
    await upload(object, image.bytes);
    return object;
  }

  async function createObject(image: ImageFixture) {
    requestSequence += 1;
    const response = await post(
      `/v1/students/${studentA}/private-objects/presign`,
      cookieA,
      proofA,
      {
        mimeType: image.mimeType,
        sizeBytes: image.bytes.byteLength,
        width: image.width,
        height: image.height,
        sha256: image.sha256,
      },
      `ocr-private-object-${String(requestSequence).padStart(4, "0")}`,
    );
    expect(response.status).toBe(201);
    return PrivateObjectResponseSchema.parse(await response.json());
  }

  async function upload(object: z.infer<typeof PrivateObjectResponseSchema>, bytes: Uint8Array): Promise<void> {
    if (object.upload === null) throw new Error("missing upload grant");
    const response = await fetch(object.upload.url, {
      method: object.upload.method,
      headers: object.upload.headers,
      body: Buffer.from(bytes),
    });
    if (response.status !== 200) {
      throw new Error(`upload failed with ${String(response.status)}: ${await response.text()}`);
    }
  }

  async function assertUploadCors(object: z.infer<typeof PrivateObjectResponseSchema>): Promise<void> {
    if (object.upload === null) throw new Error("missing upload grant");
    const response = await fetch(object.upload.url, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:3000",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": Object.keys(object.upload.headers).join(","),
      },
    });
    expect(response.ok).toBe(true);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:3000");
    expect(response.headers.get("access-control-allow-methods")).toContain("PUT");
  }

  async function complete(objectId: string) {
    const response = await post(
      `/v1/private-objects/${objectId}/complete`,
      cookieA,
      proofA,
      { confirmation: "COMPLETE_PRIVATE_OBJECT_UPLOAD" },
    );
    expect(response.status).toBe(201);
    return PrivateObjectResponseSchema.parse(await response.json());
  }

  async function imageWithHashPrefix(hashPrefix?: string): Promise<ImageFixture> {
    for (let index = 0; index < 2_000; index += 1) {
      const bytes = await sharp({
        create: {
          width: 64,
          height: 48,
          channels: 3,
          background: { r: index % 256, g: Math.floor(index / 8) % 256, b: Math.floor(index / 64) % 256 },
        },
      }).png({ compressionLevel: 6 }).toBuffer();
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (hashPrefix === undefined || sha256.startsWith(hashPrefix)) {
        return { bytes, mimeType: "image/png", width: 64, height: 48, sha256 };
      }
    }
    throw new Error(`unable to generate image with hash prefix ${hashPrefix ?? "unspecified"}`);
  }

  async function login(suffix: string): Promise<string> {
    const response = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: `${prefix}${suffix}`, password }),
    });
    const value = response.headers.get("set-cookie")?.split(";", 1)[0];
    if (value === undefined) throw new Error("missing cookie");
    return value;
  }

  async function reauthenticate(cookie: string): Promise<string> {
    const response = await fetch(new URL("/v1/auth/reauthenticate", baseUrl), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return z.object({ proof: z.string() }).parse(await response.json()).proof;
  }

  async function post(
    path: string,
    cookie: string,
    proof: string,
    body: unknown,
    idempotencyKey?: string,
  ): Promise<Response> {
    return fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-reauth-proof": proof,
        ...(idempotencyKey === undefined ? {} : { "idempotency-key": idempotencyKey }),
      },
      body: JSON.stringify(body),
    });
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { loginId: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    const objects = await prisma.privateObject.findMany({
      where: { ownerStudentUserId: { in: ids } },
      select: { id: true },
    });
    await prisma.retentionJob.deleteMany({
      where: { dedupeKey: { in: objects.map((object) => `private-object:${object.id}`) } },
    });
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { actorUserId: { in: ids } },
          { resourceType: "PrivateObject", resourceId: { in: objects.map((object) => object.id) } },
        ],
      },
    });
    await prisma.family.deleteMany({ where: { name: { startsWith: "Phase 6 OCR" } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});
