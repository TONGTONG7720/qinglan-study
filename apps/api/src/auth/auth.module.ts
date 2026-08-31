import { Module } from "@nestjs/common";

import { PrismaModule } from "../common/prisma/prisma.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { ReauthenticationProofService } from "./reauthentication-proof.service.js";
import { SessionTokenService } from "./session-token.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionTokenService, ReauthenticationProofService],
  exports: [AuthService, ReauthenticationProofService],
})
export class AuthModule {}
