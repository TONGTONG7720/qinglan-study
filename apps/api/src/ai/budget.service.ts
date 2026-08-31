import type { ModelPurpose } from "@study/contracts";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service.js";

function period(at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" })
    .format(at).slice(0, 7);
}

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async setFamilyCap(ownerUserId: string, familyId: string, monthlyCapFen: number): Promise<{ familyId: string; monthlyCapFen: number }> {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.familyMembership.count({
        where: {
          familyId,
          userId: ownerUserId,
          role: "GUARDIAN",
          accessLevel: "OWNER",
          revokedAt: null,
          family: { status: "ACTIVE" },
        },
      });
      if (owner !== 1) throw new NotFoundException();
      const budget = await tx.familyAiBudget.upsert({
        where: { familyId }, create: { familyId, monthlyCapFen }, update: { monthlyCapFen },
      });
      await tx.auditEvent.create({
        data: { actorUserId: ownerUserId, familyId, action: "FAMILY_AI_BUDGET_SET", resourceType: "FamilyAiBudget", resourceId: familyId, metadata: { monthlyCapFen } },
      });
      return budget;
    });
  }
  async reserve(familyId: string, userId: string, purpose: ModelPurpose, amountFen: number, key: string) {
    const dedupeKey = createHash("sha256").update(`${familyId}\0${key}`).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.budgetReservation.findUnique({ where: { dedupeKey } });
      const policy = await tx.aiBudgetPolicy.findUnique({ where: { id: "SYSTEM" } });
      if (policy === null) throw new NotFoundException();
      const familyBudget = await tx.familyAiBudget.findUnique({ where: { familyId } });
      const cap = Math.min(policy.systemMonthlyCapFen, familyBudget?.monthlyCapFen ?? policy.defaultFamilyCapFen);
      if (existing !== null) return { reservation: existing, effectiveCapFen: cap };
      const month = period();
      const usage = await tx.budgetPeriodUsage.upsert({
        where: { familyId_period: { familyId, period: month } },
        create: { familyId, period: month }, update: {},
      });
      const updated = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "BudgetPeriodUsage" SET "reservedFen" = "reservedFen" + ${amountFen}
        WHERE "id" = ${usage.id}::uuid
          AND "reservedFen" + "settledFen" + ${amountFen} <= ${cap}
        RETURNING "id"
      `;
      if (updated.length !== 1) throw new ConflictException();
      const reservation = await tx.budgetReservation.create({
        data: { familyId, userId, purpose, amountFen, dedupeKey },
      });
      return { reservation, effectiveCapFen: cap };
    }, { isolationLevel: "Serializable" });
  }

  async settle(reservationId: string, provider: string, costFen: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.budgetReservation.findFirst({ where: { id: reservationId, status: "RESERVED" } });
      if (reservation === null || costFen > reservation.amountFen) throw new ConflictException();
      const month = period(reservation.createdAt);
      await tx.budgetPeriodUsage.update({
        where: { familyId_period: { familyId: reservation.familyId, period: month } },
        data: { reservedFen: { decrement: reservation.amountFen }, settledFen: { increment: costFen } },
      });
      await tx.budgetReservation.update({ where: { id: reservation.id }, data: { status: "SETTLED" } });
      await tx.usageLedger.create({
        data: { reservationId: reservation.id, provider, purpose: reservation.purpose, costFen, redactedMetadata: { retained: false } },
      });
    });
  }

  async release(reservationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.budgetReservation.findFirst({ where: { id: reservationId, status: "RESERVED" } });
      if (reservation === null) return;
      await tx.budgetPeriodUsage.update({
        where: { familyId_period: { familyId: reservation.familyId, period: period(reservation.createdAt) } },
        data: { reservedFen: { decrement: reservation.amountFen } },
      });
      await tx.budgetReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED" } });
    });
  }
}
