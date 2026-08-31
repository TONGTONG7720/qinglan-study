import { describe, expect, it } from "vitest";

import { classifyNumericInput, isEquivalentNumericAnswer, normalizeNumericInput, parseNumericAnswer } from "./numeric-answer";

describe("numeric answer normalization", () => {
  it.each([
    ["", "EMPTY"],
    ["   ", "EMPTY"],
    ["-", "TYPING_INCOMPLETE"],
    [".", "TYPING_INCOMPLETE"],
    ["-.", "TYPING_INCOMPLETE"],
    ["3", "VALID_READY"],
    ["-7", "VALID_READY"],
    ["-7.0", "VALID_READY"],
    [" .5 ", "VALID_READY"],
    ["y=-7", "INVALID_FORMAT"],
    ["答案是 -7", "INVALID_FORMAT"],
    ["1 2", "INVALID_FORMAT"],
    ["-2×4+1", "INVALID_FORMAT"],
    ["1e3", "INVALID_FORMAT"],
    ["NaN", "INVALID_FORMAT"],
    ["Infinity", "INVALID_FORMAT"],
    ["1,000", "INVALID_FORMAT"],
  ] as const)("classifies %s as %s", (value, expected) => {
    expect(classifyNumericInput(value)).toBe(expected);
  });

  it("normalizes whitespace and the Unicode minus without accepting formulas", () => {
    expect(normalizeNumericInput("  −7.0  ")).toBe("-7.0");
    expect(parseNumericAnswer("  −7.0  ")).toBe(-7);
    expect(parseNumericAnswer("-2×4+1")).toBeNull();
  });

  it.each(["-7", "-7.0", " -7 ", "−7"])("accepts %s as equivalent to the answer key", (value) => {
    expect(isEquivalentNumericAnswer(value, -7)).toBe(true);
  });

  it.each(["7", "0", "-6.999", "y=-7", "-7e0"])("does not accept %s as the answer key", (value) => {
    expect(isEquivalentNumericAnswer(value, -7)).toBe(false);
  });
});
