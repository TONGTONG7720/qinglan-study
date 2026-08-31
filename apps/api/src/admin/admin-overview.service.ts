import type { AdminOverviewResponse, CurrentUser } from "@study/contracts";
import { AdminOverviewResponseSchema } from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service.js";

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: CurrentUser, now = new Date()): Promise<AdminOverviewResponse> {
    if (!actor.roles.includes("ADMIN")) throw new NotFoundException();
    const [
      activeInvitations, usedInvitations, revokedInvitations, expiredInvitations,
      draftTextbooks, confirmedTextbooks, retiredTextbooks,
      familiesConfigured, budgetTotals, failedCalls,
      deletionPending, deletionRunning, deletionFailed,
      aiErrorGroups,
    ] = await Promise.all([
      this.prisma.invitation.count({ where: { usedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
      this.prisma.invitation.count({ where: { usedAt: { not: null } } }),
      this.prisma.invitation.count({ where: { revokedAt: { not: null } } }),
      this.prisma.invitation.count({ where: { usedAt: null, revokedAt: null, expiresAt: { lte: now } } }),
      this.prisma.textbookEdition.count({ where: { status: "DRAFT" } }),
      this.prisma.textbookEdition.count({ where: { status: "CONFIRMED" } }),
      this.prisma.textbookEdition.count({ where: { status: "RETIRED" } }),
      this.prisma.familyAiBudget.count(),
      this.prisma.budgetPeriodUsage.aggregate({ _sum: { reservedFen: true, settledFen: true } }),
      this.prisma.modelCall.count({ where: { status: "FAILED" } }),
      this.prisma.retentionJob.count({ where: { kind: { in: ["PERSONAL_PURGE", "FAMILY_PURGE"] }, status: "PENDING" } }),
      this.prisma.retentionJob.count({ where: { kind: { in: ["PERSONAL_PURGE", "FAMILY_PURGE"] }, status: "RUNNING" } }),
      this.prisma.retentionJob.count({ where: { kind: { in: ["PERSONAL_PURGE", "FAMILY_PURGE"] }, status: "FAILED" } }),
      this.prisma.modelCall.groupBy({
        by: ["errorCode"],
        where: { status: "FAILED", errorCode: { not: null } },
        _count: { _all: true },
        orderBy: { errorCode: "asc" },
      }),
    ]);
    return AdminOverviewResponseSchema.parse({
      health: { status: "ok" },
      invitations: { active: activeInvitations, used: usedInvitations, revoked: revokedInvitations, expired: expiredInvitations },
      textbooks: { draft: draftTextbooks, confirmed: confirmedTextbooks, retired: retiredTextbooks },
      budgets: {
        familiesConfigured,
        reservedFen: budgetTotals._sum.reservedFen ?? 0,
        settledFen: budgetTotals._sum.settledFen ?? 0,
      },
      aiErrors: {
        failedCalls,
        byCode: aiErrorGroups.flatMap((group) => group.errorCode === null ? [] : [{ code: group.errorCode, count: group._count._all }]),
      },
      deletionJobs: { pending: deletionPending, running: deletionRunning, failed: deletionFailed },
      generatedAt: now.toISOString(),
    });
  }
}
