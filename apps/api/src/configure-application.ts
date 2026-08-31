import type { INestApplication } from "@nestjs/common";

import { HttpErrorFilter } from "./common/http/http-error.filter.js";
import { RedactingLoggerService } from "./common/logging/redacting-logger.service.js";
import type { AppConfig } from "./config/app-config.js";

interface ProxyAwareHttpServer {
  set(setting: "trust proxy", value: number): void;
}

export function configureApplication(app: INestApplication, config: AppConfig): void {
  const httpServer = app.getHttpAdapter().getInstance() as unknown as ProxyAwareHttpServer;
  httpServer.set("trust proxy", config.TRUST_PROXY_HOPS);
  app.useLogger(new RedactingLoggerService());
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableCors({ origin: config.ALLOWED_ORIGINS, credentials: true });
  app.enableShutdownHooks();
}
