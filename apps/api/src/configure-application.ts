import type { INestApplication } from "@nestjs/common";

import { HttpErrorFilter } from "./common/http/http-error.filter.js";
import { RedactingLoggerService } from "./common/logging/redacting-logger.service.js";
import type { AppConfig } from "./config/app-config.js";

export function configureApplication(app: INestApplication, config: AppConfig): void {
  app.useLogger(new RedactingLoggerService());
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableCors({ origin: config.ALLOWED_ORIGINS, credentials: true });
  app.enableShutdownHooks();
}
