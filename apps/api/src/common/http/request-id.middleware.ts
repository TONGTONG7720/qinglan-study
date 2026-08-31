import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const RequestIdSchema = z.uuid();

export interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const suppliedRequestId = request.header("x-request-id");
    const parsedRequestId = RequestIdSchema.safeParse(suppliedRequestId);
    const requestId = parsedRequestId.success ? parsedRequestId.data : randomUUID();

    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  }
}
