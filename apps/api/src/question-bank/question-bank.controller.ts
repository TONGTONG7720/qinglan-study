import {
  CreateQuestionBankDraftInputSchema,
  DeduplicateQuestionBankInputSchema,
  FactCheckQuestionBankInputSchema,
  HumanSubjectReviewQuestionBankInputSchema,
  PublishQuestionBankInputSchema,
  RecordIndependentQuestionBankSolveInputSchema,
  RegisterTextbookAssetInputSchema,
  ReviewQuestionBankLicenseInputSchema,
  ReviewQuestionBankInputSchema,
  ReviewSemanticDuplicateInputSchema,
  RollbackQuestionBankReleaseInputSchema,
  SemanticDeduplicateQuestionBankInputSchema,
  ValidateQuestionBankSolverInputSchema,
} from "@study/contracts";
import type {
  CurrentUser,
  QuestionBankItemSummary,
  QuestionBankSemanticDeduplicationResult,
  TextbookAssetSummary,
} from "@study/contracts";
import { BadRequestException, Body, Controller, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";

import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import { readIdempotencyKey, readReauthenticationProof, readSessionCookie } from "../common/http/authenticated-request.js";
import { QuestionBankService } from "./question-bank.service.js";

const UuidSchema = z.uuid();

@Controller("v1/admin")
export class QuestionBankController {
  constructor(
    private readonly service: QuestionBankService,
    private readonly auth: AuthService,
    private readonly proofs: ReauthenticationProofService,
  ) {}

  @Post("question-bank/items")
  async create(@Req() request: Request, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.createDraft(await this.actor(request), this.parse(CreateQuestionBankDraftInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/solve")
  async solve(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.validateSolver(await this.actor(request), this.uuid(id), this.parse(ValidateQuestionBankSolverInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/independent-solve")
  async recordIndependentSolve(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.recordIndependentSolve(await this.actor(request), this.uuid(id), this.parse(RecordIndependentQuestionBankSolveInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/deduplicate")
  async deduplicate(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.deduplicate(await this.actor(request), this.uuid(id), this.parse(DeduplicateQuestionBankInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/semantic-deduplicate")
  async semanticDeduplicate(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankSemanticDeduplicationResult> {
    return this.service.semanticDeduplicate(await this.actor(request), this.uuid(id), this.parse(SemanticDeduplicateQuestionBankInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/semantic-duplicates/:matchId/review")
  async reviewSemanticDuplicate(
    @Req() request: Request,
    @Param("id") id: string,
    @Param("matchId") matchId: string,
    @Body() body: unknown,
  ): Promise<QuestionBankItemSummary> {
    return this.service.reviewSemanticDuplicate(await this.actor(request), this.uuid(id), this.uuid(matchId), this.parse(ReviewSemanticDuplicateInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/fact-check")
  async factCheck(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.factCheck(await this.actor(request), this.uuid(id), this.parse(FactCheckQuestionBankInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/human-subject-review")
  async recordHumanSubjectReview(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.recordHumanSubjectReview(await this.actor(request), this.uuid(id), this.parse(HumanSubjectReviewQuestionBankInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/license-review")
  async reviewLicense(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.reviewLicense(await this.actor(request), this.uuid(id), this.parse(ReviewQuestionBankLicenseInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/review")
  async review(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.review(await this.actor(request), this.uuid(id), this.parse(ReviewQuestionBankInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/publish")
  async publish(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.publish(await this.actor(request), this.uuid(id), this.parse(PublishQuestionBankInputSchema, body), readIdempotencyKey(request));
  }

  @Post("question-bank/items/:id/rollback")
  async rollback(@Req() request: Request, @Param("id") id: string, @Body() body: unknown): Promise<QuestionBankItemSummary> {
    return this.service.rollbackRelease(await this.actor(request), this.uuid(id), this.parse(RollbackQuestionBankReleaseInputSchema, body), readIdempotencyKey(request));
  }

  @Post("textbook-assets")
  async registerAsset(@Req() request: Request, @Body() body: unknown): Promise<TextbookAssetSummary> {
    return this.service.registerAsset(await this.actor(request), this.parse(RegisterTextbookAssetInputSchema, body), readIdempotencyKey(request));
  }

  private async actor(request: Request): Promise<CurrentUser> {
    const token = readSessionCookie(request);
    const actor = await this.auth.resolve(token);
    if (!this.proofs.verify(readReauthenticationProof(request), actor.id, token)) throw new UnauthorizedException();
    return actor;
  }

  private uuid(value: string): string {
    return this.parse(UuidSchema, value);
  }

  private parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new BadRequestException();
    return parsed.data;
  }
}
