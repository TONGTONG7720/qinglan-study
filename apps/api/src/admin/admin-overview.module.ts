import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { AdminOverviewController } from "./admin-overview.controller.js";
import { AdminOverviewService } from "./admin-overview.service.js";

@Module({ imports: [PrismaModule, AuthModule], controllers: [AdminOverviewController], providers: [AdminOverviewService] })
export class AdminOverviewModule {}
