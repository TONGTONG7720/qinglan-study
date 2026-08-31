import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../common/prisma/prisma.service.js";
import type { ClamAvScannerService } from "../common/storage/clamav-scanner.service.js";
import type { S3ObjectStorageService } from "../common/storage/s3-object-storage.service.js";
import { HealthController } from "./health.controller.js";

function controller(prisma: PrismaService): HealthController {
  const storage = { isEnabled: () => false, probe: vi.fn() } as unknown as S3ObjectStorageService;
  const scanner = { isEnabled: () => false, probe: vi.fn() } as unknown as ClamAvScannerService;
  return new HealthController(prisma, storage, scanner);
}

describe("HealthController", () => {
  it("keeps liveness independent from database readiness", () => {
    const queryRaw = vi.fn();
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const health = controller(prisma);

    expect(health.getLiveness()).toEqual({
      status: "ok",
      service: "api",
      version: "0.1.0",
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("reports readiness only after a successful database probe", async () => {
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ result: 1 }])
        .mockResolvedValueOnce([{ ready: true }]),
    } as unknown as PrismaService;
    const health = controller(prisma);

    await expect(health.getReadiness()).resolves.toEqual({
      status: "ok",
      service: "api",
      version: "0.1.0",
      checks: { database: "ok", migrations: "ok", objectStorage: "disabled", malwareScanner: "disabled" },
    });
  });

  it("rejects readiness when the expected production migration is absent", async () => {
    const previous = process.env.EXPECTED_MIGRATION_NAME;
    process.env.EXPECTED_MIGRATION_NAME = "20260831123000_private_object_storage_ocr";
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ result: 1 }])
        .mockResolvedValueOnce([{ ready: false }]),
    } as unknown as PrismaService;
    const health = controller(prisma);

    try {
      await expect(health.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, "EXPECTED_MIGRATION_NAME");
      } else {
        process.env.EXPECTED_MIGRATION_NAME = previous;
      }
    }
  });

  it("returns an unavailable readiness state when the database probe fails", async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error("database unavailable")),
    } as unknown as PrismaService;
    const health = controller(prisma);

    await expect(health.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
