import { describe, expect, it } from "vitest";

import { selectModelProvider } from "./ai.module.js";
import type { ModelProvider } from "./model-gateway.service.js";

function provider(name: string): ModelProvider {
  return {
    name,
    reservationCostFen: () => 1,
    call: () => Promise.reject(new Error("not called")),
  };
}

describe("production provider selection", () => {
  const providers = {
    fake: provider("fake"),
    disabled: provider("disabled"),
    openAiCompatible: provider("openai-compatible"),
  };

  it("uses the deterministic fake only in tests", () => {
    expect(selectModelProvider("test", undefined, providers)).toBe(providers.fake);
    expect(selectModelProvider("test", "fake", providers)).toBe(providers.fake);
    expect(() => selectModelProvider("test", "disabled", providers)).toThrow();
  });

  it("defaults every non-test environment to disabled and rejects fake", () => {
    expect(selectModelProvider("development", undefined, providers)).toBe(providers.disabled);
    expect(selectModelProvider("production", "disabled", providers)).toBe(providers.disabled);
    expect(selectModelProvider("production", "openai-compatible", providers))
      .toBe(providers.openAiCompatible);
    expect(() => selectModelProvider("production", "fake", providers))
      .toThrow("MODEL_PROVIDER=fake is test-only");
  });
});
