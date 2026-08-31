import type { AdminOverviewResponse, CurrentUser } from "@study/contracts";
import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service.js";
import { readSessionCookie } from "../common/http/authenticated-request.js";
import { AdminOverviewService } from "./admin-overview.service.js";

@Controller("v1/admin")
export class AdminOverviewController {
  constructor(private readonly overviewService: AdminOverviewService, private readonly auth: AuthService) {}

  @Get("overview")
  async overview(@Req() request: Request): Promise<AdminOverviewResponse> {
    const actor: CurrentUser = await this.auth.resolve(readSessionCookie(request));
    return this.overviewService.overview(actor);
  }
}
