import type { CurrentUser } from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class StudentRecordAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwnOrLinked(actor: CurrentUser, studentUserId: string): Promise<{ familyId: string }> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: studentUserId, status: "ACTIVE", user: { status: "ACTIVE" } },
      select: { familyId: true },
    });
    if (profile === null) throw new NotFoundException();
    if (actor.id === studentUserId && actor.roles.includes("STUDENT")) {
      return profile;
    }
    if (
      !actor.roles.includes("GUARDIAN")
      || actor.activeFamilyId === null
      || actor.activeFamilyId !== profile.familyId
    ) {
      throw new NotFoundException();
    }
    const [membership, relation] = await this.prisma.$transaction([
      this.prisma.familyMembership.count({
        where: {
          familyId: profile.familyId,
          userId: actor.id,
          role: "GUARDIAN",
          revokedAt: null,
          family: { status: "ACTIVE" },
        },
      }),
      this.prisma.guardianStudentRelation.count({
        where: {
          familyId: profile.familyId,
          guardianUserId: actor.id,
          studentUserId,
          revokedAt: null,
          family: { status: "ACTIVE" },
          student: { status: "ACTIVE" },
        },
      }),
    ]);
    if (membership !== 1 || relation !== 1) throw new NotFoundException();
    return profile;
  }
}
