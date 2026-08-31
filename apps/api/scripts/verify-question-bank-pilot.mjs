import { existsSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { questionBankPilotSummary, readQuestionBankPilot } from "./question-bank-pilot-manifest.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");
const { manifestPath, manifest } = await readQuestionBankPilot(process.argv[2]);
const stableKeys = manifest.questions.map((question) => question.draft.stableKey);
if (stableKeys.some((key) => typeof key !== "string")) throw new Error("Pilot stable keys are invalid");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const items = await client.query(
    `SELECT item."id", item."stableKey", item."status", item."licenseStatus", item."publishedAt",
       COUNT(DISTINCT link."knowledgeNodeId")::int AS "knowledgeNodeCount",
       COUNT(DISTINCT review."id")::int AS "humanReviewCount"
     FROM "QuestionBankItem" item
     LEFT JOIN "QuestionBankItemKnowledgeNode" link ON link."questionBankItemId" = item."id"
     LEFT JOIN "QuestionBankReview" review ON review."questionBankItemId" = item."id"
     WHERE item."stableKey" = ANY($1::text[])
     GROUP BY item."id"
     ORDER BY item."stableKey"`,
    [stableKeys],
  );
  if (items.rowCount !== manifest.questions.length) throw new Error("Pilot question count does not match the manifest");
  for (const item of items.rows) {
    if (item.status !== "FACT_CHECKED" || item.licenseStatus !== "LICENSE_REVIEW_REQUIRED" || item.publishedAt !== null || item.knowledgeNodeCount < 1 || item.humanReviewCount !== 0) {
      throw new Error(`Pilot release gate failed for ${item.stableKey}`);
    }
  }
  const validations = await client.query(
    `SELECT item."stableKey", validation."kind", COUNT(*)::int AS count
     FROM "QuestionBankItem" item
     JOIN "QuestionBankValidation" validation ON validation."questionBankItemId" = item."id"
     WHERE item."stableKey" = ANY($1::text[]) AND validation."status" = 'PASSED'
     GROUP BY item."stableKey", validation."kind"`,
    [stableKeys],
  );
  const passed = new Map();
  for (const validation of validations.rows) {
    const kinds = passed.get(validation.stableKey) ?? new Set();
    kinds.add(validation.kind);
    passed.set(validation.stableKey, kinds);
  }
  for (const stableKey of stableKeys) {
    const kinds = passed.get(stableKey);
    if (kinds === undefined || !kinds.has("AUTO_SOLVE") || !kinds.has("DEDUPLICATION") || !kinds.has("SUBJECT_FACT_CHECK")) {
      throw new Error(`Pilot validation stages are incomplete for ${stableKey}`);
    }
  }
  process.stdout.write(JSON.stringify({
    verified: true,
    manifestPath,
    ...questionBankPilotSummary(manifest),
    status: "FACT_CHECKED",
    passedValidationKinds: ["AUTO_SOLVE", "DEDUPLICATION", "SUBJECT_FACT_CHECK"],
    humanReviews: 0,
    published: 0,
  }));
} finally {
  await client.end();
}
