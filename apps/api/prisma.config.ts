import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, env } from "prisma/config";

const rootEnvironmentPath = resolve(import.meta.dirname, "../../.env");
if (process.env.NODE_ENV !== "production" && existsSync(rootEnvironmentPath)) {
  process.loadEnvFile(rootEnvironmentPath);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
