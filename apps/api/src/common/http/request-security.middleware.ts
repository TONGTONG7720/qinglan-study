import {
  ForbiddenException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { AppConfig } from "../../config/app-config.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const trustedClientHeader = "x-qinglang-csrf";

function isJsonMediaType(contentType: string): boolean {
  const [mediaType = ""] = contentType.split(";", 1);
  const normalized = mediaType.trim().toLowerCase();
  return normalized === "application/json" || normalized.endsWith("+json");
}

function requestHasBody(request: Request): boolean {
  const transferEncoding = request.header("transfer-encoding");
  if (transferEncoding !== undefined && transferEncoding.trim().length > 0) {
    return true;
  }
  const contentLength = request.header("content-length");
  if (contentLength === undefined) {
    return false;
  }
  const parsedLength = Number(contentLength);
  return Number.isFinite(parsedLength) && parsedLength > 0;
}

function allowedSourceOrigin(request: Request, allowedOrigins: ReadonlySet<string>): boolean {
  const origin = request.header("origin");
  if (origin !== undefined) {
    return allowedOrigins.has(origin);
  }

  const referer = request.header("referer");
  if (referer !== undefined) {
    try {
      return allowedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return request.header(trustedClientHeader) === "1";
}

export function createRequestSecurityMiddleware(config: AppConfig): RequestHandler {
  const allowedOrigins = new Set(config.ALLOWED_ORIGINS);

  return (request: Request, response: Response, next: NextFunction): void => {
    if (safeMethods.has(request.method.toUpperCase())) {
      next();
      return;
    }

    response.vary("Origin");
    response.vary("Sec-Fetch-Site");

    if (requestHasBody(request)) {
      const contentType = request.header("content-type");
      if (contentType === undefined || !isJsonMediaType(contentType)) {
        next(new UnsupportedMediaTypeException());
        return;
      }
    }

    if (!config.CSRF_PROTECTION_ENABLED) {
      next();
      return;
    }

    if (request.header("sec-fetch-site")?.toLowerCase() === "cross-site") {
      next(new ForbiddenException());
      return;
    }
    if (!allowedSourceOrigin(request, allowedOrigins)) {
      next(new ForbiddenException());
      return;
    }

    next();
  };
}
