import { ErrorEnvelopeSchema, HealthResponseSchema } from "@study/contracts";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { readAppConfig } from "../src/config/app-config.js";
import { configureApplication } from "../src/configure-application.js";

describe("public API foundation", () => {
  process.env.DATABASE_URL = "postgresql://study:study_local_only@127.0.0.1:5433/study?schema=public";
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function startApplication(): Promise<string> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, readAppConfig({ NODE_ENV: "test" }));
    await app.listen(0, "127.0.0.1");
    return app.getUrl();
  }

  it("returns the minimal public health contract", async () => {
    const baseUrl = await startApplication();
    const response = await fetch(new URL("/v1/health", baseUrl));
    const responseBody: unknown = await response.json();
    const health = HealthResponseSchema.parse(responseBody);

    expect(response.status).toBe(200);
    expect(health).toEqual({ status: "ok", service: "api", version: "0.1.0" });
    expect(JSON.stringify(responseBody)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(responseBody)).not.toContain("postgresql://");
  });

  it("returns a stable non-disclosing error envelope", async () => {
    const baseUrl = await startApplication();
    const response = await fetch(new URL("/v1/not-present", baseUrl));
    const responseBody: unknown = await response.json();
    const envelope = ErrorEnvelopeSchema.parse(responseBody);

    expect(response.status).toBe(404);
    expect(envelope.error).toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      message: "资源不存在或不可访问",
    });
    expect(response.headers.get("x-request-id")).toBe(envelope.error.requestId);
    expect(JSON.stringify(responseBody)).not.toContain("Cannot GET");
  });
});
