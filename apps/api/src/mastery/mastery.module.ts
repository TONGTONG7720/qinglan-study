import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { MasteryController } from "./mastery.controller.js";
import { MasteryService } from "./mastery.service.js";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MasteryController],
  providers: [MasteryService, IdempotencyService],
  exports: [MasteryService],
})
export class MasteryModule {}
