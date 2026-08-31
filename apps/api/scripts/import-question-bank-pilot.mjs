import { createHash } from "node:crypto";

import {
  CreateQuestionBankDraftInputSchema,
  QuestionBankItemSummarySchema,
} from "@study/contracts";
import pg from "pg";

import { questionBankPilotSummary, readQuestionBankPilot } from "./question-bank-pilot-manifest.mjs";

const { manifestPath, manifest } = await readQuestionBankPilot(process.argv[2]);
const baseUrl = (process.env.QUESTION_BANK_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/u, "");
const loginId = process.env.QUESTION_BANK_ADMIN_LOGIN_ID;
const password = process.env.QUESTION_BANK_ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;
if (loginId === undefined || password === undefined || password.length < 12 || databaseUrl === undefined) {
  throw new Error("QUESTION_BANK_ADMIN_LOGIN_ID, a 12+ character QUESTION_BANK_ADMIN_PASSWORD, and DATABASE_URL are required");
}
const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" && !(parsedBaseUrl.protocol === "http:" && new Set(["127.0.0.1", "localhost"]).has(parsedBaseUrl.hostname))) {
  throw new Error("QUESTION_BANK_API_BASE_URL must use HTTPS unless it targets loopback");
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
let unitId;
const knowledgeNodeIds = new Map();
try {
  const unitResult = await client.query(
    `SELECT unit."id", unit."title"
     FROM "Unit" unit
     JOIN "TextbookEdition" textbook ON textbook."id" = unit."textbookEditionId"
     WHERE textbook."id" = $1 AND unit."title" = $2 AND textbook."status" = 'DRAFT'`,
    [manifest.textbookEditionId, manifest.unitTitle],
  );
  if (unitResult.rowCount !== 1) throw new Error("Pilot DRAFT unit was not found");
  unitId = unitResult.rows[0].id;
  const nodeResult = await client.query(
    `SELECT node."id", node."title"
     FROM "KnowledgeNode" node
     WHERE node."unitId" = $1 AND node."status" = 'DRAFT'`,
    [unitId],
  );
  for (const node of nodeResult.rows) knowledgeNodeIds.set(node.title, node.id);
} finally {
  await client.end();
}

const loginResponse = await fetch(`${baseUrl}/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ loginId, password }),
});
if (!loginResponse.ok) throw new Error(`Question-bank admin login failed with HTTP ${String(loginResponse.status)}`);
const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
if (cookie === undefined) throw new Error("Question-bank admin login did not return a session cookie");
const proofResponse = await fetch(`${baseUrl}/v1/auth/reauthenticate`, {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
if (!proofResponse.ok) throw new Error(`Question-bank reauthentication failed with HTTP ${String(proofResponse.status)}`);
const proofBody = await proofResponse.json();
if (typeof proofBody !== "object" || proofBody === null || !("proof" in proofBody) || typeof proofBody.proof !== "string") {
  throw new Error("Question-bank reauthentication proof is invalid");
}

const imported = [];
try {
  for (const question of manifest.questions) {
    const resolvedNodeIds = question.knowledgeNodeTitles.map((title) => {
      const id = knowledgeNodeIds.get(title);
      if (id === undefined) throw new Error(`Pilot knowledge node was not found: ${title}`);
      return id;
    });
    const draft = CreateQuestionBankDraftInputSchema.parse({
      ...question.draft,
      textbookEditionId: manifest.textbookEditionId,
      unitId,
      knowledgeNodeIds: resolvedNodeIds,
    });
    const created = await post("/v1/admin/question-bank/items", draft, `${draft.stableKey}:create`, "DRAFT");
    await post(`/v1/admin/question-bank/items/${created.id}/solve`, {
      solverAnswer: draft.answer,
      solverExplanation: question.solverExplanation,
      solverName: "pilot-deterministic-answer-key-v1",
      confirmation: "VALIDATE_QUESTION_BANK_SOLVER",
    }, `${draft.stableKey}:solve`, "SOLVER_VALIDATED");
    await post(`/v1/admin/question-bank/items/${created.id}/deduplicate`, {
      confirmation: "DEDUPLICATE_QUESTION_BANK_ITEM",
    }, `${draft.stableKey}:deduplicate`, "DEDUPLICATED");
    const checked = await post(`/v1/admin/question-bank/items/${created.id}/fact-check`, {
      passed: true,
      notes: question.factCheckNotes,
      confirmation: "FACT_CHECK_QUESTION_BANK_ITEM",
    }, `${draft.stableKey}:fact-check`, "FACT_CHECKED");
    imported.push(checked);
  }
} finally {
  await fetch(`${baseUrl}/v1/auth/logout`, { method: "POST", headers: { Cookie: cookie } }).catch(() => undefined);
}

process.stdout.write(JSON.stringify({
  imported: true,
  manifestPath,
  ...questionBankPilotSummary(manifest),
  status: "FACT_CHECKED",
  humanReviewRequired: true,
  questionBankItemIds: imported.map((item) => item.id),
}));

async function post(path, body, operationKey, expectedStatus) {
  const key = createHash("sha256").update(operationKey, "utf8").digest("hex");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      "idempotency-key": `question-bank-pilot:${key.slice(0, 40)}`,
      "x-reauth-proof": proofBody.proof,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Question-bank Pilot request ${path} failed with HTTP ${String(response.status)}`);
  const item = QuestionBankItemSummarySchema.parse(await response.json());
  if (item.status !== expectedStatus) throw new Error(`Question-bank Pilot ${item.stableKey} expected ${expectedStatus} but received ${item.status}`);
  return item;
}
