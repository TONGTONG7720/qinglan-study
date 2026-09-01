import type { HealthResponse } from "@study/contracts";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../common/prisma/prisma.service.js";
import { ClamAvScannerService } from "../common/storage/clamav-scanner.service.js";
import { S3ObjectStorageService } from "../common/storage/s3-object-storage.service.js";

interface ReadinessResponse extends HealthResponse {
  checks: {
    database: "ok";
    migrations: "ok";
    objectStorage: "ok" | "disabled";
    malwareScanner: "ok" | "disabled";
  };
}

@Controller("v1/health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3ObjectStorageService,
    private readonly scanner: ClamAvScannerService,
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return { status: "ok", service: "api", version: "0.1.0" };
  }

  @Get("live")
  getLiveness(): HealthResponse {
    return this.getHealth();
  }

  @Get("ready")
  async getReadiness(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw<{ result: number }[]>`SELECT 1 AS result`;
      const expectedMigrationName = process.env.EXPECTED_MIGRATION_NAME?.trim();
      if (expectedMigrationName !== undefined && expectedMigrationName.length > 0) {
        const [migrationStatus] = await this.prisma.$queryRaw<{ ready: boolean }[]>`
          SELECT
            EXISTS (
              SELECT 1
              FROM "_prisma_migrations"
              WHERE migration_name = ${expectedMigrationName}
                AND finished_at IS NOT NULL
                AND rolled_back_at IS NULL
            )
            AND NOT EXISTS (
              SELECT 1
              FROM "_prisma_migrations"
              WHERE finished_at IS NULL
                AND rolled_back_at IS NULL
            ) AS ready
        `;
        if (migrationStatus?.ready !== true) {
          throw new ServiceUnavailableException();
        }
      }
      if (this.storage.isEnabled() !== this.scanner.isEnabled()) {
        throw new ServiceUnavailableException();
      }
      if (this.storage.isEnabled()) {
        await Promise.all([this.storage.probe(), this.scanner.probe()]);
      }
    } catch {
      throw new ServiceUnavailableException();
    }
    return {
      ...this.getHealth(),
      checks: {
        database: "ok",
        migrations: "ok",
        objectStorage: this.storage.isEnabled() ? "ok" : "disabled",
        malwareScanner: this.scanner.isEnabled() ? "ok" : "disabled",
      },
    };
  }
}
