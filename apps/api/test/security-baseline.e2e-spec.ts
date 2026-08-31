import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

const databaseUrl = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
const allowedOrigin = "https://study.example.test";

describe("production HTTP security baseline", () => {
  let app: INestApplication | undefined;
  let baseUrl: string;
  const originalEnvironment = new Map<string, string | undefined>();

  beforeAll(async () => {
    for (const key of ["DATABASE_URL", "NODE_ENV", "MODEL_PROVIDER"] as const) {
      originalEnvironment.set(key, process.env[key]);
    }
    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = "test";
    process.env.MODEL_PROVIDER = "fake";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, readAppConfig({
      NODE_ENV: "test",
      ALLOWED_ORIGINS: allowedOrigin,
      REQUEST_BODY_LIMIT_BYTES: "16384",
      CSRF_PROTECTION_ENABLED: "true",
    }));
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  });

  it("sets the reviewed security headers and removes framework disclosure", async () => {
    const response = await fetch(new URL("/v1/health/live", baseUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it("allows only the exact configured credentialed CORS origin", async () => {
    const allowed = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-qinglang-csrf",
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");
    expect(allowed.headers.get("access-control-allow-headers"))
      .toContain("X-Qinglang-CSRF");

    const denied = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "OPTIONS",
      headers: {
        Origin: "https://attacker.example.test",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("blocks cross-site writes and permits exact-origin or explicit native clients", async () => {
    const write = (headers: Readonly<Record<string, string>>) => fetch(
      new URL("/v1/auth/login", baseUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: "{}",
      },
    );

    expect((await write({})).status).toBe(403);
    expect((await write({ Origin: "https://attacker.example.test" })).status).toBe(403);
    expect((await write({
      "Sec-Fetch-Site": "cross-site",
      "X-Qinglang-CSRF": "1",
    })).status).toBe(403);
    expect((await write({ Origin: allowedOrigin })).status).toBe(400);
    expect((await write({ "X-Qinglang-CSRF": "1" })).status).toBe(400);
  });

  it("rejects form bodies and oversized JSON before controller execution", async () => {
    const formResponse = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "POST",
      headers: {
        Origin: allowedOrigin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "loginId=user&password=not-accepted",
    });
    expect(formResponse.status).toBe(415);

    const oversizedResponse = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "POST",
      headers: {
        Origin: allowedOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ padding: "x".repeat(20_000) }),
    });
    expect(oversizedResponse.status).toBe(413);
    await expect(oversizedResponse.json()).resolves.toMatchObject({
      error: { code: "REQUEST_TOO_LARGE" },
    });
  });

  it("rate-limits repeated credential attempts with a neutral error", async () => {
    let limited: Response | undefined;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(new URL("/v1/auth/login", baseUrl), {
        method: "POST",
        headers: {
          Origin: allowedOrigin,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (response.status === 429) {
        limited = response;
        break;
      }
    }
    if (limited === undefined) {
      throw new Error("Credential endpoint did not enforce its rate limit");
    }
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).not.toBeNull();
    await expect(limited.json()).resolves.toMatchObject({
      error: { code: "TOO_MANY_REQUESTS" },
    });

    const independentPrincipal = await fetch(new URL("/v1/auth/login", baseUrl), {
      method: "POST",
      headers: {
        Origin: allowedOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ loginId: "independent@example.test" }),
    });
    expect(independentPrincipal.status).toBe(400);
  });
});
