import type { NumericInputState } from "./types";

const INCOMPLETE_NUMERIC_INPUTS = new Set(["-", ".", "-."]);
const STRICT_DECIMAL_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u;

export function normalizeNumericInput(value: string): string {
  return value.trim().replaceAll("−", "-");
}

export function classifyNumericInput(value: string): NumericInputState {
  const normalized = normalizeNumericInput(value);
  if (normalized.length === 0) return "EMPTY";
  if (INCOMPLETE_NUMERIC_INPUTS.has(normalized)) return "TYPING_INCOMPLETE";
  if (!STRICT_DECIMAL_PATTERN.test(normalized)) return "INVALID_FORMAT";
  return Number.isFinite(Number(normalized)) ? "VALID_READY" : "INVALID_FORMAT";
}

export function parseNumericAnswer(value: string): number | null {
  if (classifyNumericInput(value) !== "VALID_READY") return null;
  const parsed = Number(normalizeNumericInput(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isEquivalentNumericAnswer(value: string, answerKey: number): boolean {
  const parsed = parseNumericAnswer(value);
  return parsed !== null && parsed === answerKey;
}
