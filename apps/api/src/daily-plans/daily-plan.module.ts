import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { DailyPlanController } from "./daily-plan.controller.js";
import { DailyPlanService } from "./daily-plan.service.js";
import { DatabasePlanCandidateProvider } from "./plan-candidate.provider.js";

@Module({
  imports: [PrismaModule, AuthModule], controllers: [DailyPlanController],
  providers: [DailyPlanService, IdempotencyService, DatabasePlanCandidateProvider],
})
export class DailyPlanModule {}
