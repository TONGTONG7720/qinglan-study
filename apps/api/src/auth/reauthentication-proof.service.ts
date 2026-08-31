import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

const proofTtlMilliseconds = 5 * 60 * 1_000;
const ProofPayloadSchema = z
  .object({
    userId: z.uuid(),
    sessionHash: z.string().regex(/^[0-9a-f]{64}$/u),
    expiresAt: z.number().int().positive(),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{22}$/u),
  })
  .strict();

export interface IssuedReauthenticationProof {
  proof: string;
  expiresAt: Date;
}

function secret(): string {
  const configured = process.env.REAUTH_PROOF_SECRET;
  if (configured !== undefined && configured.length >= 32) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("REAUTH_PROOF_SECRET must contain at least 32 characters in production");
  }
  return "development-only-reauth-secret-change-me";
}

function sessionHash(rawSessionToken: string): string {
  return createHash("sha256").update(rawSessionToken, "utf8").digest("hex");
}

@Injectable()
export class ReauthenticationProofService {
  issue(userId: string, rawSessionToken: string): IssuedReauthenticationProof {
    const expiresAt = new Date(Date.now() + proofTtlMilliseconds);
    const payload = ProofPayloadSchema.parse({
      userId,
      sessionHash: sessionHash(rawSessionToken),
      expiresAt: expiresAt.getTime(),
      nonce: randomBytes(16).toString("base64url"),
    });
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = this.sign(encodedPayload);
    return { proof: `${encodedPayload}.${signature}`, expiresAt };
  }

  verify(proof: string, userId: string, rawSessionToken: string): boolean {
    const [encodedPayload, suppliedSignature, extra] = proof.split(".");
    if (encodedPayload === undefined || suppliedSignature === undefined || extra !== undefined) {
      return false;
    }
    const expectedSignature = this.sign(encodedPayload);
    const supplied = Buffer.from(suppliedSignature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return false;
    }

    try {
      const decoded: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
      const payload = ProofPayloadSchema.parse(decoded);
      return (
        payload.userId === userId
        && payload.sessionHash === sessionHash(rawSessionToken)
        && payload.expiresAt > Date.now()
      );
    } catch {
      return false;
    }
  }

  private sign(encodedPayload: string): string {
    return createHmac("sha256", secret()).update(encodedPayload, "utf8").digest("base64url");
  }
}
