import type { SessionPrincipal } from "@study/contracts";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import { ScopeAuthorizationService } from "./scope-authorization.service.js";

@Injectable()
export class FamilyAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeAuthorizationService,
  ) {}

  async assertLinkedStudent(
    principal: SessionPrincipal,
    familyId: string,
    studentUserId: string,
  ): Promise<void> {
    const [membershipCount, relationCount] = await this.prisma.$transaction([
      this.prisma.familyMembership.count({
        where: {
          familyId,
          userId: principal.userId,
          revokedAt: null,
          family: { status: "ACTIVE" },
        },
      }),
      this.prisma.guardianStudentRelation.count({
        where: {
          familyId,
          guardianUserId: principal.userId,
          studentUserId,
          revokedAt: null,
          family: { status: "ACTIVE" },
          student: { status: "ACTIVE" },
        },
      }),
    ]);

    this.scopes.assertLinkedStudent(principal, {
      familyId,
      studentUserId,
      activeFamilyMember: membershipCount > 0,
      activeGuardianLink: relationCount > 0,
    });
  }
}
