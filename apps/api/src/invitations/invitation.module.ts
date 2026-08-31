import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PasswordService } from "../auth/password.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { InvitationController } from "./invitation.controller.js";
import { InvitationService } from "./invitation.service.js";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InvitationController],
  providers: [InvitationService, PasswordService, IdempotencyService],
  exports: [InvitationService],
})
export class InvitationModule {}
