import type { PlanCandidate } from "@study/contracts";
import { PlanCandidateSchema } from "@study/contracts";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service.js";

export interface PlanCandidateProvider {
  candidatesFor(studentUserId: string, at: Date): Promise<PlanCandidate[]>;
}

@Injectable()
export class DatabasePlanCandidateProvider implements PlanCandidateProvider {
  constructor(private readonly prisma: PrismaService) {}

  async candidatesFor(studentUserId: string, at: Date): Promise<PlanCandidate[]> {
    const rows = await this.prisma.planCandidate.findMany({
      where: { studentUserId, active: true, availableAt: { lte: at } },
      orderBy: [{ availableAt: "asc" }, { sourceId: "asc" }],
    });
    return rows.map((row) => PlanCandidateSchema.parse({
      sourceId: row.sourceId,
      sourceType: row.sourceType,
      title: row.title,
      estimatedMinutes: row.estimatedMinutes,
    }));
  }
}
