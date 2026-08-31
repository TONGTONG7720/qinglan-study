import { describe, expect, it } from "vitest";
import {
  ExportArchiveSchema,
  SecurityPolicyInputSchema,
  decideSecurityPolicy,
} from "./phase10.js";

describe("Phase 10 privacy and retention contracts", () => {
  it("keeps export archives on an explicit secret-free allowlist", () => {
    const keys = JSON.stringify(ExportArchiveSchema).toLowerCase();
    for (const forbidden of ["password", "tokenhash", "session", "storagekey", "prompttext", "providerpayload"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("returns deterministic allow, redirect and block decisions without raw content", () => {
    expect(decideSecurityPolicy({ category: "ACADEMIC_REQUEST", signalCode: "NORMAL" })).toBe("ALLOW");
    expect(decideSecurityPolicy({ category: "ANSWER_SEEKING", signalCode: "DIRECT_ANSWER" })).toBe("SAFE_REDIRECT");
    expect(decideSecurityPolicy({ category: "SELF_HARM", signalCode: "HIGH_RISK" })).toBe("BLOCK");
    expect(SecurityPolicyInputSchema.safeParse({ category: "SELF_HARM", signalCode: "HIGH_RISK", rawText: "secret" }).success).toBe(false);
  });
});
