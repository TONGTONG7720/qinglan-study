import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { WeeklyReportController } from "./weekly-report.controller.js";
import { WeeklyReportService } from "./weekly-report.service.js";

@Module({ imports: [PrismaModule, AuthModule], controllers: [WeeklyReportController], providers: [WeeklyReportService, IdempotencyService] })
export class WeeklyReportModule {}
