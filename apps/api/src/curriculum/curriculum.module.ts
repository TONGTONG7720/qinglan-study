import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { CurriculumController } from "./curriculum.controller.js";
import { CurriculumService } from "./curriculum.service.js";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CurriculumController],
  providers: [CurriculumService, IdempotencyService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
