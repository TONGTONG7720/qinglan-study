import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { IdempotencyKeySchema } from "@study/contracts";

export function readSessionCookie(request: Request): string {
  const configured = process.env.SESSION_COOKIE_NAME?.trim();
  const name = configured === undefined || configured.length === 0 ? "study_session" : configured;
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

export function readReauthenticationProof(request: Request): string {
  const value = request.header("x-reauth-proof");
  if (value === undefined || value.length === 0) {
    throw new UnauthorizedException();
  }
  return value;
}

export function readIdempotencyKey(request: Request): string {
  const parsed = IdempotencyKeySchema.safeParse(request.header("idempotency-key"));
  if (!parsed.success) {
    throw new BadRequestException();
  }
  return parsed.data;
}
