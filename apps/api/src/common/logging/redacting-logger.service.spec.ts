import { describe, expect, it } from "vitest";

import { redactValue } from "./redacting-logger.service.js";

describe("redactValue", () => {
  it("removes nested secrets without removing safe metadata", () => {
    expect(
      redactValue({
        requestId: "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c",
        authorization: "Bearer private-value",
        nested: { apiKey: "private-value", operation: "health" },
      }),
    ).toEqual({
      requestId: "018f0f4e-2a5d-7aa0-8d44-a533e0b1092c",
      authorization: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", operation: "health" },
    });
  });
});
