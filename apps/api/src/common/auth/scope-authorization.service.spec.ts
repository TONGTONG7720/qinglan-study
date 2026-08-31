import type { SessionPrincipal } from "@study/contracts";
import { describe, expect, it } from "vitest";

import {
  ResourceNotFoundError,
  ScopeAuthorizationService,
} from "./scope-authorization.service.js";

const principal: SessionPrincipal = {
  sessionId: "018f0f4e-1111-7111-8111-111111111111",
  userId: "018f0f4e-2222-7222-8222-222222222222",
  roles: ["GUARDIAN"],
  activeFamilyId: "018f0f4e-3333-7333-8333-333333333333",
};

describe("ScopeAuthorizationService", () => {
  const service = new ScopeAuthorizationService();

  it("allows OWN only for the current user", () => {
    expect(() => {
      service.assertOwn(principal, principal.userId);
    }).not.toThrow();
    expect(() => {
      service.assertOwn(principal, "018f0f4e-9999-7999-8999-999999999999");
    }).toThrow(ResourceNotFoundError);
  });

  it("requires both family membership and the active linked-student relation", () => {
    expect(() => {
      service.assertLinkedStudent(principal, {
        familyId: principal.activeFamilyId,
        studentUserId: "018f0f4e-4444-7444-8444-444444444444",
        activeFamilyMember: true,
        activeGuardianLink: true,
      });
    }).not.toThrow();

    for (const boundary of [
      { activeFamilyMember: false, activeGuardianLink: true },
      { activeFamilyMember: true, activeGuardianLink: false },
    ]) {
      expect(() => {
        service.assertLinkedStudent(principal, {
          familyId: principal.activeFamilyId,
          studentUserId: "018f0f4e-4444-7444-8444-444444444444",
          ...boundary,
        });
      }).toThrow(ResourceNotFoundError);
    }
  });

  it("uses the same non-disclosing error for cross-family access", () => {
    const capture = (operation: () => void): ResourceNotFoundError => {
      try {
        operation();
      } catch (error: unknown) {
        if (error instanceof ResourceNotFoundError) {
          return error;
        }
      }
      throw new Error("Expected ResourceNotFoundError");
    };

    const ownError = capture(() => {
      service.assertOwn(principal, "018f0f4e-9999-7999-8999-999999999999");
    });
    const familyError = capture(() => {
      service.assertFamily(principal, "018f0f4e-8888-7888-8888-888888888888", false);
    });

    expect({ code: ownError.code, message: ownError.message }).toEqual({
      code: familyError.code,
      message: familyError.message,
    });
  });
});
