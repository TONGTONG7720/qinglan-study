import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { QuestionBankController } from "./question-bank.controller.js";
import { QuestionBankService } from "./question-bank.service.js";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [QuestionBankController],
  providers: [QuestionBankService, IdempotencyService],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
