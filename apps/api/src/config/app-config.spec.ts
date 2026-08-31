import { describe, expect, it } from "vitest";

import { readAppConfig } from "./app-config.js";

describe("readAppConfig", () => {
  it("provides safe local defaults", () => {
    expect(readAppConfig({})).toEqual({
      NODE_ENV: "development",
      API_HOST: "127.0.0.1",
      API_PORT: 3001,
      TRUST_PROXY_HOPS: 0,
      ALLOWED_ORIGINS: ["http://127.0.0.1:3000"],
    });
  });

  it("rejects an invalid port", () => {
    expect(() => readAppConfig({ API_PORT: "70000" })).toThrow();
  });

  it("accepts a fail-closed production configuration with AI disabled", () => {
    expect(readAppConfig({
      NODE_ENV: "production",
      API_HOST: "0.0.0.0",
      API_PORT: "3001",
      TRUST_PROXY_HOPS: "1",
      ALLOWED_ORIGINS: "https://study.example.com",
      DATABASE_URL: `postgresql://qinglang_app:${"d".repeat(64)}@postgres:5432/qinglang`,
      SESSION_COOKIE_NAME: "__Host-qinglang_session",
      SESSION_COOKIE_SECURE: "true",
      REAUTH_PROOF_SECRET: "r".repeat(64),
      INVITATION_TOKEN_SECRET: "i".repeat(64),
      EXPECTED_MIGRATION_NAME: "20260827032650_question_bank_foundation",
      MODEL_PROVIDER: "disabled",
    })).toMatchObject({
      NODE_ENV: "production",
      API_HOST: "0.0.0.0",
      TRUST_PROXY_HOPS: 1,
      ALLOWED_ORIGINS: ["https://study.example.com"],
    });
  });

  it("rejects fake AI and insecure origins in production", () => {
    const baseEnvironment: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      API_HOST: "0.0.0.0",
      TRUST_PROXY_HOPS: "1",
      ALLOWED_ORIGINS: "https://study.example.com",
      DATABASE_URL: `postgresql://qinglang_app:${"d".repeat(64)}@postgres:5432/qinglang`,
      SESSION_COOKIE_NAME: "__Host-qinglang_session",
      SESSION_COOKIE_SECURE: "true",
      REAUTH_PROOF_SECRET: "r".repeat(64),
      INVITATION_TOKEN_SECRET: "i".repeat(64),
      EXPECTED_MIGRATION_NAME: "20260827032650_question_bank_foundation",
      MODEL_PROVIDER: "disabled",
    };

    expect(() => readAppConfig({ ...baseEnvironment, MODEL_PROVIDER: "fake" })).toThrow();
    expect(() => readAppConfig({
      ...baseEnvironment,
      ALLOWED_ORIGINS: "http://study.example.com",
    })).toThrow("ALLOWED_ORIGINS must use HTTPS in production");
  });
});
