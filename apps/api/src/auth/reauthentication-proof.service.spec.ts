import { describe, expect, it } from "vitest";

import { ReauthenticationProofService } from "./reauthentication-proof.service.js";

describe("ReauthenticationProofService", () => {
  it("binds a short-lived signed proof to both user and session", () => {
    process.env.REAUTH_PROOF_SECRET = "fictional-development-reauth-secret-123456";
    const service = new ReauthenticationProofService();
    const issued = service.issue(
      "018f0f4e-2222-7222-8222-222222222222",
      "fictional-session-token",
    );

    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(
      service.verify(
        issued.proof,
        "018f0f4e-2222-7222-8222-222222222222",
        "fictional-session-token",
      ),
    ).toBe(true);
    expect(
      service.verify(
        issued.proof,
        "018f0f4e-9999-7999-8999-999999999999",
        "fictional-session-token",
      ),
    ).toBe(false);
    expect(
      service.verify(
        issued.proof,
        "018f0f4e-2222-7222-8222-222222222222",
        "different-session-token",
      ),
    ).toBe(false);
  });
});
