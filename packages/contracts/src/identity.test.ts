import { describe, expect, it } from "vitest";

import {
  AccessLevelSchema,
  GradeSchema,
  LoginInputSchema,
  RoleSchema,
  ScopeSchema,
} from "./identity.js";

describe("identity contracts", () => {
  it("accepts only approved product roles", () => {
    expect(RoleSchema.parse("STUDENT")).toBe("STUDENT");
    expect(() => RoleSchema.parse("TEACHER")).toThrow();
  });

  it("keeps family access level separate from product roles", () => {
    expect(AccessLevelSchema.parse("OWNER")).toBe("OWNER");
    expect(() => RoleSchema.parse("OWNER")).toThrow();
  });

  it("accepts only grades seven through nine", () => {
    expect(GradeSchema.parse(8)).toBe(8);
    expect(() => GradeSchema.parse(6)).toThrow();
  });

  it("requires a bounded login identifier and password", () => {
    expect(
      LoginInputSchema.parse({ loginId: "guardian@example.test", password: "test-password-123" }),
    ).toEqual({ loginId: "guardian@example.test", password: "test-password-123" });
    expect(() => LoginInputSchema.parse({ loginId: "x", password: "short" })).toThrow();
  });

  it("exposes only the four approved resource scopes", () => {
    expect(ScopeSchema.options).toEqual(["OWN", "LINKED_STUDENT", "FAMILY", "ADMIN_ONLY"]);
  });
});
