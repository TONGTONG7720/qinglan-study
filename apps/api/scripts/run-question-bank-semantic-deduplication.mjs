import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { QuestionBankSemanticDeduplicationResultSchema } from "@study/contracts";
import pg from "pg";
import { z } from "zod";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);

const confirmation = process.env.QUESTION_BANK_SEMANTIC_CONFIRMATION;
const baseUrl = (process.env.QUESTION_BANK_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/u, "");
const embeddingBaseUrl = process.env.QUESTION_BANK_EMBEDDING_BASE_URL?.replace(/\/$/u, "");
const embeddingApiKey = process.env.QUESTION_BANK_EMBEDDING_API_KEY;
const embeddingModel = process.env.QUESTION_BANK_EMBEDDING_MODEL;
const loginId = process.env.QUESTION_BANK_ADMIN_LOGIN_ID;
const password = process.env.QUESTION_BANK_ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (confirmation !== "RUN_REAL_QUESTION_BANK_SEMANTIC_DEDUPLICATION") {
  throw new Error("QUESTION_BANK_SEMANTIC_CONFIRMATION=RUN_REAL_QUESTION_BANK_SEMANTIC_DEDUPLICATION is required");
}
if (
  embeddingBaseUrl === undefined
  || embeddingApiKey === undefined
  || embeddingApiKey.length < 12
  || embeddingModel === undefined
  || loginId === undefined
  || password === undefined
  || password.length < 12
  || databaseUrl === undefined
) {
  throw new Error("Real embedding provider, database, and question-bank admin environment variables are required");
}
validateHttpsOrLoopback(baseUrl, "QUESTION_BANK_API_BASE_URL");
validateHttpsOrLoopback(embeddingBaseUrl, "QUESTION_BANK_EMBEDDING_BASE_URL");

const EmbeddingResponseSchema = z.object({
  data: z.array(z.object({
    index: z.number().int().nonnegative(),
    embedding: z.array(z.number().finite()).min(8).max(4_096),
  })).min(1),
}).passthrough();

const database = new pg.Client({ connectionString: databaseUrl });
await database.connect();
let questions;
try {
  const result = await database.query(
    `SELECT
       "id",
       "stableKey",
       "subjectCode"::text AS "subjectCode",
       "grade",
       "type"::text AS "type",
       "stem",
       "options"
     FROM "QuestionBankItem"
     WHERE "status" IN ('DEDUPLICATED', 'FACT_CHECKED')
     ORDER BY "subjectCode", "stableKey"`,
  );
  questions = result.rows;
} finally {
  await database.end();
}
if (questions.length === 0) throw new Error("No DEDUPLICATED or FACT_CHECKED question-bank items are available");

const embeddings = new Map();
for (const question of questions) {
  const source = canonical({
    subjectCode: question.subjectCode,
    grade: question.grade,
    type: question.type,
    stem: question.stem,
    options: question.options,
  });
  embeddings.set(question.id, await createEmbedding(source));
}

const { cookie, proof } = await authenticate();
const candidateMap = new Map();
const finalResults = [];
try {
  for (const phase of ["coverage", "finalize"]) {
    for (const question of questions) {
      const embedding = embeddings.get(question.id);
      if (embedding === undefined) throw new Error(`Missing generated embedding for ${question.stableKey}`);
      const result = await submitSemanticEmbedding(question, embedding, phase);
      if (phase === "finalize") finalResults.push(result);
      for (const candidate of result.candidates) {
        candidateMap.set(candidate.id, {
          questionStableKey: question.stableKey,
          ...candidate,
        });
      }
    }
  }
} finally {
  await fetch(`${baseUrl}/v1/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie, "X-Qinglang-CSRF": "1" },
  }).catch(() => undefined);
}

const incomplete = finalResults.filter((result) => !result.coverageComplete);
process.stdout.write(JSON.stringify({
  semanticDeduplicationRun: true,
  embeddingModel,
  questionCount: questions.length,
  embeddingDimensions: new Set([...embeddings.values()].map((embedding) => embedding.length)).size === 1
    ? embeddings.values().next().value?.length ?? null
    : "MIXED_INVALID",
  coverageComplete: incomplete.length === 0,
  incompleteStableKeys: incomplete.map((result) => result.item.stableKey),
  semanticCandidateCount: candidateMap.size,
  candidates: [...candidateMap.values()],
  humanSemanticReviewRequired: candidateMap.size > 0,
  automaticDuplicateDecisionMade: false,
  answersSentToEmbeddingProvider: false,
  publicationStatusChanged: false,
}));

async function createEmbedding(input) {
  const response = await fetch(new URL("embeddings", `${embeddingBaseUrl}/`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${embeddingApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: embeddingModel, input, encoding_format: "float" }),
  });
  if (!response.ok) throw new Error(`Embedding provider failed with HTTP ${String(response.status)}`);
  const parsed = EmbeddingResponseSchema.parse(await response.json());
  if (parsed.data.length !== 1 || parsed.data[0]?.index !== 0) throw new Error("Embedding provider returned an unexpected response shape");
  return parsed.data[0].embedding;
}

async function authenticate() {
  const loginResponse = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Qinglang-CSRF": "1" },
    body: JSON.stringify({ loginId, password }),
  });
  if (!loginResponse.ok) throw new Error(`Question-bank admin login failed with HTTP ${String(loginResponse.status)}`);
  const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) throw new Error("Question-bank admin login did not return a session cookie");
  const proofResponse = await fetch(`${baseUrl}/v1/auth/reauthenticate`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json", "X-Qinglang-CSRF": "1" },
    body: JSON.stringify({ password }),
  });
  if (!proofResponse.ok) throw new Error(`Question-bank reauthentication failed with HTTP ${String(proofResponse.status)}`);
  const proofBody = await proofResponse.json();
  if (typeof proofBody !== "object" || proofBody === null || !("proof" in proofBody) || typeof proofBody.proof !== "string") {
    throw new Error("Question-bank reauthentication proof is invalid");
  }
  return { cookie, proof: proofBody.proof };
}

async function submitSemanticEmbedding(question, embedding, phase) {
  const body = {
    embeddingModel,
    embedding,
    attestation: "REAL_SEMANTIC_EMBEDDING_NOT_HASH_HEURISTIC",
    confirmation: "SEMANTIC_DEDUPLICATE_QUESTION_BANK_ITEM",
  };
  const operationHash = sha256(canonical({ questionBankItemId: question.id, phase, body }));
  const response = await fetch(`${baseUrl}/v1/admin/question-bank/items/${question.id}/semantic-deduplicate`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
      "idempotency-key": `question-bank-semantic:${operationHash.slice(0, 40)}`,
      "x-reauth-proof": proof,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Semantic deduplication failed for ${question.stableKey} with HTTP ${String(response.status)}`);
  return QuestionBankSemanticDeduplicationResultSchema.parse(await response.json());
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validateHttpsOrLoopback(value, variableName) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && new Set(["127.0.0.1", "localhost"]).has(parsed.hostname))) {
    throw new Error(`${variableName} must use HTTPS unless it targets loopback`);
  }
}
