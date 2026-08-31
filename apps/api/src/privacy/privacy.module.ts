import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { ObjectStorageModule } from "../common/storage/object-storage.module.js";
import { PrivacyController } from "./privacy.controller.js";
import { PrivacyService } from "./privacy.service.js";
import { RetentionJobService } from "./retention-job.service.js";
import { SecurityPolicyService } from "./security-policy.service.js";

@Module({ imports: [PrismaModule, AuthModule, ObjectStorageModule], controllers: [PrivacyController], providers: [PrivacyService, RetentionJobService, SecurityPolicyService, IdempotencyService] })
export class PrivacyModule {}
