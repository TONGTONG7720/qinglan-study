import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";

import { HttpErrorFilter } from "./common/http/http-error.filter.js";
import { RequestIdMiddleware } from "./common/http/request-id.middleware.js";
import { createRequestSecurityMiddleware } from "./common/http/request-security.middleware.js";
import { RedactingLoggerService } from "./common/logging/redacting-logger.service.js";
import type { AppConfig } from "./config/app-config.js";

interface ProxyAwareHttpServer {
  set(setting: "trust proxy", value: number): void;
  disable(setting: "x-powered-by"): void;
}

export function configureApplication(app: INestApplication, config: AppConfig): void {
  const httpServer = app.getHttpAdapter().getInstance() as unknown as ProxyAwareHttpServer;
  const expressApp = app as NestExpressApplication;
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
    strictTransportSecurity: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: false,
    },
  }));
  httpServer.set("trust proxy", config.TRUST_PROXY_HOPS);
  httpServer.disable("x-powered-by");
  app.useLogger(new RedactingLoggerService());
  app.useGlobalFilters(new HttpErrorFilter());
  const requestIds = new RequestIdMiddleware();
  app.use((request: Request, response: Response, next: NextFunction) => {
    requestIds.use(request, response, next);
  });
  app.enableCors({
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Accept",
      "Content-Type",
      "Idempotency-Key",
      "X-Qinglang-CSRF",
      "X-Reauth-Proof",
      "X-Request-Id",
    ],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
    maxAge: 600,
    optionsSuccessStatus: 204,
  });
  app.use(createRequestSecurityMiddleware(config));
  expressApp.useBodyParser("json", { limit: config.REQUEST_BODY_LIMIT_BYTES });
  app.enableShutdownHooks();
}
