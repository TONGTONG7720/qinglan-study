import { describe, expect, it } from "vitest";

import { isReadOnlyBetaStudentLocation, resolveReleaseScope } from "./release-scope-policy";

describe("Web release scope policy", () => {
  it("defaults production to the fail-closed read-only Beta", () => {
    expect(resolveReleaseScope("production", undefined)).toBe("READ_ONLY_BETA");
    expect(resolveReleaseScope("production", "READ_ONLY_BETA")).toBe("READ_ONLY_BETA");
  });

  it("rejects full preview and unknown scopes in production", () => {
    expect(() => resolveReleaseScope("production", "FULL_PREVIEW")).toThrow(/READ_ONLY_BETA/u);
    expect(() => resolveReleaseScope("production", "FULL_PRODUCT")).toThrow(/Unsupported/u);
  });

  it("keeps complete surfaces available for development and QA", () => {
    expect(resolveReleaseScope("test", undefined)).toBe("FULL_PREVIEW");
    expect(resolveReleaseScope("qa", "FULL_PREVIEW")).toBe("FULL_PREVIEW");
    expect(resolveReleaseScope("qa", "READ_ONLY_BETA")).toBe("READ_ONLY_BETA");
  });

  it("allows only base student reads as safe post-login destinations", () => {
    expect(isReadOnlyBetaStudentLocation("/student/today")).toBe(true);
    expect(isReadOnlyBetaStudentLocation("/student/learn?subject=MATH")).toBe(true);
    expect(isReadOnlyBetaStudentLocation("/student/today?view=plans")).toBe(false);
    expect(isReadOnlyBetaStudentLocation("/student/learn?view=practice-hub")).toBe(false);
    expect(isReadOnlyBetaStudentLocation("/guardian/overview")).toBe(false);
  });
});
