import { Module } from "@nestjs/common";
import type { MiddlewareConsumer, NestModule } from "@nestjs/common";

import { AdminOverviewModule } from "./admin/admin-overview.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AiModule } from "./ai/ai.module.js";
import { RequestIdMiddleware } from "./common/http/request-id.middleware.js";
import { CurriculumModule } from "./curriculum/curriculum.module.js";
import { DailyPlanModule } from "./daily-plans/daily-plan.module.js";
import { ExamModule } from "./exams/exam.module.js";
import { FamilyModule } from "./families/family.module.js";
import { HealthModule } from "./health/health.module.js";
import { InvitationModule } from "./invitations/invitation.module.js";
import { MasteryModule } from "./mastery/mastery.module.js";
import { PrivacyModule } from "./privacy/privacy.module.js";
import { QuestionBankModule } from "./question-bank/question-bank.module.js";
import { WeeklyReportModule } from "./reports/weekly-report.module.js";
import { TutorModule } from "./tutor/tutor.module.js";

@Module({ imports: [HealthModule, AuthModule, InvitationModule, FamilyModule, CurriculumModule, DailyPlanModule, AiModule, TutorModule, MasteryModule, ExamModule, WeeklyReportModule, AdminOverviewModule, PrivacyModule, QuestionBankModule] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
