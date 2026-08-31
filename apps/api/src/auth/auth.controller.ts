import { createHash } from "node:crypto";

import { LoginInputSchema, ReauthenticateInputSchema } from "@study/contracts";
import type { CurrentUser } from "@study/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import type { ThrottlerGetTrackerFunction } from "@nestjs/throttler";

import type { RequestWithId } from "../common/http/request-id.middleware.js";
import { AuthService } from "./auth.service.js";
import { ReauthenticationProofService } from "./reauthentication-proof.service.js";

const credentialTracker: ThrottlerGetTrackerFunction = (request) => {
  const requestRecord = request as unknown as Readonly<Record<string, unknown>>;
  const body = requestRecord.body;
  const loginId = typeof body === "object" && body !== null && "loginId" in body
    && typeof body.loginId === "string"
    ? body.loginId.trim().toLowerCase()
    : undefined;
  const headers = typeof requestRecord.headers === "object" && requestRecord.headers !== null
    ? requestRecord.headers as Readonly<Record<string, unknown>>
    : {};
  const cookie = typeof headers.cookie === "string" ? headers.cookie : undefined;
  const ip = typeof requestRecord.ip === "string" ? requestRecord.ip : "unknown";
  const discriminator = loginId === undefined
    ? cookie === undefined ? `ip:${ip}` : `session:${cookie}`
    : `login:${loginId}`;
  return createHash("sha256").update(discriminator, "utf8").digest("hex");
};

const credentialThrottle = {
  default: {
    limit: 10,
    ttl: 15 * 60_000,
    blockDuration: 15 * 60_000,
    getTracker: credentialTracker,
  },
} as const;

function sessionCookieName(): string {
  const configured = process.env.SESSION_COOKIE_NAME?.trim();
  return configured === undefined || configured.length === 0 ? "study_session" : configured;
}

function readSessionCookie(request: Request): string {
  const name = sessionCookieName();
  const cookie = request.headers.cookie
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  const value = cookie?.slice(name.length + 1);
  if (value === undefined || value.length === 0) {
    throw new UnauthorizedException();
  }
  return value;
}

@Controller("v1/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly proofs: ReauthenticationProofService,
  ) {}

  @Post("login")
  @HttpCode(200)
  @Throttle(credentialThrottle)
  async login(
    @Req() request: RequestWithId,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: CurrentUser }> {
    const parsed = LoginInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const result = await this.auth.login(parsed.data, {
      interface: "login",
      requestId: request.requestId,
    });
    response.cookie(sessionCookieName(), result.rawToken, {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
    });
    return { user: result.user };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const rawToken = readSessionCookie(request);
    await this.auth.logout(rawToken);
    response.clearCookie(sessionCookieName(), {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
    });
  }

  @Get("me")
  async me(@Req() request: Request): Promise<CurrentUser> {
    return this.auth.resolve(readSessionCookie(request));
  }

  @Post("reauthenticate")
  @HttpCode(200)
  @Throttle(credentialThrottle)
  async reauthenticate(
    @Req() request: RequestWithId,
    @Body() body: unknown,
  ): Promise<{ proof: string; expiresAt: string }> {
    const parsed = ReauthenticateInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const rawToken = readSessionCookie(request);
    const user = await this.auth.resolve(rawToken);
    await this.auth.reauthenticate(user.id, parsed.data.password, {
      interface: "reauthentication",
      requestId: request.requestId,
    });
    const issued = this.proofs.issue(user.id, rawToken);
    return { proof: issued.proof, expiresAt: issued.expiresAt.toISOString() };
  }
}
