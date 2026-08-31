import { Module } from "@nestjs/common";

import { PrismaModule } from "../common/prisma/prisma.module.js";
import { HealthController } from "./health.controller.js";

@Module({ imports: [PrismaModule], controllers: [HealthController] })
export class HealthModule {}
