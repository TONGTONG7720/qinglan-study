import type {
  CurrentUser,
  GenerateWeeklyReportInput,
  SubjectCode,
  WeeklyReportResponse,
  WeeklyReportSummary,
} from "@study/contracts";
import {
  WeeklyReportResponseSchema,
  WeeklyReportSummarySchema,
  buildWeeklySuggestions,
} from "@study/contracts";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { StudentRecordAccessService } from "../common/auth/student-record-access.service.js";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { Prisma } from "../generated/prisma/client.js";

const subjectOrder: readonly SubjectCode[] = [
  "CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY", "PHYSICS", "CHEMISTRY",
];

function notFound(): never {
  throw new NotFoundException();
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shanghaiDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class WeeklyReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudentRecordAccessService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async generate(
    actor: CurrentUser,
    studentUserId: string,
    input: GenerateWeeklyReportInput,
    key: string,
  ): Promise<WeeklyReportResponse> {
    const boundary = await this.access.assertOwnOrLinked(actor, studentUserId);
    const range = this.range(input.weekStart);
    return this.idempotency.run({
      kind: "GENERATE_WEEKLY_REPORT",
      key,
      scope: `${studentUserId}:${input.weekStart}`,
      actorUserId: actor.id,
      familyId: boundary.familyId,
      request: input,
      resultSchema: WeeklyReportResponseSchema,
      execute: async (transaction) => {
        const summary = await this.aggregate(transaction, studentUserId, range);
        const largestExamDecline = [...summary.examChanges]
          .filter((change) => change.deltaPercent !== null)
          .sort((left, right) => (left.deltaPercent ?? 0) - (right.deltaPercent ?? 0))[0] ?? null;
        const suggestions = buildWeeklySuggestions({
          completionRate: summary.completionRate,
          activeDays: summary.activeDays,
          weakestTitle: summary.weakKnowledgeNodes[0]?.title ?? null,
          largestExamDecline:
            largestExamDecline?.deltaPercent === undefined || largestExamDecline.deltaPercent === null
              ? null
              : { subjectCode: largestExamDecline.subjectCode, deltaPercent: largestExamDecline.deltaPercent },
        });
        const completionPercent = Math.round(summary.completionRate * 100);
        const narrative = `本周完成 ${String(summary.completedTasks)}/${String(summary.totalTasks)} 项计划任务，完成率 ${String(completionPercent)}%，活跃 ${String(summary.activeDays)} 天。建议以可验证的独立作答和补救任务继续巩固。`;
        const report = await transaction.weeklyReport.upsert({
          where: { studentUserId_weekStart: { studentUserId, weekStart: range.dbStart } },
          create: {
            studentUserId,
            weekStart: range.dbStart,
            weekEnd: range.dbEnd,
            summary: json(summary),
            narrative,
            suggestions: json(suggestions),
          },
          update: {
            weekEnd: range.dbEnd,
            summary: json(summary),
            narrative,
            suggestions: json(suggestions),
            generatedAt: new Date(),
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: boundary.familyId,
            action: "WEEKLY_REPORT_GENERATED",
            resourceType: "WeeklyReport",
            resourceId: report.id,
            metadata: { weekStart: input.weekStart },
          },
        });
        return this.result(report);
      },
    });
  }

  async get(actor: CurrentUser, studentUserId: string, weekStart: string): Promise<WeeklyReportResponse> {
    await this.access.assertOwnOrLinked(actor, studentUserId);
    const range = this.range(weekStart);
    const report = await this.prisma.weeklyReport.findUnique({
      where: { studentUserId_weekStart: { studentUserId, weekStart: range.dbStart } },
    });
    if (report === null) return notFound();
    return this.result(report);
  }

  private range(weekStart: string): {
    dbStart: Date;
    dbEnd: Date;
    instantStart: Date;
    instantEnd: Date;
  } {
    const dbStart = new Date(`${weekStart}T00:00:00.000Z`);
    if (dbStart.getUTCDay() !== 1) throw new BadRequestException();
    const dbEnd = new Date(dbStart.getTime() + 6 * 24 * 60 * 60 * 1_000);
    return {
      dbStart,
      dbEnd,
      instantStart: new Date(`${weekStart}T00:00:00.000+08:00`),
      instantEnd: new Date(new Date(`${weekStart}T00:00:00.000+08:00`).getTime() + 7 * 24 * 60 * 60 * 1_000),
    };
  }

  private async aggregate(
    transaction: Prisma.TransactionClient,
    studentUserId: string,
    range: { dbStart: Date; dbEnd: Date; instantStart: Date; instantEnd: Date },
  ): Promise<WeeklyReportSummary> {
    const [totalTasks, completedTasks, evidence, mastery, weakest, exams] = await Promise.all([
      transaction.planTask.count({
        where: { dailyPlan: { studentUserId, learningDay: { gte: range.dbStart, lte: range.dbEnd } } },
      }),
      transaction.planTask.count({
        where: { status: "COMPLETED", dailyPlan: { studentUserId, learningDay: { gte: range.dbStart, lte: range.dbEnd } } },
      }),
      transaction.learningEvidence.findMany({
        where: { studentUserId, occurredAt: { gte: range.instantStart, lt: range.instantEnd } },
        select: { occurredAt: true },
      }),
      transaction.masteryState.findMany({
        where: { studentUserId },
        select: { subjectCode: true, score: true, confidence: true },
        orderBy: [{ subjectCode: "asc" }, { id: "asc" }],
      }),
      transaction.masteryState.findMany({
        where: { studentUserId, knowledgeNodeId: { not: null } },
        include: { knowledgeNode: { select: { title: true } } },
        orderBy: [{ score: "asc" }, { id: "asc" }],
        take: 3,
      }),
      transaction.exam.findMany({
        where: { studentUserId, status: "CONFIRMED", occurredAt: { lt: range.instantEnd } },
        select: { id: true, subjectCode: true, occurredAt: true, totalScoreHundredths: true, totalMaxScoreHundredths: true },
        orderBy: [{ subjectCode: "asc" }, { occurredAt: "desc" }, { id: "desc" }],
      }),
    ]);
    const subjectTrends = subjectOrder.flatMap((subjectCode) => {
      const rows = mastery.filter((row) => row.subjectCode === subjectCode);
      if (rows.length === 0) return [];
      return [{
        subjectCode,
        masteryScore: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length),
        confidence: Math.round(rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length * 1_000_000) / 1_000_000,
      }];
    });
    const weakKnowledgeNodes = weakest.flatMap((row) =>
      row.knowledgeNodeId === null || row.knowledgeNode === null
        ? []
        : [{
          knowledgeNodeId: row.knowledgeNodeId,
          title: row.knowledgeNode.title,
          subjectCode: row.subjectCode,
          score: row.score,
        }]);
    const examChanges = subjectOrder.flatMap((subjectCode) => {
      const rows = exams.filter((exam) =>
        exam.subjectCode === subjectCode
        && exam.totalScoreHundredths !== null
        && exam.totalMaxScoreHundredths !== null);
      const current = rows[0];
      if (current === undefined || current.occurredAt < range.instantStart) return [];
      const previous = rows[1];
      const currentPercent = Math.round((current.totalScoreHundredths ?? 0) / (current.totalMaxScoreHundredths ?? 1) * 10_000) / 100;
      const previousPercent = previous === undefined
        ? null
        : Math.round((previous.totalScoreHundredths ?? 0) / (previous.totalMaxScoreHundredths ?? 1) * 10_000) / 100;
      return [{
        subjectCode,
        previousPercent,
        currentPercent,
        deltaPercent: previousPercent === null ? null : Math.round((currentPercent - previousPercent) * 100) / 100,
      }];
    });
    return WeeklyReportSummarySchema.parse({
      completedTasks,
      totalTasks,
      completionRate: totalTasks === 0 ? 0 : Math.round(completedTasks / totalTasks * 1_000_000) / 1_000_000,
      activeDays: new Set(evidence.map((item) => shanghaiDay(item.occurredAt))).size,
      subjectTrends,
      weakKnowledgeNodes,
      examChanges,
    });
  }

  private result(report: {
    id: string;
    studentUserId: string;
    weekStart: Date;
    weekEnd: Date;
    summary: Prisma.JsonValue;
    narrative: string;
    suggestions: Prisma.JsonValue;
    generatedAt: Date;
  }): WeeklyReportResponse {
    return WeeklyReportResponseSchema.parse({
      id: report.id,
      studentUserId: report.studentUserId,
      weekStart: dateOnly(report.weekStart),
      weekEnd: dateOnly(report.weekEnd),
      summary: report.summary,
      narrative: report.narrative,
      suggestions: report.suggestions,
      generatedAt: report.generatedAt.toISOString(),
    });
  }
}
