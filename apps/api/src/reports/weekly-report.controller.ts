import { GenerateWeeklyReportInputSchema } from "@study/contracts";
import type { CurrentUser, WeeklyReportResponse } from "@study/contracts";
import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import { readIdempotencyKey, readReauthenticationProof, readSessionCookie } from "../common/http/authenticated-request.js";
import { WeeklyReportService } from "./weekly-report.service.js";

@Controller("v1")
export class WeeklyReportController {
  constructor(private readonly reports: WeeklyReportService, private readonly auth: AuthService, private readonly proofs: ReauthenticationProofService) {}

  @Post("students/:studentId/weekly-reports/generate")
  async generate(@Req() request: Request, @Param("studentId") studentId: string, @Body() body: unknown): Promise<WeeklyReportResponse> {
    return this.reports.generate(await this.writeActor(request), this.uuid(studentId), this.parse(GenerateWeeklyReportInputSchema, body), readIdempotencyKey(request));
  }

  @Get("students/:studentId/weekly-reports/:weekStart")
  async get(@Req() request: Request, @Param("studentId") studentId: string, @Param("weekStart") weekStart: string): Promise<WeeklyReportResponse> {
    return this.reports.get(await this.readActor(request), this.uuid(studentId), this.parse(z.iso.date(), weekStart));
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
