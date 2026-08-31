import { Global, Module } from "@nestjs/common";

import { FamilyAccessService } from "../auth/family-access.service.js";
import { ScopeAuthorizationService } from "../auth/scope-authorization.service.js";
import { StudentRecordAccessService } from "../auth/student-record-access.service.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  providers: [PrismaService, ScopeAuthorizationService, FamilyAccessService, StudentRecordAccessService],
  exports: [PrismaService, ScopeAuthorizationService, FamilyAccessService, StudentRecordAccessService],
})
export class PrismaModule {}
