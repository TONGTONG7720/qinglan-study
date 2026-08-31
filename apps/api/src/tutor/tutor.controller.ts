import { ContentLicenseStatusSchema, ContentTypeSchema, StartTutorInputSchema, SubjectCodeSchema, TutorAdvanceInputSchema } from "@study/contracts";
import type { CurrentUser, TutorSessionResponse } from "@study/contracts";
import { BadRequestException, Body, Controller, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "../auth/auth.service.js";
import { ReauthenticationProofService } from "../auth/reauthentication-proof.service.js";
import { readReauthenticationProof, readSessionCookie } from "../common/http/authenticated-request.js";
import { TutorService } from "./tutor.service.js";

const ReviewedInputSchema = z.object({
  subjectCode: SubjectCodeSchema,
  textbookEditionId: z.uuid(),
  unitId: z.uuid(),
  knowledgeNodeId: z.uuid(),
  textbookAssetId: z.uuid().nullable().default(null),
  excerpt: z.string().trim().min(1).max(2000),
  sourceReference: z.string().trim().min(8).max(500),
  pageStart: z.number().int().positive().max(2000),
  pageEnd: z.number().int().positive().max(2000),
  contentType: ContentTypeSchema,
  sourceHash: z.string().regex(/^[0-9a-f]{64}$/u),
  licenseStatus: ContentLicenseStatusSchema,
  contentVersion: z.string().trim().min(1).max(40),
  embedding: z.tuple([z.number(), z.number(), z.number()]),
}).strict().refine((input) => input.pageStart <= input.pageEnd, { path: ["pageStart"] });
@Controller("v1")
export class TutorController {
  constructor(private readonly tutor: TutorService, private readonly auth: AuthService, private readonly proofs: ReauthenticationProofService) {}
  @Post("admin/reviewed-content")
  async content(@Req() request: Request, @Body() body: unknown) { return this.tutor.addReviewedContent(await this.writeActor(request), this.parse(ReviewedInputSchema, body)); }
  @Post("students/:studentId/tutor-sessions")
  async start(@Req() request: Request, @Param("studentId") studentId: string, @Body() body: unknown): Promise<TutorSessionResponse> { return this.tutor.start(await this.writeActor(request), this.uuid(studentId), this.parse(StartTutorInputSchema, body)); }
  @Post("tutor-sessions/:sessionId/advance")
  async advance(@Req() request: Request, @Param("sessionId") sessionId: string, @Body() body: unknown): Promise<TutorSessionResponse> { return this.tutor.advance(await this.writeActor(request), this.uuid(sessionId), this.parse(TutorAdvanceInputSchema, body)); }
  private async writeActor(request: Request): Promise<CurrentUser> { const raw = readSessionCookie(request); const actor = await this.auth.resolve(raw); if (!this.proofs.verify(readReauthenticationProof(request), actor.id, raw)) throw new UnauthorizedException(); return actor; }
  private uuid(value: string) { return this.parse(z.uuid(), value); }
  private parse<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success) throw new BadRequestException(); return parsed.data; }
}
