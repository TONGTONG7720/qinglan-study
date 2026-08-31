import { ConfirmExamInputSchema, CreateExamInputSchema } from "@study/contracts";
import type { CurrentUser, ExamResponse } from "@study/contracts";
import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import { readIdempotencyKey, readReauthenticationProof, readSessionCookie } from "../common/http/authenticated-request.js";
import { ExamService } from "./exam.service.js";

@Controller("v1")
export class ExamController {
  constructor(private readonly exams: ExamService, private readonly auth: AuthService, private readonly proofs: ReauthenticationProofService) {}

  @Post("students/:studentId/exams")
  async create(@Req() request: Request, @Param("studentId") studentId: string, @Body() body: unknown): Promise<ExamResponse> {
    return this.exams.create(await this.writeActor(request), this.uuid(studentId), this.parse(CreateExamInputSchema, body), readIdempotencyKey(request));
  }

  @Post("students/:studentId/exams/:examId/confirm")
  async confirm(@Req() request: Request, @Param("studentId") studentId: string, @Param("examId") examId: string, @Body() body: unknown): Promise<ExamResponse> {
    return this.exams.confirm(await this.writeActor(request), this.uuid(studentId), this.uuid(examId), this.parse(ConfirmExamInputSchema, body), readIdempotencyKey(request));
  }

  @Get("students/:studentId/exams/:examId")
  async get(@Req() request: Request, @Param("studentId") studentId: string, @Param("examId") examId: string): Promise<ExamResponse> {
    return this.exams.get(await this.readActor(request), this.uuid(studentId), this.uuid(examId));
  }

  private async readActor(request: Request): Promise<CurrentUser> { return this.auth.resolve(readSessionCookie(request)); }
  private async writeActor(request: Request): Promise<CurrentUser> {
    const raw = readSessionCookie(request); const actor = await this.auth.resolve(raw);
    if (!this.proofs.verify(readReauthenticationProof(request), actor.id, raw)) throw new UnauthorizedException();
    return actor;
  }
  private uuid(value: string): string { return this.parse(z.uuid(), value); }
  private parse<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success) throw new BadRequestException(); return parsed.data; }
}
