import { ConfirmOcrInputSchema, CreatePrivateObjectInputSchema, SetFamilyAiBudgetInputSchema, StartOcrInputSchema } from "@study/contracts";
import type { CurrentUser, OcrResult, PrivateObjectResponse } from "@study/contracts";
import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import { readIdempotencyKey, readReauthenticationProof, readSessionCookie } from "../common/http/authenticated-request.js";
import { OcrService } from "./ocr.service.js";
import { BudgetService } from "./budget.service.js";

@Controller("v1")
export class AiController {
  constructor(private readonly ocr: OcrService, private readonly budgets: BudgetService, private readonly auth: AuthService, private readonly proofs: ReauthenticationProofService) {}
  @Post("families/:familyId/ai-budget")
  async familyBudget(@Req() request: Request, @Param("familyId") familyId: string, @Body() body: unknown) {
    const input = this.parse(SetFamilyAiBudgetInputSchema, body);
    readIdempotencyKey(request);
    const actor = await this.writeActor(request);
    return this.budgets.setFamilyCap(actor.id, this.uuid(familyId), input.monthlyCapFen);
  }

  @Post("students/:studentId/private-objects/presign")
  async object(@Req() request: Request, @Param("studentId") studentId: string, @Body() body: unknown): Promise<PrivateObjectResponse> {
    return this.ocr.createObject(await this.writeActor(request), this.uuid(studentId), this.parse(CreatePrivateObjectInputSchema, body));
  }
  @Get("private-objects/:objectId")
  async getObject(@Req() request: Request, @Param("objectId") objectId: string): Promise<PrivateObjectResponse> { return this.ocr.getObject(await this.readActor(request), this.uuid(objectId)); }
  @Post("students/:studentId/questions/ocr")
  async start(@Req() request: Request, @Param("studentId") studentId: string, @Body() body: unknown): Promise<OcrResult> {
    const input = this.parse(StartOcrInputSchema, body); return this.ocr.start(await this.writeActor(request), this.uuid(studentId), input.objectId);
  }
  @Post("questions/:questionId/confirm-ocr")
  async confirm(@Req() request: Request, @Param("questionId") id: string, @Body() body: unknown): Promise<OcrResult> { return this.ocr.confirm(await this.writeActor(request), this.uuid(id), this.parse(ConfirmOcrInputSchema, body)); }
  @Get("questions/:questionId")
  async get(@Req() request: Request, @Param("questionId") id: string): Promise<OcrResult> { return this.ocr.getQuestion(await this.readActor(request), this.uuid(id)); }
  private async readActor(request: Request): Promise<CurrentUser> { return this.auth.resolve(readSessionCookie(request)); }
  private async writeActor(request: Request): Promise<CurrentUser> { const raw = readSessionCookie(request); const actor = await this.auth.resolve(raw); if (!this.proofs.verify(readReauthenticationProof(request), actor.id, raw)) throw new UnauthorizedException(); return actor; }
  private uuid(value: string): string { return this.parse(z.uuid(), value); }
  private parse<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success) throw new BadRequestException(); return parsed.data; }
}
