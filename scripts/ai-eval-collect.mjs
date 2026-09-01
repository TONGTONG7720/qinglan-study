import { existsSync } from "node:fs";

import {
  appendPrivateJsonLine,
  acquirePrivateLock,
  assertCaseRows,
  assertExternalPath,
  assertModelRunRows,
  canonicalJson,
  currentReleaseCandidate,
  loadEvaluationProviderConfig,
  readJsonLines,
  sha256,
} from "./ai-eval-workflow-lib.mjs";

const usage = "Usage: node scripts/ai-eval-collect.mjs <external-cases.jsonl> <external-model-runs.jsonl> <evaluation-run-id> CONFIRM_REAL_PROVIDER_EVALUATION";
const [casePathArgument, outputPathArgument, evaluationRunId, confirmation] = process.argv.slice(2);

if (casePathArgument === "--help") {
  console.log(usage);
  process.exit(0);
}
if (casePathArgument === undefined || outputPathArgument === undefined || evaluationRunId === undefined) {
  throw new Error(usage);
}
if (!/^[a-z0-9][a-z0-9._-]{7,119}$/u.test(evaluationRunId)) throw new Error("evaluation-run-id is invalid");
if (confirmation !== "CONFIRM_REAL_PROVIDER_EVALUATION") {
  throw new Error("explicit real-provider evaluation confirmation is required");
}

const casePath = assertExternalPath(casePathArgument, "evaluation case manifest", { mustExist: true });
const outputPath = assertExternalPath(outputPathArgument, "model run output");
if (casePath === outputPath) throw new Error("case manifest and model run output must use different paths");
const releaseLock = acquirePrivateLock(outputPath, "model run output");
process.once("exit", releaseLock);

const cases = assertCaseRows(readJsonLines(casePath, "evaluation case manifest").rows);
const releaseCandidate = currentReleaseCandidate();
const provider = loadEvaluationProviderConfig();
const existing = existsSync(outputPath)
  ? assertModelRunRows(readJsonLines(outputPath, "model run output").rows)
  : [];
const completed = new Map(existing.map((row) => [row.id, row]));

for (const row of existing) {
  if (row.evaluationRunId !== evaluationRunId) throw new Error("existing model runs use a different evaluationRunId");
  if (row.releaseCandidate !== releaseCandidate) throw new Error("existing model runs target a different release candidate");
  if (row.modelConfigSha256 !== provider.modelConfigSha256) throw new Error("existing model runs use a different model configuration");
  const matchingCase = cases.find((item) => item.id === row.id);
  if (matchingCase === undefined || matchingCase.caseSha256 !== row.caseSha256) {
    throw new Error(`existing model run does not match current case manifest: ${row.id}`);
  }
}

let collected = 0;
for (const [index, evaluationCase] of cases.entries()) {
  if (completed.has(evaluationCase.id)) continue;
  const response = await fetch(`${provider.baseUrl.replace(/\/$/u, "")}/v1/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.modelName,
      reasoning: { effort: provider.reasoningEffort },
      input: [
        { role: "developer", content: evaluationCase.developerInstruction },
        { role: "user", content: evaluationCase.prompt },
      ],
      max_output_tokens: provider.maxOutputTokens,
      store: false,
    }),
    signal: AbortSignal.timeout(provider.timeoutMs),
  });
  if (!response.ok) throw new Error(`real provider request failed with HTTP ${String(response.status)}`);
  const body = await response.json();
  const providerResponseId = readProviderResponseId(body);
  const providerReportedModel = readProviderReportedModel(body);
  if (typeof body.status !== "string" || body.status !== "completed") {
    throw new Error("real provider response did not complete");
  }
  const responseText = readOutputText(body);
  const generatedAt = new Date().toISOString();
  const modelRunId = sha256(`${evaluationRunId}\0${providerResponseId}`);
  const output = {
    schemaVersion: 1,
    id: evaluationCase.id,
    evaluationRunId,
    releaseCandidate,
    subjectCode: evaluationCase.subjectCode,
    questionType: evaluationCase.questionType,
    caseSha256: evaluationCase.caseSha256,
    developerInstruction: evaluationCase.developerInstruction,
    prompt: evaluationCase.prompt,
    rubric: evaluationCase.rubric,
    sourceKind: evaluationCase.sourceKind,
    sourceReference: evaluationCase.sourceReference,
    sourceReferenceHash: sha256(evaluationCase.sourceReference),
    caseAuthorReference: evaluationCase.caseAuthorReference,
    curatedAt: evaluationCase.curatedAt,
    caseAttestation: evaluationCase.caseAttestation,
    privacyAttestation: evaluationCase.privacyAttestation,
    promptVersion: evaluationCase.promptVersion,
    modelProvider: "openai-compatible",
    modelName: provider.modelName,
    providerReportedModel,
    modelConfigSha256: provider.modelConfigSha256,
    providerResponseId,
    modelRunId,
    generatedAt,
    responseText,
    responseSha256: sha256(responseText),
  };
  assertModelRunRows([...completed.values(), output]);
  appendPrivateJsonLine(outputPath, output);
  completed.set(output.id, output);
  collected += 1;
  console.error(`Collected ${String(index + 1)}/${String(cases.length)} without judging the response.`);
}

const aggregate = {
  status: "COLLECTED_AWAITING_HUMAN_REVIEW",
  evaluationRunId,
  releaseCandidate,
  totalCases: cases.length,
  previouslyCollected: existing.length,
  collectedNow: collected,
  modelConfigSha256: provider.modelConfigSha256,
  caseManifestSha256: sha256(canonicalJson(cases.map(({ caseSha256 }) => caseSha256))),
  outputPathIsGitExternal: true,
  backendV1VerifiedEligible: false,
};
console.log(JSON.stringify(aggregate));
releaseLock();

function readProviderResponseId(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value) || typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("provider response id is missing");
  }
  return value.id;
}

function readProviderReportedModel(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value) || typeof value.model !== "string" || value.model.length === 0) {
    throw new Error("provider-reported model is missing");
  }
  return value.model;
}

function readOutputText(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !Array.isArray(value.output)) {
    throw new Error("provider output is missing");
  }
  const parts = [];
  for (const item of value.output) {
    if (typeof item !== "object" || item === null || Array.isArray(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (
        typeof content === "object"
        && content !== null
        && !Array.isArray(content)
        && content.type === "output_text"
        && typeof content.text === "string"
        && content.text.trim().length > 0
      ) {
        parts.push(content.text);
      } else if (
        typeof content === "object"
        && content !== null
        && !Array.isArray(content)
        && content.type === "refusal"
        && typeof content.refusal === "string"
        && content.refusal.trim().length > 0
      ) {
        parts.push(`[PROVIDER_REFUSAL]\n${content.refusal}`);
      }
    }
  }
  if (parts.length > 0) return parts.join("\n");
  throw new Error("provider output text is missing");
}
