import {
  AcceptOwnershipTransferInputSchema,
  CreateJoinAuthorizationInputSchema,
  CreateStudentInputSchema,
  DisableStudentInputSchema,
  GrantGuardianRelationInputSchema,
  GrantStudentConsentInputSchema,
  LeaveFamilyInputSchema,
  ProposeOwnershipTransferInputSchema,
  RemoveMemberInputSchema,
  RevokeGuardianRelationInputSchema,
  RevokeStudentConsentInputSchema,
} from "@study/contracts";
import type {
  CurrentUser,
  FamilySummary,
  JoinAuthorization,
  OwnershipTransfer,
  StudentSummary,
  StudentConsent,
} from "@study/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import {
  readIdempotencyKey,
  readReauthenticationProof,
  readSessionCookie,
} from "../common/http/authenticated-request.js";
import { FamilyService } from "./family.service.js";

const UuidSchema = z.uuid();
interface MutationResult { id: string; status: string }

@Controller("v1/families")
export class FamilyController {
  constructor(
    private readonly families: FamilyService,
    private readonly auth: AuthService,
    private readonly proofs: ReauthenticationProofService,
  ) {}

  @Get(":familyId")
  async get(@Req() request: Request, @Param("familyId") familyId: string): Promise<FamilySummary> {
    return this.families.get(await this.readActor(request), this.uuid(familyId));
  }

  @Post(":familyId/join-authorizations")
  async authorizeJoin(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Body() body: unknown,
  ): Promise<JoinAuthorization> {
    const input = this.parse(CreateJoinAuthorizationInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.authorizeJoin(
      actor,
      this.uuid(familyId),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post(":familyId/students")
  async createStudent(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Body() body: unknown,
  ): Promise<StudentSummary> {
    const input = this.parse(CreateStudentInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.createStudent(
      actor,
      this.uuid(familyId),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post(":familyId/students/:studentUserId/disable")
  async disableStudent(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Param("studentUserId") studentUserId: string,
    @Body() body: unknown,
  ): Promise<StudentSummary> {
    this.parse(DisableStudentInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.disableStudent(
      actor,
      this.uuid(familyId),
      this.uuid(studentUserId),
      readIdempotencyKey(request),
    );
  }

  @Post(":familyId/students/:studentUserId/consents")
  async grantStudentConsent(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Param("studentUserId") studentUserId: string,
    @Body() body: unknown,
  ): Promise<StudentConsent> {
    const input = this.parse(GrantStudentConsentInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.grantStudentConsent(
      actor,
      this.uuid(familyId),
      this.uuid(studentUserId),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post(":familyId/students/:studentUserId/consents/revoke")
  async revokeStudentConsent(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Param("studentUserId") studentUserId: string,
    @Body() body: unknown,
  ): Promise<StudentConsent> {
    const input = this.parse(RevokeStudentConsentInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.revokeStudentConsent(
      actor,
      this.uuid(familyId),
      this.uuid(studentUserId),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post(":familyId/relations/grant")
  async grantRelation(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Body() body: unknown,
  ): Promise<MutationResult> {
    const input = this.parse(GrantGuardianRelationInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.grantRelation(actor, this.uuid(familyId), input, readIdempotencyKey(request));
  }

  @Post(":familyId/relations/revoke")
  async revokeRelation(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Body() body: unknown,
  ): Promise<MutationResult> {
    const input = this.parse(RevokeGuardianRelationInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.revokeRelation(actor, this.uuid(familyId), input, readIdempotencyKey(request));
  }

  @Post(":familyId/members/:memberUserId/remove")
  async removeMember(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Param("memberUserId") memberUserId: string,
    @Body() body: unknown,
  ): Promise<MutationResult> {
    this.parse(RemoveMemberInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.removeMember(
      actor,
      this.uuid(familyId),
      this.uuid(memberUserId),
      readIdempotencyKey(request),
    );
  }

  @Post(":familyId/leave")
  async leave(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Body() body: unknown,
  ): Promise<MutationResult> {
    this.parse(LeaveFamilyInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.leave(actor, this.uuid(familyId), readIdempotencyKey(request));
  }

  @Post(":familyId/ownership-transfers")
  async proposeTransfer(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Body() body: unknown,
  ): Promise<OwnershipTransfer> {
    const input = this.parse(ProposeOwnershipTransferInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.proposeOwnershipTransfer(
      actor,
      this.uuid(familyId),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post(":familyId/ownership-transfers/:transferId/accept")
  @HttpCode(200)
  async acceptTransfer(
    @Req() request: Request,
    @Param("familyId") familyId: string,
    @Param("transferId") transferId: string,
    @Body() body: unknown,
  ): Promise<OwnershipTransfer> {
    this.parse(AcceptOwnershipTransferInputSchema, body);
    const actor = await this.readWriteActor(request);
    return this.families.acceptOwnershipTransfer(
      actor,
      this.uuid(familyId),
      this.uuid(transferId),
      readIdempotencyKey(request),
    );
  }

  private async readActor(request: Request): Promise<CurrentUser> {
    return this.auth.resolve(readSessionCookie(request));
  }

  private async readWriteActor(request: Request): Promise<CurrentUser> {
    const rawToken = readSessionCookie(request);
    const actor = await this.auth.resolve(rawToken);
    if (!this.proofs.verify(readReauthenticationProof(request), actor.id, rawToken)) {
      throw new UnauthorizedException();
    }
    return actor;
  }

  private uuid(value: string): string {
    const parsed = UuidSchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return parsed.data;
  }

  private parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return parsed.data;
  }
}
