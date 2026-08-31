import { describe, expect, it } from "vitest";

import { SessionTokenService } from "./session-token.service.js";

describe("SessionTokenService", () => {
  const service = new SessionTokenService();

  it("returns an opaque token and stores only its SHA-256 hash", () => {
    const issued = service.issue();

    expect(issued.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(issued.tokenHash).not.toContain(issued.rawToken);
    expect(service.hash(issued.rawToken)).toBe(issued.tokenHash);
  });

  it("creates a different token for every issue operation", () => {
    expect(service.issue().rawToken).not.toBe(service.issue().rawToken);
  });
});
