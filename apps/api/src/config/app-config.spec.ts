import { describe, expect, it } from "vitest";

import { readAppConfig } from "./app-config.js";

const databasePassword = "D8vQ2mN7sK4xR9pL6cW3hT5yJ1fG0bZ".repeat(2);
const reauthenticationSecret = "R7mQ2vN9xK4pL6cW3hT5yJ1fG8bZ0sD".repeat(2);
const invitationSecret = "I6nP3wM8yL5qK2dV9gS4xH7cF1rB0tZ".repeat(2);

function productionEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    API_HOST: "0.0.0.0",
    API_PORT: "3001",
    TRUST_PROXY_HOPS: "1",
    ALLOWED_ORIGINS: "https://study.example.com",
    REQUEST_BODY_LIMIT_BYTES: "256000",
    CSRF_PROTECTION_ENABLED: "true",
    DATABASE_URL: `postgresql://qinglang_app:${databasePassword}@postgres:5432/qinglang`,
    SESSION_COOKIE_NAME: "__Host-qinglang_session",
    SESSION_COOKIE_SECURE: "true",
    REAUTH_PROOF_SECRET: reauthenticationSecret,
    INVITATION_TOKEN_SECRET: invitationSecret,
    EXPECTED_MIGRATION_NAME: "20260901090000_question_bank_release_gates",
    VITE_ENABLE_DEMO_COURSE_CATALOG: "false",
    VITE_QA_DEMO_BUILD: "false",
    VITE_RELEASE_SCOPE: "READ_ONLY_BETA",
    MODEL_PROVIDER: "disabled",
    OBJECT_STORAGE_PROVIDER: "disabled",
    OBJECT_SCAN_PROVIDER: "disabled",
    EMAIL_PROVIDER: "disabled",
  };
}

