import type { CurrentUser, LoginInput } from "@study/contracts";
import { CurrentUserSchema } from "@study/contracts";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../common/prisma/prisma.service.js";
import { RedactingLoggerService } from "../common/logging/redacting-logger.service.js";
import { PasswordService } from "./password.service.js";
import { SessionTokenService } from "./session-token.service.js";

const sessionTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000;
const dummyPasswordHash =
  "$argon2id$v=19$m=19456,t=2,p=1$cGhhc2UyLWR1bW15LXNhbHQ$Wl4SiOoTS4f9LkGfgg08XqQDN3pJ1P6Xlch8JCrD9xI";

export interface LoginResult {
  rawToken: string;
  expiresAt: Date;
  user: CurrentUser;
}

export interface AuthenticationAuditContext {
  interface: "login" | "reauthentication";
  requestId: string | undefined;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: SessionTokenService,
    private readonly logger: RedactingLoggerService,
  ) {}

  async login(input: LoginInput, audit: AuthenticationAuditContext): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { loginId: input.loginId },
      include: {
        memberships: {
          where: { revokedAt: null },
          include: { family: { select: { id: true, status: true } } },
          orderBy: { activeAt: "asc" },
        },
      },
    });

    const passwordMatches = await this.passwords.verify(
      user?.passwordHash ?? dummyPasswordHash,
      input.password,
    );
    if (user?.status !== "ACTIVE" || !passwordMatches) {
      this.logger.warn({
        event: "authentication_failed",
        interface: audit.interface,
        requestId: audit.requestId,
      });
      throw new UnauthorizedException();
    }

    const activeFamilyId =
      user.memberships.find((membership) => membership.family.status === "ACTIVE")?.familyId
      ?? null;
    const currentUser = CurrentUserSchema.parse({
      id: user.id,
      displayName: user.displayName,
      roles: user.roles,
      activeFamilyId,
    });
    const issued = this.tokens.issue();
    const expiresAt = new Date(Date.now() + sessionTtlMilliseconds);

    await this.prisma.session.create({
      data: { userId: user.id, tokenHash: issued.tokenHash, expiresAt },
    });
    this.logger.log({
      event: "authentication_succeeded",
      interface: audit.interface,
      requestId: audit.requestId,
    });

    return { rawToken: issued.rawToken, expiresAt, user: currentUser };
  }

  async resolve(rawToken: string): Promise<CurrentUser> {
    const tokenHash = this.tokens.hash(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: { revokedAt: null },
              include: { family: { select: { id: true, status: true } } },
              orderBy: { activeAt: "asc" },
            },
          },
        },
      },
    });

    if (
      session?.revokedAt !== null
      || session.expiresAt.getTime() <= Date.now()
      || session.user.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException();
    }

    const activeFamilyId =
      session.user.memberships.find((membership) => membership.family.status === "ACTIVE")
        ?.familyId ?? null;

    return CurrentUserSchema.parse({
      id: session.user.id,
      displayName: session.user.displayName,
      roles: session.user.roles,
      activeFamilyId,
    });
  }

  async logout(rawToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.tokens.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async reauthenticate(
    userId: string,
    password: string,
    audit: AuthenticationAuditContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, status: true },
    });
    const passwordMatches = await this.passwords.verify(
      user?.passwordHash ?? dummyPasswordHash,
      password,
    );
    if (user?.status !== "ACTIVE" || !passwordMatches) {
      this.logger.warn({
        event: "authentication_failed",
        interface: audit.interface,
        requestId: audit.requestId,
      });
      throw new UnauthorizedException();
    }
    this.logger.log({
      event: "authentication_succeeded",
      interface: audit.interface,
      requestId: audit.requestId,
    });
  }
}
