import { randomUUID } from "node:crypto";

import { ErrorEnvelopeSchema } from "@study/contracts";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

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

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : isPersistenceConflict(exception)
        ? HttpStatus.CONFLICT
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const publicDetails = publicError(status);
    const envelope = ErrorEnvelopeSchema.parse({
      error: {
        ...publicDetails,
        requestId: request.requestId ?? randomUUID(),
      },
    });

    response.status(status).json(envelope);
  }
}
