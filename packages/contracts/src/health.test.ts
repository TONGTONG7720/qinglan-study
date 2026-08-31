import { describe, expect, it } from "vitest";

import { HealthResponseSchema } from "./health.js";

describe("HealthResponseSchema", () => {
  it("accepts only the public health contract", () => {
    expect(
      HealthResponseSchema.parse({ status: "ok", service: "api", version: "0.1.0" }),
    ).toEqual({ status: "ok", service: "api", version: "0.1.0" });
  });

  it("rejects environment and secret fields", () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: "ok",
        service: "api",
        version: "0.1.0",
        databaseUrl: "postgresql://secret",
      }),
    ).toThrow();
  });
});
