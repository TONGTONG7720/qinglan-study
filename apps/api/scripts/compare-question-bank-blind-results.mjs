import { existsSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import {
  blindSolverCoverage,
  canonical,
  readBlindSolverResults,
} from "./question-bank-blind-results.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");

const { inputPath, resultsPath, questions, results } = await readBlindSolverResults(
  process.argv[2],
  process.argv[3],
);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const ids = results.map((result) => result.questionBankItemId);
  const stored = await client.query(
    `SELECT "id", "stableKey", "subjectCode"::text AS "subjectCode", "status"::text AS "status", "answer"
     FROM "QuestionBankItem"
     WHERE "id" = ANY($1::uuid[])
     ORDER BY "stableKey"`,
    [ids],
  );
  if (stored.rowCount !== results.length) throw new Error("Stored question count does not match blind-solver results");
  const storedById = new Map(stored.rows.map((item) => [item.id, item]));
  const comparisons = results.map((result) => {
    const item = storedById.get(result.questionBankItemId);
    if (item === undefined || item.stableKey !== result.stableKey) {
      throw new Error(`Stored question identity mismatch for ${result.stableKey}`);
    }
    if (item.status !== "FACT_CHECKED") {
      throw new Error(`Question ${result.stableKey} is not at the FACT_CHECKED review boundary`);
    }
    return {
      stableKey: result.stableKey,
      subjectCode: item.subjectCode,
      correct: canonical(item.answer) === canonical(result.answer),
    };
  });
  const correct = comparisons.filter((comparison) => comparison.correct).length;
  const bySubject = {};
  for (const comparison of comparisons) {
    const current = bySubject[comparison.subjectCode] ?? { total: 0, correct: 0 };
    current.total += 1;
    if (comparison.correct) current.correct += 1;
    bySubject[comparison.subjectCode] = current;
  }
  process.stdout.write(JSON.stringify({
    compared: true,
    inputPath,
    resultsPath,
    ...blindSolverCoverage(questions, results),
    correct,
    incorrect: comparisons.length - correct,
    accuracy: comparisons.length === 0 ? 0 : correct / comparisons.length,
    bySubject,
    incorrectStableKeys: comparisons.filter((comparison) => !comparison.correct).map((comparison) => comparison.stableKey),
    referenceAnswersIncludedInOutput: false,
    databaseWritten: false,
    reviewStatusChanged: false,
    publicationStatusChanged: false,
  }));
} finally {
  await client.end();
}
