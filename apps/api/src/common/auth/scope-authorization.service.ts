import type { SessionPrincipal } from "@study/contracts";
import { Injectable } from "@nestjs/common";

export class ResourceNotFoundError extends Error {
  readonly code = "RESOURCE_NOT_FOUND";

  constructor() {
    super("资源不存在或不可访问");
    this.name = "ResourceNotFoundError";
  }
}

export interface LinkedStudentBoundary {
  familyId: string | null;
  studentUserId: string;
  activeFamilyMember: boolean;
  activeGuardianLink: boolean;
}

@Injectable()
export class ScopeAuthorizationService {
  assertOwn(principal: SessionPrincipal, resourceOwnerUserId: string): void {
    if (principal.userId !== resourceOwnerUserId) {
      throw new ResourceNotFoundError();
    }
  }

  assertFamily(
    principal: SessionPrincipal,
    resourceFamilyId: string | null,
    activeFamilyMember: boolean,
  ): void {
    if (
      principal.activeFamilyId === null
      || resourceFamilyId === null
      || principal.activeFamilyId !== resourceFamilyId
      || !activeFamilyMember
    ) {
      throw new ResourceNotFoundError();
    }
  }

  assertLinkedStudent(principal: SessionPrincipal, boundary: LinkedStudentBoundary): void {
    this.assertFamily(principal, boundary.familyId, boundary.activeFamilyMember);
    if (!principal.roles.includes("GUARDIAN") || !boundary.activeGuardianLink) {
      throw new ResourceNotFoundError();
    }
  }

  assertAdmin(principal: SessionPrincipal): void {
    if (!principal.roles.includes("ADMIN")) {
      throw new ResourceNotFoundError();
    }
  }
}
