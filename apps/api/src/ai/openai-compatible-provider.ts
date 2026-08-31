import type { ModelGatewayRequest, ModelGatewayResult } from "@study/contracts";
import { ModelGatewayResultSchema } from "@study/contracts";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { ModelProvider } from "./model-gateway.service.js";

const ReasoningEffortSchema = z.enum(["none", "low", "medium", "high", "xhigh", "max"]);
const ProviderConfigSchema = z.object({
  baseUrl: z.url(),
  apiKey: z.string().min(20),
  model: z.string().trim().min(1).max(120),
  reasoningEffort: ReasoningEffortSchema,
  timeoutMs: z.number().int().min(1_000).max(120_000),
  costFenPerCall: z.number().int().positive().max(1_000_000),
}).strict();

const ResponseContentSchema = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
});
const ResponsesApiSchema = z.looseObject({
  id: z.string().min(1),
  model: z.string().min(1),
  status: z.string().min(1),
  output: z.array(z.looseObject({
    content: z.array(ResponseContentSchema).optional(),
  })),
});

const TextOutputSchema = z.object({
  text: z.string().trim().min(1).max(5_000),
}).strict();
const OcrOutputSchema = TextOutputSchema.extend({
  confidence: z.number().min(0).max(1),
}).strict();

type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

@Injectable()
export class OpenAiCompatibleProvider implements ModelProvider {
  get name(): string {
    return `openai-compatible:${this.config().model}`;
  }

  reservationCostFen(): number {
    return this.config().costFenPerCall;
  }

  async call(request: ModelGatewayRequest): Promise<ModelGatewayResult> {
    const config = this.config();
    if (
      request.purpose === "OCR"
      && typeof request.input.imageUrl !== "string"
      && typeof request.input.imageBase64 !== "string"
    ) {
      throw new Error("OCR_INPUT_ASSET_UNAVAILABLE");
    }

    const response = await fetch(`${config.baseUrl.replace(/\/$/u, "")}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.requestBody(config, request)),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`MODEL_PROVIDER_HTTP_${String(response.status)}`);
    }

    const decoded: unknown = await response.json();
    const providerResponse = ResponsesApiSchema.parse(decoded);
    if (providerResponse.status !== "completed") {
      throw new Error("MODEL_PROVIDER_INCOMPLETE");
    }
    const outputText = providerResponse.output
      .flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")
      ?.text;
    if (outputText === undefined) {
      throw new Error("MODEL_PROVIDER_OUTPUT_MISSING");
    }

    const output = request.purpose === "OCR"
      ? OcrOutputSchema.parse(JSON.parse(outputText) as unknown)
      : TextOutputSchema.parse(JSON.parse(outputText) as unknown);
    return ModelGatewayResultSchema.parse({
      providerCallId: providerResponse.id,
      output,
      costFen: config.costFenPerCall,
    });
  }

  private config(): ProviderConfig {
    const baseUrl = process.env.MODEL_BASE_URL?.trim();
    if (baseUrl === undefined) {
      throw new Error("MODEL_BASE_URL is required for openai-compatible provider");
    }
    const parsedUrl = new URL(baseUrl);
    const productionSmokeTest = process.env.PRODUCTION_SMOKE_TEST === "true";
    if (
      parsedUrl.protocol !== "https:"
      && !(
        parsedUrl.protocol === "http:"
        && process.env.NODE_ENV !== "production"
        && new Set(["127.0.0.1", "localhost"]).has(parsedUrl.hostname)
      )
      && !(
        parsedUrl.protocol === "http:"
        && productionSmokeTest
        && new Set(["127.0.0.1", "localhost"]).has(parsedUrl.hostname)
      )
    ) {
      throw new Error("MODEL_BASE_URL must use HTTPS unless it targets loopback");
    }
    return ProviderConfigSchema.parse({
      baseUrl,
      apiKey: process.env.MODEL_API_KEY,
      model: process.env.MODEL_NAME,
      reasoningEffort: process.env.MODEL_REASONING_EFFORT,
      timeoutMs: Number(process.env.MODEL_TIMEOUT_MS),
      costFenPerCall: Number(process.env.MODEL_COST_FEN_PER_CALL),
    });
  }

  private requestBody(config: ProviderConfig, request: ModelGatewayRequest): object {
    const ocr = request.purpose === "OCR";
    const schema = ocr
      ? {
          type: "object",
          properties: {
            text: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["text", "confidence"],
          additionalProperties: false,
        }
      : {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
          additionalProperties: false,
        };
    const developerInstruction = ocr
      ? "Extract only the visible question text. Do not infer missing content. Return confidence from 0 to 1."
      : "Return concise Chinese learning guidance using only the reviewed evidence in the input. Respect the requested tutor stage; hints must not reveal the final answer early. Do not claim unsupported facts.";
    return {
      model: config.model,
      reasoning: { effort: config.reasoningEffort },
      input: [
        { role: "developer", content: developerInstruction },
        { role: "user", content: JSON.stringify({ purpose: request.purpose, input: request.input }) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: ocr ? "learning_ocr_output" : "learning_text_output",
          strict: true,
          schema,
        },
      },
      max_output_tokens: 512,
      store: false,
    };
  }
}
