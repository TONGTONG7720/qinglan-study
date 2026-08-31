import {
  IssueInvitationInputSchema,
  RedeemInvitationInputSchema,
  RevokeInvitationInputSchema,
} from "@study/contracts";
import type { IssuedInvitation, RedeemedInvitation } from "@study/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";

import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import {
  readIdempotencyKey,
  readReauthenticationProof,
  readSessionCookie,
} from "../common/http/authenticated-request.js";
import { InvitationService } from "./invitation.service.js";
import type { InvitationValidation } from "./invitation.service.js";

const TokenInputSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u) }).strict();
const InvitationIdSchema = z.uuid();
const publicInvitationThrottle = {
  default: { limit: 20, ttl: 15 * 60_000, blockDuration: 15 * 60_000 },
} as const;

@Controller("v1/invitations")
export class InvitationController {
  constructor(
    private readonly invitations: InvitationService,
    private readonly auth: AuthService,
    private readonly proofs: ReauthenticationProofService,
  ) {}

  @Post()
  @HttpCode(201)
  async issue(@Req() request: Request, @Body() body: unknown): Promise<IssuedInvitation> {
    const parsed = IssueInvitationInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const rawToken = readSessionCookie(request);
    const actor = await this.auth.resolve(rawToken);
    if (!this.proofs.verify(readReauthenticationProof(request), actor.id, rawToken)) {
      throw new UnauthorizedException();
    }
    return this.invitations.issue(actor, parsed.data, readIdempotencyKey(request));
  }

  @Post(":invitationId/revoke")
  @HttpCode(200)
  async revoke(
    @Req() request: Request,
    @Param("invitationId") invitationId: string,
    @Body() body: unknown,
  ): Promise<{ id: string; revoked: true }> {
    const id = InvitationIdSchema.safeParse(invitationId);
    const parsed = RevokeInvitationInputSchema.safeParse(body);
    if (!id.success || !parsed.success) {
      throw new BadRequestException();
    }
    const rawToken = readSessionCookie(request);
    const actor = await this.auth.resolve(rawToken);
    if (!this.proofs.verify(readReauthenticationProof(request), actor.id, rawToken)) {
      throw new UnauthorizedException();
    }
    return this.invitations.revoke(actor, id.data, readIdempotencyKey(request));
  }

  @Post("validate")
  @HttpCode(200)
  @Throttle(publicInvitationThrottle)
  async validate(@Body() body: unknown): Promise<InvitationValidation> {
    const parsed = TokenInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.invitations.validate(parsed.data.token);
  }

  @Post("redeem")
  @HttpCode(201)
  @Throttle(publicInvitationThrottle)
  async redeem(@Body() body: unknown): Promise<RedeemedInvitation> {
    const parsed = RedeemInvitationInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.invitations.redeem(parsed.data);
  }
}
