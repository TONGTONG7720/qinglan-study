import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../common/prisma/prisma.service.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("keeps liveness independent from database readiness", () => {
    const queryRaw = vi.fn();
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    expect(controller.getLiveness()).toEqual({
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
    const controller = new HealthController(prisma);

    await expect(controller.getReadiness()).resolves.toEqual({
      status: "ok",
      service: "api",
      version: "0.1.0",
      checks: { database: "ok", migrations: "ok" },
    });
  });

  it("rejects readiness when the expected production migration is absent", async () => {
    const previous = process.env.EXPECTED_MIGRATION_NAME;
    process.env.EXPECTED_MIGRATION_NAME = "20260827032650_question_bank_foundation";
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ result: 1 }])
        .mockResolvedValueOnce([{ ready: false }]),
    } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    try {
      await expect(controller.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
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
    const controller = new HealthController(prisma);

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
