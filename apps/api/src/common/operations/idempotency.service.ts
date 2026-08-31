import { createHash, randomUUID } from "node:crypto";

import { ConflictException, Injectable } from "@nestjs/common";
import type { z } from "zod";

import type { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

const maxSerializableAttempts = 3;

interface StoredPayload {
  requestHash: string;
  result?: unknown;
}

export interface IdempotentOperation<T> {
  kind: string;
  key: string;
  scope: string;
  actorUserId: string | null;
  familyId: string | null;
  request: unknown;
  resultSchema: z.ZodType<T>;
  serializeResult?: (result: T) => unknown;
  restoreResult?: (storedResult: unknown) => T;
  execute: (transaction: Prisma.TransactionClient) => Promise<T>;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function serializableConflict(error: unknown): boolean {
  return (
    (typeof error === "object" && error !== null && "code" in error && error.code === "P2034")
    || String(error).includes("TransactionWriteConflict")
    || String(error).includes("write conflict or a deadlock")
  );
}

function parseStoredPayload(value: Prisma.JsonValue): StoredPayload {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || typeof value.requestHash !== "string"
  ) {
    throw new ConflictException();
  }
  return { requestHash: value.requestHash, result: value.result };
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(operation: IdempotentOperation<T>): Promise<T> {
    for (let attempt = 1; attempt <= maxSerializableAttempts; attempt += 1) {
      try {
        return await this.runOnce(operation);
      } catch (error) {
        if (!serializableConflict(error) || attempt === maxSerializableAttempts) {
          throw error;
        }
      }
    }
    throw new ConflictException();
  }

  private async runOnce<T>(operation: IdempotentOperation<T>): Promise<T> {
    const requestHash = sha256(JSON.stringify(operation.request));
    const dedupeKey = sha256(`${operation.scope}\u0000${operation.key}`);

    return this.prisma.$transaction(async (transaction) => {
      const operationId = randomUUID();
      const claimed = await transaction.$queryRaw<{ id: string }[]>`
        INSERT INTO "Operation" (
          "id", "userId", "familyId", "kind", "dedupeKey", "status",
          "attemptCount", "payload", "createdAt", "updatedAt"
        ) VALUES (
          ${operationId}::uuid,
          ${operation.actorUserId}::uuid,
          ${operation.familyId}::uuid,
          ${operation.kind},
          ${dedupeKey},
          'RUNNING'::"OperationStatus",
          1,
          ${JSON.stringify({ requestHash })}::jsonb,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("kind", "dedupeKey") DO NOTHING
        RETURNING "id"
      `;

      if (claimed.length === 0) {
        const existing = await transaction.operation.findUnique({
          where: { kind_dedupeKey: { kind: operation.kind, dedupeKey } },
          select: { status: true, payload: true },
        });
        if (existing?.payload === null) {
          throw new ConflictException();
        }
        const payload = existing === null ? null : parseStoredPayload(existing.payload);
        if (
          existing?.status !== "SUCCEEDED"
          || payload?.requestHash !== requestHash
          || payload.result === undefined
        ) {
          throw new ConflictException();
        }
        return operation.restoreResult === undefined
          ? operation.resultSchema.parse(payload.result)
          : operation.restoreResult(payload.result);
      }

      const result = await operation.execute(transaction);
      const storedResult = operation.serializeResult?.(result) ?? result;
      await transaction.operation.update({
        where: { id: operationId },
        data: {
          status: "SUCCEEDED",
          payload: jsonInput({ requestHash, result: storedResult }),
        },
      });
      return result;
    }, { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 });
  }
}
