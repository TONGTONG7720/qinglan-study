import { Module } from "@nestjs/common";

import { PrismaModule } from "../common/prisma/prisma.module.js";
import { ObjectStorageModule } from "../common/storage/object-storage.module.js";
import { HealthController } from "./health.controller.js";

@Module({ imports: [PrismaModule, ObjectStorageModule], controllers: [HealthController] })
export class HealthModule {}
