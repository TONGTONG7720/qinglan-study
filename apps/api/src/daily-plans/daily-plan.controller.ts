import { CompletePlanTaskInputSchema, GenerateDailyPlanInputSchema } from "@study/contracts";
import type { CurrentUser, DailyPlanResponse, OperationResponse, PlanTaskCompletionResponse } from "@study/contracts";
import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import { readIdempotencyKey, readReauthenticationProof, readSessionCookie } from "../common/http/authenticated-request.js";
import { DailyPlanService } from "./daily-plan.service.js";

const UuidSchema = z.uuid();

@Controller("v1")
export class DailyPlanController {
  constructor(private readonly plans: DailyPlanService, private readonly auth: AuthService, private readonly proofs: ReauthenticationProofService) {}

  @Post("students/:studentUserId/daily-plans/generate")
  async generate(@Req() request: Request, @Param("studentUserId") studentUserId: string, @Body() body: unknown): Promise<DailyPlanResponse> {
    this.parse(GenerateDailyPlanInputSchema, body);
    return this.plans.generate(await this.writeActor(request), this.uuid(studentUserId), readIdempotencyKey(request));
  }

  @Get("students/:studentUserId/daily-plans/today")
  async today(@Req() request: Request, @Param("studentUserId") studentUserId: string): Promise<DailyPlanResponse> {
    return this.plans.today(await this.readActor(request), this.uuid(studentUserId));
  }

  @Post("plan-tasks/:taskId/complete")
  async complete(@Req() request: Request, @Param("taskId") taskId: string, @Body() body: unknown): Promise<PlanTaskCompletionResponse> {
    const input = this.parse(CompletePlanTaskInputSchema, body);
    return this.plans.complete(await this.writeActor(request), this.uuid(taskId), input, readIdempotencyKey(request));
  }

  @Get("operations/:operationId")
  async operation(@Req() request: Request, @Param("operationId") operationId: string): Promise<OperationResponse> {
    return this.plans.operation(await this.readActor(request), this.uuid(operationId));
  }

  private async readActor(request: Request): Promise<CurrentUser> { return this.auth.resolve(readSessionCookie(request)); }
  private async writeActor(request: Request): Promise<CurrentUser> {
    const raw = readSessionCookie(request); const actor = await this.auth.resolve(raw);
    if (!this.proofs.verify(readReauthenticationProof(request), actor.id, raw)) throw new UnauthorizedException();
    return actor;
  }
  private uuid(value: string): string { return this.parse(UuidSchema, value); }
  private parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value); if (!parsed.success) throw new BadRequestException(); return parsed.data;
  }
}
