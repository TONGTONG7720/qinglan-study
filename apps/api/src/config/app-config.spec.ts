import { describe, expect, it } from "vitest";

import { readAppConfig } from "./app-config.js";

describe("readAppConfig", () => {
  it("provides safe local defaults", () => {
    expect(readAppConfig({})).toEqual({
      NODE_ENV: "development",
      API_HOST: "127.0.0.1",
      API_PORT: 3001,
      ALLOWED_ORIGINS: ["http://127.0.0.1:3000"],
    });
  });

  it("rejects an invalid port", () => {
    expect(() => readAppConfig({ API_PORT: "70000" })).toThrow();
  });
});
