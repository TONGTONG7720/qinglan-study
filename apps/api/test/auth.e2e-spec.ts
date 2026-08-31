import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { AppModule } from "../src/app.module.js";
import { PasswordService } from "../src/auth/password.service.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";
import { PrismaService } from "../src/common/prisma/prisma.service.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const loginId = "guardian.phase2@example.test";

describe("database-backed authentication", () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let baseUrl: string;
  const originalCookieName = process.env.SESSION_COOKIE_NAME;
  const originalCookieSecure = process.env.SESSION_COOKIE_SECURE;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.SESSION_COOKIE_NAME = "__Host-qinglang_session";
    process.env.SESSION_COOKIE_SECURE = "true";
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await prisma.user.deleteMany({ where: { loginId } });

    const passwordHash = await new PasswordService().hash("fictional-password-123");
    await prisma.user.create({
      data: {
        loginId,
        passwordHash,
        displayName: "测试监护人",
        roles: ["GUARDIAN"],
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, readAppConfig({ NODE_ENV: "test" }));
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.user.deleteMany({ where: { loginId } });
    await prisma.onModuleDestroy();
    if (originalCookieName === undefined) {
      Reflect.deleteProperty(process.env, "SESSION_COOKIE_NAME");
    } else {
      process.env.SESSION_COOKIE_NAME = originalCookieName;
    }
    if (originalCookieSecure === undefined) {
      Reflect.deleteProperty(process.env, "SESSION_COOKIE_SECURE");
    } else {
      process.env.SESSION_COOKIE_SECURE = originalCookieSecure;
    }
  });

  it("logs in, stores only the token hash, resolves me and revokes logout", async () => {
    const loginResponse = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId, password: "fictional-password-123" }),
    });
    expect(loginResponse.status).toBe(200);

    const setCookie = loginResponse.headers.get("set-cookie");
    expect(setCookie).not.toBeNull();
    expect(setCookie).toContain("__Host-qinglang_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Domain=");
    const cookie = setCookie?.split(";", 1)[0];
    if (cookie === undefined) {
      throw new Error("Login did not return a session cookie");
    }
    const rawToken = cookie.split("=", 2)[1];
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);

    const storedSession = await prisma.session.findFirst({
      where: { user: { loginId } },
      orderBy: { createdAt: "desc" },
    });
    expect(storedSession?.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(storedSession?.tokenHash).not.toBe(rawToken);

    const meResponse = await fetch(new URL("/v1/auth/me", baseUrl), {
      headers: { cookie },
    });
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({ displayName: "测试监护人" });

    const reauthenticateResponse = await fetch(new URL("/v1/auth/reauthenticate", baseUrl), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ password: "fictional-password-123" }),
    });
    expect(reauthenticateResponse.status).toBe(200);
    const reauthenticationBody: unknown = await reauthenticateResponse.json();
    const reauthentication = z
      .object({
        proof: z.string().regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u),
        expiresAt: z.iso.datetime(),
      })
      .strict()
      .parse(reauthenticationBody);
    expect(reauthentication.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);

    const logoutResponse = await fetch(new URL("/v1/auth/logout", baseUrl), {
      method: "POST",
      headers: { cookie },
    });
    expect(logoutResponse.status).toBe(204);

    const revokedResponse = await fetch(new URL("/v1/auth/me", baseUrl), {
      headers: { cookie },
    });
    expect(revokedResponse.status).toBe(401);
  });
});
