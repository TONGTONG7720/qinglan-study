import type { SubjectCode } from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service.js";

export interface RetrievalEvidence { id: string; excerpt: string; sourceReference: string; }

@Injectable()
export class CurriculumRetriever {
  constructor(private readonly prisma: PrismaService) {}
  async retrieve(studentUserId: string, subjectCode: SubjectCode, textbookEditionId: string, unitId: string, query: string): Promise<RetrievalEvidence[]> {
    const context = await this.prisma.studentTextbookContext.count({
      where: { studentUserId, subjectCode, textbookEditionId, status: "CONFIRMED", textbookEdition: { status: "CONFIRMED" }, currentUnitId: unitId },
    });
    if (context !== 1) throw new NotFoundException();
    let seed = 0;
    for (const character of query) {
      seed += character.codePointAt(0) ?? 0;
    }
    const values = [(seed % 7) / 7, (seed % 11) / 11, (seed % 13) / 13];
    const vector = `[${values.map((value) => String(value)).join(",")}]`;
    return this.prisma.$queryRaw<RetrievalEvidence[]>`
      SELECT "id", "excerpt", "sourceReference"
      FROM "ReviewedContent"
      WHERE "subjectCode" = ${subjectCode}::"SubjectCode"
        AND "textbookEditionId" = ${textbookEditionId}::uuid
        AND "unitId" = ${unitId}::uuid
        AND "status" = 'REVIEWED'::"ReviewedContentStatus"
      ORDER BY (
        ts_rank_cd(to_tsvector('simple', "excerpt"), plainto_tsquery('simple', ${query})) * 0.7
        + (1 - ("embedding" <=> ${vector}::vector)) * 0.3
      ) DESC
      LIMIT 3
    `;
  }
}
