import {
  CreateMistakeInputSchema,
  MasteryEvidenceInputSchema,
  MasteryScopeKeySchema,
  RecoveryAttemptInputSchema,
  SubjectCodeSchema,
} from "@study/contracts";
import type {
  CurrentUser,
  MasteryEvidenceResult,
  MasteryStateResponse,
  MistakeResponse,
  RecoveryAttemptResponse,
} from "@study/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { MasteryService } from "./mastery.service.js";

@Controller("v1")
export class MasteryController {
  constructor(
    private readonly mastery: MasteryService,
    private readonly auth: AuthService,
    private readonly proofs: ReauthenticationProofService,
  ) {}

  @Post("students/:studentId/mistakes")
  async createMistake(
    @Req() request: Request,
    @Param("studentId") studentId: string,
    @Body() body: unknown,
  ): Promise<MistakeResponse> {
    return this.mastery.createMistake(
      await this.writeActor(request),
      this.uuid(studentId),
      this.parse(CreateMistakeInputSchema, body),
      readIdempotencyKey(request),
    );
  }

  @Post("students/:studentId/mistakes/:mistakeId/recovery-attempts")
  async recovery(
    @Req() request: Request,
    @Param("studentId") studentId: string,
    @Param("mistakeId") mistakeId: string,
    @Body() body: unknown,
  ): Promise<RecoveryAttemptResponse> {
    return this.mastery.recordRecoveryAttempt(
      await this.writeActor(request),
      this.uuid(studentId),
      this.uuid(mistakeId),
      this.parse(RecoveryAttemptInputSchema, body),
      readIdempotencyKey(request),
    );
  }

  @Post("students/:studentId/mastery-evidence")
  async evidence(
    @Req() request: Request,
    @Param("studentId") studentId: string,
    @Body() body: unknown,
  ): Promise<MasteryEvidenceResult> {
    return this.mastery.recordEvidence(
      await this.writeActor(request),
      this.uuid(studentId),
      this.parse(MasteryEvidenceInputSchema, body),
      readIdempotencyKey(request),
    );
  }

  @Get("students/:studentId/mastery/:subjectCode/:scopeKey")
  async state(
    @Req() request: Request,
    @Param("studentId") studentId: string,
    @Param("subjectCode") subjectCode: string,
    @Param("scopeKey") scopeKey: string,
  ): Promise<MasteryStateResponse> {
    return this.mastery.state(
      await this.readActor(request),
      this.uuid(studentId),
      this.parse(SubjectCodeSchema, subjectCode),
      this.parse(MasteryScopeKeySchema, scopeKey),
    );
  }

  @Post("students/:studentId/mastery/:subjectCode/:scopeKey/replay")
  async replay(
    @Req() request: Request,
    @Param("studentId") studentId: string,
    @Param("subjectCode") subjectCode: string,
    @Param("scopeKey") scopeKey: string,
  ): Promise<MasteryStateResponse> {
    return this.mastery.replay(
      await this.writeActor(request),
      this.uuid(studentId),
      this.parse(SubjectCodeSchema, subjectCode),
      this.parse(MasteryScopeKeySchema, scopeKey),
      readIdempotencyKey(request),
    );
  }

  private async readActor(request: Request): Promise<CurrentUser> {
    return this.auth.resolve(readSessionCookie(request));
  }

  private async writeActor(request: Request): Promise<CurrentUser> {
    const raw = readSessionCookie(request);
    const actor = await this.auth.resolve(raw);
    if (!this.proofs.verify(readReauthenticationProof(request), actor.id, raw)) {
      throw new UnauthorizedException();
    }
    return actor;
  }

  private uuid(value: string): string {
    return this.parse(z.uuid(), value);
  }

  private parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new BadRequestException();
    return parsed.data;
  }
}
