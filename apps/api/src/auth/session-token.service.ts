import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

export interface IssuedSessionToken {
  rawToken: string;
  tokenHash: string;
}

@Injectable()
export class SessionTokenService {
  issue(): IssuedSessionToken {
    const rawToken = randomBytes(32).toString("base64url");
    return { rawToken, tokenHash: this.hash(rawToken) };
  }

  hash(rawToken: string): string {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
  }
}
