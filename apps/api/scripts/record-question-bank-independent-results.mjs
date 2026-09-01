import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { QuestionBankItemSummarySchema } from "@study/contracts";

import { blindSolverCoverage, readBlindSolverResults } from "./question-bank-blind-results.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const confirmation = process.env.QUESTION_BANK_EVIDENCE_IMPORT_CONFIRMATION;
const baseUrl = (process.env.QUESTION_BANK_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/u, "");
const loginId = process.env.QUESTION_BANK_ADMIN_LOGIN_ID;
const password = process.env.QUESTION_BANK_ADMIN_PASSWORD;

if (confirmation !== "IMPORT_GIT_EXTERNAL_INDEPENDENT_RESULTS") {
  throw new Error("QUESTION_BANK_EVIDENCE_IMPORT_CONFIRMATION=IMPORT_GIT_EXTERNAL_INDEPENDENT_RESULTS is required");
}
if (loginId === undefined || password === undefined || password.length < 12) {
  throw new Error("QUESTION_BANK_ADMIN_LOGIN_ID and a 12+ character QUESTION_BANK_ADMIN_PASSWORD are required");
}
const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" && !(parsedBaseUrl.protocol === "http:" && new Set(["127.0.0.1", "localhost"]).has(parsedBaseUrl.hostname))) {
  throw new Error("QUESTION_BANK_API_BASE_URL must use HTTPS unless it targets loopback");
}

const { resultsPath, questions, results } = await readBlindSolverResults(process.argv[2], process.argv[3]);
const [realRepositoryRoot, realResultsPath] = await Promise.all([realpath(repositoryRoot), realpath(resultsPath)]);
const resultsRelativeToRepository = relative(realRepositoryRoot, realResultsPath);
const resultsInsideRepository = resultsRelativeToRepository === ""
  || (resultsRelativeToRepository !== ".." && !resultsRelativeToRepository.startsWith(`..${sep}`) && !isAbsolute(resultsRelativeToRepository));
if (resultsInsideRepository) {
  throw new Error("Independent solver results must remain outside the Git repository");
}

const { cookie, proof } = await authenticate();
const recorded = [];
try {
  for (const result of results) {
    const response = await post(
      `/v1/admin/question-bank/items/${result.questionBankItemId}/independent-solve`,
      { ...result, confirmation: "RECORD_INDEPENDENT_QUESTION_BANK_SOLVE" },
      `independent-result:${result.questionBankItemId}:${sha256(JSON.stringify(result))}`,
    );
    recorded.push(response);
  }
} finally {
  await fetch(`${baseUrl}/v1/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie, "X-Qinglang-CSRF": "1" },
  }).catch(() => undefined);
}

process.stdout.write(JSON.stringify({
  recorded: true,
  ...blindSolverCoverage(questions, results),
  recordedCount: recorded.length,
  recordedStableKeys: recorded.map((item) => item.stableKey),
  referenceAnswersIncludedInOutput: false,
  solverAnswersStoredInValidationDetails: false,
  publicationStatusChanged: false,
}));

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

async function post(path, body, operationSeed) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
      "idempotency-key": `question-bank-evidence:${sha256(operationSeed).slice(0, 40)}`,
      "x-reauth-proof": proof,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Question-bank evidence request ${path} failed with HTTP ${String(response.status)}`);
  return QuestionBankItemSummarySchema.parse(await response.json());
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
