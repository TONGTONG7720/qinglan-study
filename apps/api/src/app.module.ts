import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AdminOverviewModule } from "./admin/admin-overview.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AiModule } from "./ai/ai.module.js";
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

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 300, blockDuration: 60_000 },
    ]),
    HealthModule,
    AuthModule,
    InvitationModule,
    FamilyModule,
    CurriculumModule,
    DailyPlanModule,
    AiModule,
    TutorModule,
    MasteryModule,
    ExamModule,
    WeeklyReportModule,
    AdminOverviewModule,
    PrivacyModule,
    QuestionBankModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
