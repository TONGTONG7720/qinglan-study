import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrismaModule } from "../common/prisma/prisma.module.js";
import { AiController } from "./ai.controller.js";
import { BudgetService } from "./budget.service.js";
import {
  DeterministicFakeProvider,
  DisabledModelProvider,
  MODEL_PROVIDER,
  ModelGatewayService,
} from "./model-gateway.service.js";
import type { ModelProvider } from "./model-gateway.service.js";
import { OpenAiCompatibleProvider } from "./openai-compatible-provider.js";
import { OcrService } from "./ocr.service.js";

export function selectModelProvider(
  nodeEnvironment: string | undefined,
  configuredProvider: string | undefined,
  providers: {
    fake: ModelProvider;
    disabled: ModelProvider;
    openAiCompatible: ModelProvider;
  },
): ModelProvider {
  if (nodeEnvironment === "test") {
    if (configuredProvider !== undefined && configuredProvider !== "fake") {
      throw new Error("tests must use the deterministic fake model provider");
    }
    return providers.fake;
  }
  const configured = configuredProvider ?? "disabled";
  if (configured === "disabled") {
    return providers.disabled;
  }
  if (configured === "openai-compatible") {
    return providers.openAiCompatible;
  }
  if (configured === "fake") {
    throw new Error("MODEL_PROVIDER=fake is test-only");
  }
  throw new Error("MODEL_PROVIDER must be disabled or openai-compatible");
}

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiController],
  providers: [
    BudgetService,
    DeterministicFakeProvider,
    DisabledModelProvider,
    OpenAiCompatibleProvider,
    {
      provide: MODEL_PROVIDER,
      inject: [DeterministicFakeProvider, DisabledModelProvider, OpenAiCompatibleProvider],
      useFactory: (
        fakeProvider: DeterministicFakeProvider,
        disabledProvider: DisabledModelProvider,
        openAiCompatibleProvider: OpenAiCompatibleProvider,
      ): ModelProvider => selectModelProvider(
        process.env.NODE_ENV,
        process.env.MODEL_PROVIDER,
        {
          fake: fakeProvider,
          disabled: disabledProvider,
          openAiCompatible: openAiCompatibleProvider,
        },
      ),
    },
    ModelGatewayService,
    OcrService,
  ],
  exports: [ModelGatewayService],
})
export class AiModule {}
