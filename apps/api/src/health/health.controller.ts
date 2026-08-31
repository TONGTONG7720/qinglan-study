import type { HealthResponse } from "@study/contracts";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../common/prisma/prisma.service.js";

interface ReadinessResponse extends HealthResponse {
  checks: {
    database: "ok";
    migrations: "ok";
  };
}

@Controller("v1/health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
    } catch {
      throw new ServiceUnavailableException();
    }
    return {
      ...this.getHealth(),
      checks: { database: "ok", migrations: "ok" },
    };
  }
}
