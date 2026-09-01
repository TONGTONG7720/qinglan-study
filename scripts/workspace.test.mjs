import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const requiredFiles = [
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  ".env.example",
  "compose.yaml",
  "apps/api/package.json",
  "apps/api/scripts/accept-real-family-production.mjs",
  "apps/web/package.json",
  "packages/contracts/package.json",
  "packages/test-fixtures/package.json",
];

test("workspace contains every authorized application and shared package", () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `missing required workspace file: ${file}`);
  }
});

test("workspace contains the authorized frontend application", () => {
  assert.equal(existsSync("apps/web"), true, "apps/web must exist after frontend authorization");
});

test("root package exposes the verification contract", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  for (const script of ["lint", "typecheck", "test", "test:e2e", "build"]) {
    assert.equal(typeof packageJson.scripts?.[script], "string", `missing root script: ${script}`);
  }
});

test("API package exposes fail-closed real-family onboarding and production acceptance", () => {
  const packageJson = JSON.parse(readFileSync("apps/api/package.json", "utf8"));
  for (const script of ["family:onboard-real", "family:accept-production"]) {
    assert.equal(typeof packageJson.scripts?.[script], "string", `missing API script: ${script}`);
  }
});