describe("readAppConfig", () => {
  it("provides fail-safe local defaults", () => {
    expect(readAppConfig({})).toEqual({
      NODE_ENV: "development",
      API_HOST: "127.0.0.1",
      API_PORT: 3001,
      TRUST_PROXY_HOPS: 0,
      REQUEST_BODY_LIMIT_BYTES: 256_000,
      CSRF_PROTECTION_ENABLED: false,
      MODEL_PROVIDER: "disabled",
      OBJECT_STORAGE_PROVIDER: "disabled",
      OBJECT_SCAN_PROVIDER: "disabled",
      EMAIL_PROVIDER: "disabled",
      ALLOWED_ORIGINS: ["http://127.0.0.1:3000"],
    });
  });

  it("rejects an invalid port or duplicate origin", () => {
    expect(() => readAppConfig({ API_PORT: "70000" })).toThrow();
    expect(() => readAppConfig({
      ALLOWED_ORIGINS: "http://127.0.0.1:3000,http://127.0.0.1:3000",
    })).toThrow("ALLOWED_ORIGINS entries must be unique");
  });

  it("accepts an explicit fail-closed production configuration", () => {
    expect(readAppConfig(productionEnvironment())).toMatchObject({
      NODE_ENV: "production",
      API_HOST: "0.0.0.0",
      TRUST_PROXY_HOPS: 1,
      REQUEST_BODY_LIMIT_BYTES: 256_000,
      CSRF_PROTECTION_ENABLED: true,
      MODEL_PROVIDER: "disabled",
      OBJECT_STORAGE_PROVIDER: "disabled",
      OBJECT_SCAN_PROVIDER: "disabled",
      EMAIL_PROVIDER: "disabled",
      ALLOWED_ORIGINS: ["https://study.example.com"],
    });
  });

  it.each([
    "API_HOST",
    "TRUST_PROXY_HOPS",
    "ALLOWED_ORIGINS",
    "DATABASE_URL",
    "SESSION_COOKIE_NAME",
    "SESSION_COOKIE_SECURE",
    "REAUTH_PROOF_SECRET",
    "INVITATION_TOKEN_SECRET",
    "EXPECTED_MIGRATION_NAME",
    "REQUEST_BODY_LIMIT_BYTES",
    "CSRF_PROTECTION_ENABLED",
    "VITE_ENABLE_DEMO_COURSE_CATALOG",
    "VITE_QA_DEMO_BUILD",
    "VITE_RELEASE_SCOPE",
    "MODEL_PROVIDER",
    "OBJECT_STORAGE_PROVIDER",
    "OBJECT_SCAN_PROVIDER",
    "EMAIL_PROVIDER",
  ])("rejects missing production key %s", (key) => {
    const environment = productionEnvironment();
    Reflect.deleteProperty(environment, key);
    expect(() => readAppConfig(environment)).toThrow();
  });

  it("rejects fake AI, demo flags, insecure origins and placeholder secrets", () => {
    expect(() => readAppConfig({
      ...productionEnvironment(),
      MODEL_PROVIDER: "fake",
    })).toThrow();
    expect(() => readAppConfig({
      ...productionEnvironment(),
      VITE_ENABLE_DEMO_COURSE_CATALOG: "true",
    })).toThrow();
    expect(() => readAppConfig({
      ...productionEnvironment(),
      VITE_RELEASE_SCOPE: "FULL_PREVIEW",
    })).toThrow();
    expect(() => readAppConfig({
      ...productionEnvironment(),
      ALLOWED_ORIGINS: "http://study.example.com",
    })).toThrow("ALLOWED_ORIGINS must use HTTPS in production");
    expect(() => readAppConfig({
      ...productionEnvironment(),
      REAUTH_PROOF_SECRET: "development-only-secret-that-is-long-but-still-unsafe",
    })).toThrow();
    expect(() => readAppConfig({
      ...productionEnvironment(),
      INVITATION_TOKEN_SECRET: "i".repeat(64),
    })).toThrow();
  });

  it("requires complete real model settings when the provider is enabled", () => {
    const enabledEnvironment: NodeJS.ProcessEnv = {
      ...productionEnvironment(),
      MODEL_PROVIDER: "openai-compatible",
      MODEL_BASE_URL: "https://models.provider.test/api",
      MODEL_API_KEY: "K8mQ2vN9xP4rL6cW3hT5yJ1fG7bZ0sD",
      MODEL_NAME: "reviewed-production-model",
      MODEL_REASONING_EFFORT: "medium",
      MODEL_TIMEOUT_MS: "60000",
      MODEL_COST_FEN_PER_CALL: "10",
    };
    expect(readAppConfig(enabledEnvironment).MODEL_PROVIDER).toBe("openai-compatible");

    for (const key of [
      "MODEL_BASE_URL",
      "MODEL_API_KEY",
      "MODEL_NAME",
      "MODEL_REASONING_EFFORT",
      "MODEL_TIMEOUT_MS",
      "MODEL_COST_FEN_PER_CALL",
    ]) {
      const missing = { ...enabledEnvironment };
      Reflect.deleteProperty(missing, key);
      expect(() => readAppConfig(missing)).toThrow();
    }
    expect(() => readAppConfig({
      ...enabledEnvironment,
      MODEL_BASE_URL: "https://127.0.0.1/v1",
    })).toThrow();
    expect(() => readAppConfig({
      ...enabledEnvironment,
      MODEL_BASE_URL: "https://[::1]/v1",
    })).toThrow();
  });

  it("rejects stale provider credentials when the capability is disabled", () => {
    expect(() => readAppConfig({
      ...productionEnvironment(),
      MODEL_BASE_URL: "https://models.provider.test",
    })).toThrow();
    expect(() => readAppConfig({
      ...productionEnvironment(),
      OBJECT_STORAGE_ENDPOINT: "https://objects.provider.test",
    })).toThrow();
    expect(() => readAppConfig({
      ...productionEnvironment(),
      SMTP_HOST: "smtp.provider.test",
    })).toThrow();
  });

  it("requires a complete encrypted S3 and ClamAV configuration when uploads are enabled", () => {
    const enabledEnvironment: NodeJS.ProcessEnv = {
      ...productionEnvironment(),
      OBJECT_STORAGE_PROVIDER: "s3",
      OBJECT_SCAN_PROVIDER: "clamav",
      OBJECT_STORAGE_ENDPOINT: "https://objects.provider.test",
      OBJECT_STORAGE_REGION: "cn-south-1",
      OBJECT_STORAGE_BUCKET: "qinglang-private-production",
      OBJECT_STORAGE_ACCESS_KEY_ID: "qinglang-private-object-service",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "S8mQ2vN9xP4rL6cW3hT5yJ1fG7bZ0sD",
      OBJECT_STORAGE_FORCE_PATH_STYLE: "false",
      OBJECT_STORAGE_UPLOAD_TTL_SECONDS: "300",
      OBJECT_STORAGE_READ_TTL_SECONDS: "120",
      OBJECT_STORAGE_RETENTION_DAYS: "30",
      OBJECT_STORAGE_SSE: "AES256",
      CLAMAV_HOST: "malware-scanner",
      CLAMAV_PORT: "3310",
      CLAMAV_TIMEOUT_MS: "30000",
    };
    expect(readAppConfig(enabledEnvironment)).toMatchObject({
      OBJECT_STORAGE_PROVIDER: "s3",
      OBJECT_SCAN_PROVIDER: "clamav",
    });
    for (const key of [
      "OBJECT_STORAGE_ENDPOINT",
      "OBJECT_STORAGE_REGION",
      "OBJECT_STORAGE_BUCKET",
      "OBJECT_STORAGE_ACCESS_KEY_ID",
      "OBJECT_STORAGE_SECRET_ACCESS_KEY",
      "OBJECT_STORAGE_FORCE_PATH_STYLE",
      "OBJECT_STORAGE_UPLOAD_TTL_SECONDS",
      "OBJECT_STORAGE_READ_TTL_SECONDS",
      "OBJECT_STORAGE_RETENTION_DAYS",
      "OBJECT_STORAGE_SSE",
      "CLAMAV_HOST",
      "CLAMAV_PORT",
      "CLAMAV_TIMEOUT_MS",
    ]) {
      const missing = { ...enabledEnvironment };
      Reflect.deleteProperty(missing, key);
      expect(() => readAppConfig(missing)).toThrow();
    }
    expect(() => readAppConfig({
      ...enabledEnvironment,
      OBJECT_STORAGE_ENDPOINT: "http://objects.provider.test",
    })).toThrow("OBJECT_STORAGE_ENDPOINT must use HTTPS");
    expect(() => readAppConfig({
      ...enabledEnvironment,
      OBJECT_STORAGE_SSE: "none",
    })).toThrow("production object storage must use AES256");
    expect(() => readAppConfig({
      ...enabledEnvironment,
      CLAMAV_HOST: "scanner.public.example",
    })).toThrow("CLAMAV_HOST must remain on the private deployment network");
  });
});
