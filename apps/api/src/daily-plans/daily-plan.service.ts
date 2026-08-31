import type {
  CompletePlanTaskInput, CurrentUser, DailyPlanResponse,
  OperationResponse, PlanTaskCompletionResponse,
} from "@study/contracts";
import {
  DailyPlanResponseSchema, OperationResponseSchema, PlanTaskCompletionResponseSchema,
  learningDayInShanghai, selectDailyPlanCandidates,
} from "@study/contracts";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { DatabasePlanCandidateProvider } from "./plan-candidate.provider.js";

function notFound(): never { throw new NotFoundException(); }

@Injectable()
export class DailyPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: DatabasePlanCandidateProvider,
    private readonly idempotency: IdempotencyService,
  ) {}

  async generate(actor: CurrentUser, studentUserId: string, key: string, now = new Date()): Promise<DailyPlanResponse> {
    this.requireStudent(actor, studentUserId);
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: studentUserId, status: "ACTIVE", user: { status: "ACTIVE" } },
      select: { dailyMinutes: true },
    });
    if (profile === null) return notFound();
    const day = learningDayInShanghai(now);
    const learningDay = new Date(`${day}T00:00:00.000Z`);
    const candidates = selectDailyPlanCandidates(
      await this.provider.candidatesFor(studentUserId, now), profile.dailyMinutes,
    );
    try {
      return await this.idempotency.run({
        kind: "GENERATE_DAILY_PLAN", key, scope: `${studentUserId}:${day}`,
        actorUserId: actor.id, familyId: actor.activeFamilyId,
        request: { studentUserId, day }, resultSchema: DailyPlanResponseSchema,
        execute: async (transaction) => {
          const existing = await transaction.dailyPlan.findUnique({
            where: { studentUserId_learningDay: { studentUserId, learningDay } }, include: { tasks: true },
          });
          if (existing !== null) return this.planResult(existing, day);
          const plan = await transaction.dailyPlan.create({
            data: {
              studentUserId, learningDay,
              totalMinutes: candidates.reduce((sum, item) => sum + item.estimatedMinutes, 0),
              tasks: { create: candidates.map((item, index) => ({ ...item, ordinal: index + 1 })) },
            }, include: { tasks: true },
          });
          return this.planResult(plan, day);
        },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        const plan = await this.prisma.dailyPlan.findUniqueOrThrow({
          where: { studentUserId_learningDay: { studentUserId, learningDay } }, include: { tasks: true },
        });
        return this.planResult(plan, day);
      }
      throw error;
    }
  }

  async today(actor: CurrentUser, studentUserId: string, now = new Date()): Promise<DailyPlanResponse> {
    this.requireStudent(actor, studentUserId);
    const day = learningDayInShanghai(now);
    const plan = await this.prisma.dailyPlan.findUnique({
      where: { studentUserId_learningDay: { studentUserId, learningDay: new Date(`${day}T00:00:00.000Z`) } },
      include: { tasks: true },
    });
    if (plan === null) return notFound();
    return this.planResult(plan, day);
  }

  async complete(actor: CurrentUser, taskId: string, input: CompletePlanTaskInput, key: string): Promise<PlanTaskCompletionResponse> {
    if (!actor.roles.includes("STUDENT")) return notFound();
    return this.idempotency.run({
      kind: "COMPLETE_PLAN_TASK", key, scope: `${actor.id}:${taskId}`,
      actorUserId: actor.id, familyId: actor.activeFamilyId,
      request: { taskId, ...input }, resultSchema: PlanTaskCompletionResponseSchema,
      execute: async (transaction) => {
        const task = await transaction.planTask.findFirst({
          where: { id: taskId, dailyPlan: { studentUserId: actor.id } }, include: { completion: true },
        });
        if (task === null) return notFound();
        if (task.completion !== null) {
          if (task.completion.evidenceId !== input.evidence.evidenceId) throw new ConflictException();
          return PlanTaskCompletionResponseSchema.parse({ ...task.completion, completedAt: task.completion.completedAt.toISOString() });
        }
        const examRemediation = task.sourceType === "EXAM_REMEDIATION";
        if (
          examRemediation
          && input.evidence.type !== "RECOVERY_ATTEMPT"
          && input.evidence.type !== "REVIEW_SUCCEEDED"
        ) return notFound();
        const evidence = await transaction.learningEvidence.findFirst({
          where: {
            id: input.evidence.evidenceId,
            studentUserId: actor.id,
            type: input.evidence.type,
            ...(examRemediation ? { independent: true, valid: true } : {}),
          },
        });
        if (evidence === null) return notFound();
        if (examRemediation) {
          const linked = await transaction.remediationLink.updateMany({
            where: {
              id: task.sourceId,
              studentUserId: actor.id,
              evidenceId: null,
              exam: { status: "CONFIRMED" },
            },
            data: { evidenceId: evidence.id, completedAt: new Date() },
          });
          if (linked.count !== 1) return notFound();
        }
        const completion = await transaction.planTaskCompletion.create({
          data: { planTaskId: task.id, evidenceId: evidence.id },
        });
        await transaction.planTask.update({ where: { id: task.id }, data: { status: "COMPLETED" } });
        await transaction.planCandidate.updateMany({
          where: { studentUserId: actor.id, sourceType: task.sourceType, sourceId: task.sourceId }, data: { active: false },
        });
        return PlanTaskCompletionResponseSchema.parse({ ...completion, completedAt: completion.completedAt.toISOString() });
      },
    });
  }

  async operation(actor: CurrentUser, operationId: string): Promise<OperationResponse> {
    const operation = await this.prisma.operation.findFirst({ where: { id: operationId, userId: actor.id } });
    if (operation === null) return notFound();
    return OperationResponseSchema.parse({
      id: operation.id,
      kind: operation.kind,
      status: operation.status,
      lastErrorCode: operation.lastErrorCode,
      updatedAt: operation.updatedAt.toISOString(),
    });
  }

  private requireStudent(actor: CurrentUser, studentUserId: string): void {
    if (actor.id !== studentUserId || !actor.roles.includes("STUDENT")) return notFound();
  }

  private planResult(plan: { id: string; studentUserId: string; totalMinutes: number; tasks: { id: string; sourceType: "OVERDUE_REVIEW" | "EXAM_REMEDIATION" | "CURRENT_UNIT" | "DIAGNOSTIC"; sourceId: string; title: string; estimatedMinutes: number; ordinal: number; status: "PENDING" | "COMPLETED" }[] }, day: string): DailyPlanResponse {
    return DailyPlanResponseSchema.parse({
      id: plan.id, studentUserId: plan.studentUserId, learningDay: day, totalMinutes: plan.totalMinutes,
      tasks: [...plan.tasks].sort((a, b) => a.ordinal - b.ordinal).map((task) => ({
        id: task.id,
        sourceType: task.sourceType,
        sourceId: task.sourceId,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
        ordinal: task.ordinal,
        status: task.status,
      })),
    });
  }
}
