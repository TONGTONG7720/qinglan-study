import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenAiCompatibleProvider } from "./openai-compatible-provider.js";

const environmentKeys = [
  "MODEL_BASE_URL",
  "MODEL_API_KEY",
  "MODEL_NAME",
  "MODEL_REASONING_EFFORT",
  "MODEL_TIMEOUT_MS",
  "MODEL_COST_FEN_PER_CALL",
] as const;

describe("OpenAiCompatibleProvider", () => {
  const originalEnvironment = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of environmentKeys) {
      originalEnvironment.set(key, process.env[key]);
    }
    process.env.MODEL_BASE_URL = "https://provider.example.test";
    process.env.MODEL_API_KEY = "fictional-provider-key-for-tests-only";
    process.env.MODEL_NAME = "gpt-5.6-terra";
    process.env.MODEL_REASONING_EFFORT = "max";
    process.env.MODEL_TIMEOUT_MS = "30000";
    process.env.MODEL_COST_FEN_PER_CALL = "10";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of environmentKeys) {
      const value = originalEnvironment.get(key);
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  });

  it("uses Responses structured output without storing provider state", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      id: "resp_test_123",
      model: "gpt-5.6-terra",
      status: "completed",
      output: [{ content: [{ type: "output_text", text: "{\"text\":\"继续完成当前步骤。\"}" }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenAiCompatibleProvider().call({
      purpose: "TUTOR_FAST",
      dedupeKey: "provider-test-dedupe-0001",
      input: { stage: "HINT_ONE", evidenceIds: ["evidence-id"] },
    });

    expect(result).toEqual({
      providerCallId: "resp_test_123",
      output: { text: "继续完成当前步骤。" },
      costFen: 10,
    });
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    if (typeof request?.body !== "string") {
      throw new Error("Expected a JSON string request body");
    }
    const body = JSON.parse(request.body) as {
      model: string;
      reasoning: { effort: string };
      store: boolean;
      text: { format: { type: string; strict: boolean } };
    };
    expect(body.model).toBe("gpt-5.6-terra");
    expect(body.reasoning.effort).toBe("max");
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
  });

  it("fails closed when OCR has no image asset", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(new OpenAiCompatibleProvider().call({
      purpose: "OCR",
      dedupeKey: "provider-test-dedupe-0002",
      input: { sha256: "0".repeat(64) },
    })).rejects.toThrow("OCR_INPUT_ASSET_UNAVAILABLE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends verified OCR bytes as an input image without duplicating them in prompt text", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      id: "resp_ocr_123",
      model: "gpt-5.6-terra",
      status: "completed",
      output: [{ content: [{ type: "output_text", text: "{\"text\":\"题目\",\"confidence\":0.9}" }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);

    await new OpenAiCompatibleProvider().call({
      purpose: "OCR",
      dedupeKey: "provider-test-dedupe-0003",
      input: {
        sha256: "1".repeat(64),
        imageMimeType: "image/png",
        imageBase64: "AQIDBA==",
      },
    });
    const request = fetchMock.mock.calls[0]?.[1];
    if (typeof request?.body !== "string") throw new Error("Expected request JSON");
    const body = JSON.parse(request.body) as {
      input: { role: string; content: string | { type: string; text?: string; image_url?: string }[] }[];
    };
    const user = body.input.find((item) => item.role === "user");
    expect(Array.isArray(user?.content)).toBe(true);
    if (!Array.isArray(user?.content)) throw new Error("Expected multimodal content");
    expect(user.content[0]?.text).not.toContain("AQIDBA==");
    expect(user.content[1]).toMatchObject({
      type: "input_image",
      image_url: "data:image/png;base64,AQIDBA==",
    });
  });
});
