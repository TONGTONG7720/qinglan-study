import {
  ConfirmStudentTextbookContextInputSchema,
  ConfirmTextbookInputSchema,
  CreateTextbookDraftInputSchema,
  GradeSchema,
  RetireTextbookInputSchema,
  SubjectCodeSchema,
  SubmitStudentTextbookContextInputSchema,
  UpdateCurrentUnitInputSchema,
} from "@study/contracts";
import type {
  CurrentUser,
  StudentTextbookContextResponse,
  SubjectAvailabilityResponse,
  TextbookSummary,
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
import { CurriculumService } from "./curriculum.service.js";

const UuidSchema = z.uuid();

@Controller("v1")
export class CurriculumController {
  constructor(
    private readonly curriculum: CurriculumService,
    private readonly auth: AuthService,
    private readonly proofs: ReauthenticationProofService,
  ) {}

  @Get("curriculum/availability/:grade")
  availability(@Param("grade") grade: string): SubjectAvailabilityResponse {
    const parsed = GradeSchema.safeParse(Number(grade));
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.curriculum.availability(parsed.data);
  }

  @Post("curriculum/textbooks")
  async createTextbook(@Req() request: Request, @Body() body: unknown): Promise<TextbookSummary> {
    const input = this.parse(CreateTextbookDraftInputSchema, body);
    return this.curriculum.createTextbook(
      await this.writeActor(request),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post("curriculum/textbooks/:textbookId/confirm")
  async confirmTextbook(
    @Req() request: Request,
    @Param("textbookId") textbookId: string,
    @Body() body: unknown,
  ): Promise<TextbookSummary> {
    const input = this.parse(ConfirmTextbookInputSchema, body);
    return this.curriculum.confirmTextbook(
      await this.writeActor(request),
      this.uuid(textbookId),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post("curriculum/textbooks/:textbookId/retire")
  async retireTextbook(
    @Req() request: Request,
    @Param("textbookId") textbookId: string,
    @Body() body: unknown,
  ): Promise<TextbookSummary> {
    const input = this.parse(RetireTextbookInputSchema, body);
    return this.curriculum.retireTextbook(
      await this.writeActor(request),
      this.uuid(textbookId),
      input,
      readIdempotencyKey(request),
    );
  }

  @Get("students/:studentUserId/textbook-contexts/:subjectCode")
  async getContext(
    @Req() request: Request,
    @Param("studentUserId") studentUserId: string,
    @Param("subjectCode") subjectCode: string,
  ): Promise<StudentTextbookContextResponse> {
    return this.curriculum.getContext(
      await this.readActor(request),
      this.uuid(studentUserId),
      this.subject(subjectCode),
    );
  }

  @Post("students/:studentUserId/textbook-contexts/:subjectCode/submit")
  async submitContext(
    @Req() request: Request,
    @Param("studentUserId") studentUserId: string,
    @Param("subjectCode") subjectCode: string,
    @Body() body: unknown,
  ): Promise<StudentTextbookContextResponse> {
    const input = this.parse(SubmitStudentTextbookContextInputSchema, body);
    return this.curriculum.submitContext(
      await this.writeActor(request),
      this.uuid(studentUserId),
      this.subject(subjectCode),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post("students/:studentUserId/textbook-contexts/:subjectCode/confirm")
  async confirmContext(
    @Req() request: Request,
    @Param("studentUserId") studentUserId: string,
    @Param("subjectCode") subjectCode: string,
    @Body() body: unknown,
  ): Promise<StudentTextbookContextResponse> {
    const input = this.parse(ConfirmStudentTextbookContextInputSchema, body);
    return this.curriculum.confirmContext(
      await this.writeActor(request),
      this.uuid(studentUserId),
      this.subject(subjectCode),
      input,
      readIdempotencyKey(request),
    );
  }

  @Post("students/:studentUserId/textbook-contexts/:subjectCode/current-unit")
  async updateCurrentUnit(
    @Req() request: Request,
    @Param("studentUserId") studentUserId: string,
    @Param("subjectCode") subjectCode: string,
    @Body() body: unknown,
  ): Promise<StudentTextbookContextResponse> {
    const input = this.parse(UpdateCurrentUnitInputSchema, body);
    return this.curriculum.updateCurrentUnit(
      await this.writeActor(request),
      this.uuid(studentUserId),
      this.subject(subjectCode),
      input,
      readIdempotencyKey(request),
    );
  }

  private async readActor(request: Request): Promise<CurrentUser> {
    return this.auth.resolve(readSessionCookie(request));
  }

  private async writeActor(request: Request): Promise<CurrentUser> {
    const rawToken = readSessionCookie(request);
    const actor = await this.auth.resolve(rawToken);
    if (!this.proofs.verify(readReauthenticationProof(request), actor.id, rawToken)) {
      throw new UnauthorizedException();
    }
    return actor;
  }

  private uuid(value: string): string {
    return this.parse(UuidSchema, value);
  }

  private subject(value: string) {
    return this.parse(SubjectCodeSchema, value);
  }

  private parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return parsed.data;
  }
}
