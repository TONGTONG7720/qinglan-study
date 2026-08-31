import type {
  ConfirmStudentTextbookContextInput,
  ConfirmTextbookInput,
  CreateTextbookDraftInput,
  CurrentUser,
  Grade,
  RetireTextbookInput,
  StudentTextbookContextResponse,
  SubjectAvailabilityResponse,
  SubjectCode,
  SubmitStudentTextbookContextInput,
  TextbookSummary,
  UpdateCurrentUnitInput,
} from "@study/contracts";
import {
  StudentTextbookContextResponseSchema,
  SubjectAvailabilityResponseSchema,
  TextbookSummarySchema,
  availableSubjectsForGrade,
  isSubjectAvailableForGrade,
} from "@study/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";

import { IdempotencyService } from "../common/operations/idempotency.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";

function notFound(): never {
  throw new NotFoundException();
}

function requireAdmin(actor: CurrentUser): void {
  if (!actor.roles.includes("ADMIN")) {
    return notFound();
  }
}

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  availability(grade: Grade): SubjectAvailabilityResponse {
    return SubjectAvailabilityResponseSchema.parse({
      grade,
      subjects: [...availableSubjectsForGrade(grade)],
    });
  }

  async createTextbook(
    actor: CurrentUser,
    input: CreateTextbookDraftInput,
    idempotencyKey: string,
  ): Promise<TextbookSummary> {
    requireAdmin(actor);
    if (!isSubjectAvailableForGrade(input.grade, input.subjectCode)) {
      return notFound();
    }
    return this.idempotency.run({
      kind: "CREATE_TEXTBOOK_DRAFT",
      key: idempotencyKey,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: input,
      resultSchema: TextbookSummarySchema,
      execute: async (transaction) => {
        const textbook = await transaction.textbookEdition.create({
          data: {
            subjectCode: input.subjectCode,
            grade: input.grade,
            publisher: input.publisher,
            editionName: input.editionName,
            volume: input.volume,
            units: {
              create: input.units.map((unit) => ({
                ordinal: unit.ordinal,
                title: unit.title,
                knowledgeNodes: { create: unit.knowledgeNodes },
              })),
            },
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "CURRICULUM_TEXTBOOK_DRAFT_CREATED",
            resourceType: "TextbookEdition",
            resourceId: textbook.id,
            metadata: { subjectCode: input.subjectCode, grade: input.grade },
          },
        });
        return this.textbookResult(textbook);
      },
    });
  }

  async confirmTextbook(
    actor: CurrentUser,
    textbookId: string,
    input: ConfirmTextbookInput,
    idempotencyKey: string,
  ): Promise<TextbookSummary> {
    requireAdmin(actor);
    return this.idempotency.run({
      kind: "CONFIRM_TEXTBOOK",
      key: idempotencyKey,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { textbookId, ...input },
      resultSchema: TextbookSummarySchema,
      execute: async (transaction) => {
        const textbook = await transaction.textbookEdition.findFirst({
          where: { id: textbookId, status: "DRAFT" },
          include: { units: { include: { knowledgeNodes: true } } },
        });
        if (textbook === null || textbook.units.length === 0
          || textbook.units.some((unit) => unit.knowledgeNodes.length === 0)) {
          return notFound();
        }
        const now = new Date();
        const confirmed = await transaction.textbookEdition.update({
          where: { id: textbook.id },
          data: {
            status: "CONFIRMED",
            sourceReference: input.sourceReference,
            verifiedByUserId: actor.id,
            verifiedAt: now,
          },
        });
        await transaction.unit.updateMany({
          where: { textbookEditionId: textbook.id },
          data: { status: "CONFIRMED" },
        });
        await transaction.knowledgeNode.updateMany({
          where: { unit: { textbookEditionId: textbook.id } },
          data: { status: "CONFIRMED" },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "CURRICULUM_TEXTBOOK_CONFIRMED",
            resourceType: "TextbookEdition",
            resourceId: textbook.id,
            metadata: { sourceReference: input.sourceReference },
          },
        });
        return this.textbookResult(confirmed);
      },
    });
  }

  async retireTextbook(
    actor: CurrentUser,
    textbookId: string,
    input: RetireTextbookInput,
    idempotencyKey: string,
  ): Promise<TextbookSummary> {
    requireAdmin(actor);
    return this.idempotency.run({
      kind: "RETIRE_TEXTBOOK",
      key: idempotencyKey,
      scope: actor.id,
      actorUserId: actor.id,
      familyId: null,
      request: { textbookId, ...input },
      resultSchema: TextbookSummarySchema,
      execute: async (transaction) => {
        const existing = await transaction.textbookEdition.findFirst({
          where: { id: textbookId, status: "CONFIRMED" },
        });
        if (existing === null) {
          return notFound();
        }
        const retired = await transaction.textbookEdition.update({
          where: { id: textbookId },
          data: { status: "RETIRED" },
        });
        await transaction.unit.updateMany({
          where: { textbookEditionId: textbookId },
          data: { status: "RETIRED" },
        });
        await transaction.knowledgeNode.updateMany({
          where: { unit: { textbookEditionId: textbookId } },
          data: { status: "RETIRED" },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            action: "CURRICULUM_TEXTBOOK_RETIRED",
            resourceType: "TextbookEdition",
            resourceId: textbookId,
            reason: input.reason,
          },
        });
        return this.textbookResult(retired);
      },
    });
  }

  async submitContext(
    actor: CurrentUser,
    studentUserId: string,
    subjectCode: SubjectCode,
    input: SubmitStudentTextbookContextInput,
    idempotencyKey: string,
  ): Promise<StudentTextbookContextResponse> {
    const boundary = await this.studentBoundary(actor, studentUserId, subjectCode, "GUARDIAN");
    return this.idempotency.run({
      kind: "SUBMIT_STUDENT_TEXTBOOK_CONTEXT",
      key: idempotencyKey,
      scope: `${actor.id}:${studentUserId}:${subjectCode}`,
      actorUserId: actor.id,
      familyId: boundary.familyId,
      request: input,
      resultSchema: StudentTextbookContextResponseSchema,
      execute: async (transaction) => {
        await transaction.studentTextbookContext.upsert({
          where: { studentUserId_subjectCode: { studentUserId, subjectCode } },
          create: {
            studentUserId,
            subjectCode,
            reportedPublisher: input.reportedPublisher,
            reportedEdition: input.reportedEdition,
            reportedVolume: input.reportedVolume,
            reportedDirectory: input.reportedDirectory,
            submittedByUserId: actor.id,
          },
          update: {
            reportedPublisher: input.reportedPublisher,
            reportedEdition: input.reportedEdition,
            reportedVolume: input.reportedVolume,
            reportedDirectory: input.reportedDirectory,
            submittedByUserId: actor.id,
            status: "UNCONFIRMED",
            textbookEditionId: null,
            currentUnitId: null,
            verifiedByUserId: null,
            verifiedAt: null,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: boundary.familyId,
            action: "STUDENT_TEXTBOOK_INFO_SUBMITTED",
            resourceType: "StudentTextbookContext",
            resourceId: `${studentUserId}:${subjectCode}`,
          },
        });
        return this.genericContext(studentUserId, subjectCode, boundary.grade, true);
      },
    });
  }

  async confirmContext(
    actor: CurrentUser,
    studentUserId: string,
    subjectCode: SubjectCode,
    input: ConfirmStudentTextbookContextInput,
    idempotencyKey: string,
  ): Promise<StudentTextbookContextResponse> {
    requireAdmin(actor);
    const boundary = await this.studentBoundary(actor, studentUserId, subjectCode, "ADMIN");
    return this.idempotency.run({
      kind: "CONFIRM_STUDENT_TEXTBOOK_CONTEXT",
      key: idempotencyKey,
      scope: `${actor.id}:${studentUserId}:${subjectCode}`,
      actorUserId: actor.id,
      familyId: boundary.familyId,
      request: input,
      resultSchema: StudentTextbookContextResponseSchema,
      execute: async (transaction) => {
        const [context, textbook] = await Promise.all([
          transaction.studentTextbookContext.findUnique({
            where: { studentUserId_subjectCode: { studentUserId, subjectCode } },
          }),
          transaction.textbookEdition.findFirst({
            where: {
              id: input.textbookEditionId,
              grade: boundary.grade,
              subjectCode,
              status: "CONFIRMED",
            },
          }),
        ]);
        if (context === null || textbook === null) {
          return notFound();
        }
        await transaction.studentTextbookContext.update({
          where: { id: context.id },
          data: {
            status: "CONFIRMED",
            textbookEditionId: textbook.id,
            currentUnitId: null,
            verifiedByUserId: actor.id,
            verifiedAt: new Date(),
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: boundary.familyId,
            action: "STUDENT_TEXTBOOK_CONFIRMED",
            resourceType: "StudentTextbookContext",
            resourceId: context.id,
            metadata: { textbookEditionId: textbook.id },
          },
        });
        return this.alignedContext(studentUserId, subjectCode, boundary.grade, textbook, null);
      },
    });
  }

  async getContext(
    actor: CurrentUser,
    studentUserId: string,
    subjectCode: SubjectCode,
  ): Promise<StudentTextbookContextResponse> {
    const boundary = await this.studentBoundary(actor, studentUserId, subjectCode, "READ");
    const context = await this.prisma.studentTextbookContext.findUnique({
      where: { studentUserId_subjectCode: { studentUserId, subjectCode } },
      include: { textbookEdition: true, currentUnit: true },
    });
    if (
      context?.status !== "CONFIRMED"
      || context.verifiedAt === null
      || context.textbookEdition?.status !== "CONFIRMED"
    ) {
      return this.genericContext(studentUserId, subjectCode, boundary.grade, context !== null);
    }
    return this.alignedContext(
      studentUserId,
      subjectCode,
      boundary.grade,
      context.textbookEdition,
      context.currentUnit,
    );
  }

  async updateCurrentUnit(
    actor: CurrentUser,
    studentUserId: string,
    subjectCode: SubjectCode,
    input: UpdateCurrentUnitInput,
    idempotencyKey: string,
  ): Promise<StudentTextbookContextResponse> {
    if (actor.id !== studentUserId || !actor.roles.includes("STUDENT")) {
      return notFound();
    }
    const boundary = await this.studentBoundary(actor, studentUserId, subjectCode, "STUDENT");
    return this.idempotency.run({
      kind: "UPDATE_STUDENT_CURRENT_UNIT",
      key: idempotencyKey,
      scope: `${actor.id}:${subjectCode}`,
      actorUserId: actor.id,
      familyId: boundary.familyId,
      request: input,
      resultSchema: StudentTextbookContextResponseSchema,
      execute: async (transaction) => {
        const context = await transaction.studentTextbookContext.findFirst({
          where: { studentUserId, subjectCode, status: "CONFIRMED" },
          include: { textbookEdition: true },
        });
        if (context?.textbookEdition?.status !== "CONFIRMED") {
          return notFound();
        }
        const unit = await transaction.unit.findFirst({
          where: {
            id: input.unitId,
            textbookEditionId: context.textbookEdition.id,
            status: "CONFIRMED",
          },
        });
        if (unit === null) {
          return notFound();
        }
        await transaction.studentTextbookContext.update({
          where: { id: context.id },
          data: { currentUnitId: unit.id },
        });
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.id,
            familyId: boundary.familyId,
            action: "STUDENT_CURRENT_UNIT_UPDATED",
            resourceType: "StudentTextbookContext",
            resourceId: context.id,
            metadata: { unitId: unit.id },
          },
        });
        return this.alignedContext(
          studentUserId,
          subjectCode,
          boundary.grade,
          context.textbookEdition,
          unit,
        );
      },
    });
  }

  private async studentBoundary(
    actor: CurrentUser,
    studentUserId: string,
    subjectCode: SubjectCode,
    purpose: "GUARDIAN" | "ADMIN" | "STUDENT" | "READ",
  ): Promise<{ familyId: string; grade: Grade }> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: studentUserId, status: "ACTIVE", user: { status: "ACTIVE" } },
      select: { familyId: true, grade: true },
    });
    if (profile === null || !isSubjectAvailableForGrade(profile.grade as Grade, subjectCode)) {
      return notFound();
    }
    const grade = profile.grade as Grade;
    if (purpose === "ADMIN" || (purpose === "READ" && actor.roles.includes("ADMIN"))) {
      requireAdmin(actor);
      return { familyId: profile.familyId, grade };
    }
    if (actor.id === studentUserId && actor.roles.includes("STUDENT")) {
      if (purpose === "GUARDIAN") {
        return notFound();
      }
      return { familyId: profile.familyId, grade };
    }
    if (!actor.roles.includes("GUARDIAN")) {
      return notFound();
    }
    const membership = await this.prisma.familyMembership.findFirst({
      where: {
        familyId: profile.familyId,
        userId: actor.id,
        role: "GUARDIAN",
        revokedAt: null,
        family: { status: "ACTIVE" },
      },
      select: { accessLevel: true },
    });
    if (membership?.accessLevel === "OWNER") {
      return { familyId: profile.familyId, grade };
    }
    const relationCount = await this.prisma.guardianStudentRelation.count({
      where: {
        familyId: profile.familyId,
        guardianUserId: actor.id,
        studentUserId,
        revokedAt: null,
      },
    });
    if (membership?.accessLevel !== "MEMBER" || relationCount !== 1) {
      return notFound();
    }
    return { familyId: profile.familyId, grade };
  }

  private genericContext(
    studentUserId: string,
    subjectCode: SubjectCode,
    grade: Grade,
    hasPendingSubmission: boolean,
  ): StudentTextbookContextResponse {
    return StudentTextbookContextResponseSchema.parse({
      mode: "GENERIC_GUIDANCE",
      studentUserId,
      subjectCode,
      grade,
      hasPendingSubmission,
    });
  }

  private alignedContext(
    studentUserId: string,
    subjectCode: SubjectCode,
    grade: Grade,
    textbook: {
      id: string;
      subjectCode: SubjectCode;
      grade: number;
      publisher: string;
      editionName: string;
      volume: string;
      status: "DRAFT" | "CONFIRMED" | "RETIRED";
    },
    unit: { id: string; ordinal: number; title: string } | null,
  ): StudentTextbookContextResponse {
    return StudentTextbookContextResponseSchema.parse({
      mode: "TEXTBOOK_ALIGNED",
      studentUserId,
      subjectCode,
      grade,
      textbook: {
        id: textbook.id,
        subjectCode: textbook.subjectCode,
        grade: textbook.grade,
        publisher: textbook.publisher,
        editionName: textbook.editionName,
        volume: textbook.volume,
        status: textbook.status,
      },
      currentUnit: unit === null ? null : {
        id: unit.id,
        ordinal: unit.ordinal,
        title: unit.title,
      },
    });
  }

  private textbookResult(textbook: {
    id: string;
    subjectCode: SubjectCode;
    grade: number;
    publisher: string;
    editionName: string;
    volume: string;
    status: "DRAFT" | "CONFIRMED" | "RETIRED";
  }): TextbookSummary {
    return TextbookSummarySchema.parse({
      id: textbook.id,
      subjectCode: textbook.subjectCode,
      grade: textbook.grade,
      publisher: textbook.publisher,
      editionName: textbook.editionName,
      volume: textbook.volume,
      status: textbook.status,
    });
  }
}
