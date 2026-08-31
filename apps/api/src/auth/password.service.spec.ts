import { describe, expect, it } from "vitest";

import { PasswordService } from "./password.service.js";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("uses Argon2id and verifies the original password", async () => {
    const hash = await service.hash("fictional-password-123");

    expect(hash).toMatch(/^\$argon2id\$/u);
    await expect(service.verify(hash, "fictional-password-123")).resolves.toBe(true);
    await expect(service.verify(hash, "wrong-password-456")).resolves.toBe(false);
  });
});
