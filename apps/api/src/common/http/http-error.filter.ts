import { randomUUID } from "node:crypto";

import { ErrorEnvelopeSchema } from "@study/contracts";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

import { RedactingLoggerService } from "../logging/redacting-logger.service.js";
import type { RequestWithId } from "./request-id.middleware.js";

function publicError(status: number): { code: string; message: string } {
  const knownErrors: Readonly<Record<number, { code: string; message: string }>> = {
    [HttpStatus.BAD_REQUEST]: { code: "INVALID_REQUEST", message: "请求参数无效" },
    [HttpStatus.UNAUTHORIZED]: {
      code: "AUTHENTICATION_REQUIRED",
      message: "需要重新登录",
    },
    [HttpStatus.FORBIDDEN]: {
      code: "RESOURCE_NOT_FOUND",
      message: "资源不存在或不可访问",
    },
    [HttpStatus.NOT_FOUND]: {
      code: "RESOURCE_NOT_FOUND",
      message: "资源不存在或不可访问",
    },
    [HttpStatus.CONFLICT]: {
      code: "CONFLICT",
      message: "请求与当前状态冲突",
    },
    [HttpStatus.PAYLOAD_TOO_LARGE]: {
      code: "REQUEST_TOO_LARGE",
      message: "请求内容过大",
    },
    [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: {
      code: "INVALID_REQUEST",
      message: "请求参数无效",
    },
    [HttpStatus.TOO_MANY_REQUESTS]: {
      code: "TOO_MANY_REQUESTS",
      message: "请求过于频繁，请稍后再试",
    },
  };

  return knownErrors[status] ?? { code: "INTERNAL_ERROR", message: "请求处理失败" };
}

function isPersistenceConflict(exception: unknown): boolean {
  return (
    typeof exception === "object"
    && exception !== null
    && "code" in exception
    && (exception.code === "P2002" || exception.code === "P2034")
  );
}

function exceptionStatus(exception: unknown): number | undefined {
  if (typeof exception !== "object" || exception === null) {
    return undefined;
  }
  const exceptionRecord = exception as Readonly<Record<string, unknown>>;
  for (const key of ["status", "statusCode"] as const) {
    const value = exceptionRecord[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599) {
      return value;
    }
  }
  return undefined;
}

function routePattern(request: RequestWithId): string {
  const requestRecord = request as unknown as Readonly<Record<string, unknown>>;
  const route = requestRecord.route;
  const routePath = typeof route === "object" && route !== null && "path" in route
    ? route.path
    : undefined;
  return typeof routePath === "string" ? `${request.baseUrl}${routePath}` : "unmatched";
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new RedactingLoggerService();

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : isPersistenceConflict(exception)
        ? HttpStatus.CONFLICT
        : exceptionStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const publicDetails = publicError(status);
    const requestId = request.requestId ?? randomUUID();
    const envelope = ErrorEnvelopeSchema.parse({
      error: {
        ...publicDetails,
        requestId,
      },
    });

    if (status === 429) {
      this.logger.warn({
        event: "security_rate_limit_exceeded",
        requestId,
        method: request.method,
        route: routePattern(request),
      });
    } else if (status >= 500) {
      this.logger.error({
        event: "http_request_failed",
        requestId,
        method: request.method,
        route: routePattern(request),
        status,
      });
    }

    response.status(status).json(envelope);
  }
}
