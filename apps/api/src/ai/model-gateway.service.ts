import type { ModelGatewayRequest, ModelGatewayResult } from "@study/contracts";
import { ModelGatewayResultSchema, TutorProviderOutputSchema } from "@study/contracts";
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { Prisma } from "../generated/prisma/client.js";
import { BudgetService } from "./budget.service.js";

export const MODEL_PROVIDER = Symbol("MODEL_PROVIDER");

export interface ModelProvider {
  readonly name: string;
  reservationCostFen(request: ModelGatewayRequest): number;
  call(request: ModelGatewayRequest): Promise<ModelGatewayResult>;
}

@Injectable()
export class DeterministicFakeProvider implements ModelProvider {
  readonly name = "deterministic-fake";

  reservationCostFen(): number {
    return 10;
  }

  call(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const sha = typeof request.input.sha256 === "string" ? request.input.sha256 : "";
    if (sha.startsWith("f")) return Promise.reject(new Error("FAKE_PROVIDER_FAILURE"));
    const confidence = sha.startsWith("a") ? 0.6 : 0.95;
    const output = request.purpose === "TUTOR_FAST" || request.purpose === "TUTOR_REASONING"
      ? { text: "请继续基于审核证据完成当前步骤。" }
      : { text: "虚构 OCR 识别文本", confidence };
    return Promise.resolve(ModelGatewayResultSchema.parse({
      providerCallId: createHash("sha256").update(request.dedupeKey).digest("hex").slice(0, 24),
      output, costFen: 10,
    }));
  }
}

@Injectable()
export class ModelGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgets: BudgetService,
    @Inject(MODEL_PROVIDER) private readonly provider: ModelProvider,
  ) {}

  async call(familyId: string, userId: string, request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const existing = await this.prisma.modelCall.findUnique({ where: { purpose_dedupeKey: { purpose: request.purpose, dedupeKey: request.dedupeKey } } });
    if (existing?.status === "SUCCEEDED" && existing.output !== null && existing.costFen !== null) {
      return ModelGatewayResultSchema.parse({ providerCallId: existing.id, output: existing.output, costFen: existing.costFen });
    }
    const providerName = this.provider.name;
    const reserved = await this.budgets.reserve(
      familyId,
      userId,
      request.purpose,
      this.provider.reservationCostFen(request),
      request.dedupeKey,
    );
    const call = existing ?? await this.prisma.modelCall.create({
      data: { userId, purpose: request.purpose, dedupeKey: request.dedupeKey, provider: providerName },
    });
    try {
      const result = await this.provider.call(request);
      if (request.purpose === "TUTOR_FAST" || request.purpose === "TUTOR_REASONING") {
        TutorProviderOutputSchema.parse(result.output);
      }
      await this.budgets.settle(reserved.reservation.id, providerName, result.costFen);
      await this.prisma.modelCall.update({ where: { id: call.id }, data: { status: "SUCCEEDED", output: result.output as Prisma.InputJsonValue, costFen: result.costFen } });
      return { ...result, providerCallId: call.id };
    } catch {
      await this.budgets.release(reserved.reservation.id);
      await this.prisma.modelCall.update({ where: { id: call.id }, data: { status: "FAILED", errorCode: "PROVIDER_FAILED" } });
      throw new ServiceUnavailableException();
    }
  }
}
