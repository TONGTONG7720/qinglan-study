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
      ): ModelProvider => {
        if (process.env.NODE_ENV === "test") {
          return fakeProvider;
        }
        const configured = process.env.MODEL_PROVIDER ?? "fake";
        if (configured === "fake") {
          return fakeProvider;
        }
        if (configured === "disabled") {
          return disabledProvider;
        }
        if (configured === "openai-compatible") {
          return openAiCompatibleProvider;
        }
        throw new Error("MODEL_PROVIDER must be disabled, fake, or openai-compatible");
      },
    },
    ModelGatewayService,
    OcrService,
  ],
  exports: [ModelGatewayService],
})
export class AiModule {}
