import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PasswordService } from "../auth/password.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { FamilyController } from "./family.controller.js";
import { FamilyService } from "./family.service.js";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FamilyController],
  providers: [FamilyService, PasswordService, IdempotencyService],
  exports: [FamilyService],
})
export class FamilyModule {}
