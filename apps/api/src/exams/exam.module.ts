import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { ExamController } from "./exam.controller.js";
import { ExamService } from "./exam.service.js";

@Module({ imports: [PrismaModule, AuthModule], controllers: [ExamController], providers: [ExamService, IdempotencyService] })
export class ExamModule {}
