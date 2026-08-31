import "reflect-metadata";

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { RedactingLoggerService } from "./common/logging/redacting-logger.service.js";
import { readAppConfig } from "./config/app-config.js";
import { configureApplication } from "./configure-application.js";

const rootEnvironmentPath = resolve(import.meta.dirname, "../../../.env");
if (process.env.NODE_ENV !== "production" && existsSync(rootEnvironmentPath)) {
  process.loadEnvFile(rootEnvironmentPath);
}

async function bootstrap(): Promise<void> {
  const config = readAppConfig(process.env);
  const logger = new RedactingLoggerService();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  configureApplication(app, config);

  await app.listen(config.API_PORT, config.API_HOST);
  logger.log({ event: "api_started", host: config.API_HOST, port: config.API_PORT });
}

bootstrap().catch((error: unknown) => {
  const logger = new RedactingLoggerService();
  logger.error(error, { event: "api_start_failed" });
  process.exitCode = 1;
});
