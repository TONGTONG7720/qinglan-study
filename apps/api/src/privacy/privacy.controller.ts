import { CreateFamilyExportInputSchema, FamilyDeletionInputSchema, PersonalDeletionInputSchema, RunRetentionJobsInputSchema, SecurityPolicyInputSchema } from "@study/contracts";
import type { CurrentUser, DeletionRequestResponse, FamilyExportResponse, RetentionRunResponse } from "@study/contracts";
import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import { readIdempotencyKey, readReauthenticationProof, readSessionCookie } from "../common/http/authenticated-request.js";
import { PrivacyService } from "./privacy.service.js";
import { RetentionJobService } from "./retention-job.service.js";
import { SecurityPolicyService } from "./security-policy.service.js";

@Controller("v1")
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService, private readonly jobs: RetentionJobService, private readonly security: SecurityPolicyService, private readonly auth: AuthService, private readonly proofs: ReauthenticationProofService) {}
  @Post("families/:familyId/exports") async createExport(@Req() request: Request, @Param("familyId") familyId: string, @Body() body: unknown): Promise<FamilyExportResponse> { return this.privacy.createExport(await this.writeActor(request), this.uuid(familyId), this.parse(CreateFamilyExportInputSchema, body), readIdempotencyKey(request)); }
  @Get("families/:familyId/exports/:exportId") async getExport(@Req() request: Request, @Param("familyId") familyId: string, @Param("exportId") exportId: string): Promise<FamilyExportResponse> { return this.privacy.getExport(await this.readActor(request), this.uuid(familyId), this.uuid(exportId)); }
  @Post("families/:familyId/deletions/personal") async personal(@Req() request: Request, @Param("familyId") familyId: string, @Body() body: unknown): Promise<DeletionRequestResponse> { return this.privacy.requestPersonalDeletion(await this.writeActor(request), this.uuid(familyId), this.parse(PersonalDeletionInputSchema, body), readIdempotencyKey(request)); }
  @Post("families/:familyId/deletions/family") async family(@Req() request: Request, @Param("familyId") familyId: string, @Body() body: unknown): Promise<DeletionRequestResponse> { return this.privacy.requestFamilyDeletion(await this.writeActor(request), this.uuid(familyId), this.parse(FamilyDeletionInputSchema, body), readIdempotencyKey(request)); }
  @Post("admin/retention-jobs/run") async run(@Req() request: Request, @Body() body: unknown): Promise<RetentionRunResponse> { readIdempotencyKey(request); return this.jobs.run(await this.writeActor(request), this.parse(RunRetentionJobsInputSchema, body)); }
  @Post("security/evaluate") async evaluate(@Req() request: Request, @Body() body: unknown) { return this.security.evaluate(await this.readActor(request), this.parse(SecurityPolicyInputSchema, body)); }
  private async readActor(request: Request): Promise<CurrentUser> { return this.auth.resolve(readSessionCookie(request)); }
  private async writeActor(request: Request): Promise<CurrentUser> { const raw = readSessionCookie(request); const actor = await this.auth.resolve(raw); if (!this.proofs.verify(readReauthenticationProof(request), actor.id, raw)) throw new UnauthorizedException(); return actor; }
  private uuid(value: string): string { return this.parse(z.uuid(), value); }
  private parse<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success) throw new BadRequestException(); return parsed.data; }
}
