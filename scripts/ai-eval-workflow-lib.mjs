import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const REQUIRED_SUBJECTS = Object.freeze([
  "CHINESE",
  "MATH",
  "ENGLISH",
  "MORALITY",
  "HISTORY",
  "PHYSICS",
  "CHEMISTRY",
]);

export const QUESTION_TYPES = Object.freeze([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "SHORT_ANSWER",
  "CALCULATION",
  "EXPERIMENT_DESIGN",
  "ERROR_DIAGNOSIS",
  "GRAPHING",
]);

export const SOURCE_KINDS = Object.freeze([
  "AUTHORIZED_PRIVATE",
  "PUBLIC_DOMAIN",
  "OPEN_LICENSE",
  "ORIGINAL_HUMAN",
]);

export const CASE_ATTESTATION = "HUMAN_CURATED_AUTHORIZED_EVALUATION_CASE";
export const PRIVACY_ATTESTATION = "NO_REAL_STUDENT_IDENTITY_OR_CREDENTIALS";
export const REVIEW_ATTESTATION = "HUMAN_REVIEWED_REAL_PROVIDER_OUTPUT";
export const TOOL_TEST_CASE_ATTESTATION = "TOOL_TEST_CASE_NOT_RELEASE_EVIDENCE";
export const TOOL_TEST_REVIEW_ATTESTATION = "TOOL_TEST_REVIEW_NOT_RELEASE_EVIDENCE";
export const FROZEN_RUNNER_NORMALIZED_SHA256 = "b2820c691ed2dfc3f0415ba220136fb7e01cb836648da994cc7630d30b6e8786";

const automationReferencePattern = /(?:^|[._-])(agent|bot|chatgpt|codex|fixture|fake|model|robot|test)(?:$|[._-])/iu;
const placeholderPattern = /(change[-_ ]?me|development|example|fictional|local[-_ ]?only|replace|test[-_ ]?only)/iu;
const stableReferencePattern = /^[a-z0-9][a-z0-9._-]{7,119}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const commitPattern = /^[0-9a-f]{40}$/u;

export function repositoryRoot() {
  return resolve(import.meta.dirname, "..");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizedFileSha256(path) {
  return sha256(readFileSync(path, "utf8").replace(/\r\n/gu, "\n"));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function readJsonLines(path, label) {
  const raw = readFileSync(path, "utf8");
  const rows = [];
  for (const [index, line] of raw.split(/\r?\n/gu).entries()) {
    if (line.trim().length === 0) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      throw new Error(`${label} line ${String(index + 1)} is not valid JSON`);
    }
  }
  if (rows.length === 0) throw new Error(`${label} must contain at least one JSONL row`);
  return { raw, rows };
}

export function assertExternalPath(path, label, options = {}) {
  const root = realpathSync(repositoryRoot());
  const target = resolve(path);
  const existingAnchor = existsSync(target) ? realpathSync(target) : realpathSync(dirname(target));
  const comparison = relative(root, existingAnchor);
  const insideRepository = comparison === ""
    || (comparison !== ".." && !comparison.startsWith(`..${sep}`) && !isAbsolute(comparison));
  if (insideRepository) {
    throw new Error(`${label} must remain outside the Git working tree`);
  }
  if (options.mustExist === true && !existsSync(target)) throw new Error(`${label} does not exist`);
  return target;
}

export function appendPrivateJsonLine(path, row) {
  appendFileSync(path, `${JSON.stringify(row)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows ACLs do not map directly to POSIX mode bits; the path remains Git-external.
  }
}

export function acquirePrivateLock(dataPath, label) {
  const lockPath = `${dataPath}.lock`;
  let descriptor;
  try {
    descriptor = openSync(lockPath, "wx", 0o600);
  } catch {
    throw new Error(`${label} is already locked; do not run concurrent collection or review processes`);
  }
  writeFileSync(descriptor, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), "utf8");
  try {
    chmodSync(lockPath, 0o600);
  } catch {
    // Windows ACLs do not map directly to POSIX mode bits; the path remains Git-external.
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    closeSync(descriptor);
    try {
      unlinkSync(lockPath);
    } catch {
      // A stale lock is safer than allowing concurrent writes; the next run will fail closed.
    }
  };
}

export function assertNotLocked(dataPath, label) {
  if (existsSync(`${dataPath}.lock`)) throw new Error(`${label} is still locked by a collection or review process`);
}

export function assertExactKeys(row, expectedKeys, label) {
  assertPlainObject(row, label);
  const actual = Object.keys(row).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly: ${expected.join(", ")}`);
  }
}

export function assertCaseRows(rows, options = {}) {
  const allowToolTest = options.allowToolTest === true;
  if (rows.length > 500) throw new Error("evaluation case manifest exceeds the 500-case safety limit");
  const ids = new Set();
  const validated = rows.map((row, index) => {
    const label = `case row ${String(index + 1)}`;
    assertExactKeys(row, [
      "schemaVersion",
      "id",
      "subjectCode",
      "questionType",
      "developerInstruction",
      "prompt",
      "rubric",
      "sourceKind",
      "sourceReference",
      "caseAuthorReference",
      "curatedAt",
      "caseAttestation",
      "privacyAttestation",
      "promptVersion",
    ], label);
    assertInteger(row.schemaVersion, 1, 1, `${label}.schemaVersion`);
    assertStableReference(row.id, `${label}.id`);
    if (ids.has(row.id)) throw new Error(`duplicate case id: ${row.id}`);
    ids.add(row.id);
    assertEnum(row.subjectCode, REQUIRED_SUBJECTS, `${label}.subjectCode`);
    assertEnum(row.questionType, QUESTION_TYPES, `${label}.questionType`);
    assertBoundedString(row.developerInstruction, 8, 4_000, `${label}.developerInstruction`);
    assertBoundedString(row.prompt, 8, 20_000, `${label}.prompt`);
    assertBoundedString(row.rubric, 8, 10_000, `${label}.rubric`);
    assertEnum(row.sourceKind, SOURCE_KINDS, `${label}.sourceKind`);
    assertBoundedString(row.sourceReference, 8, 500, `${label}.sourceReference`);
    assertHumanReference(row.caseAuthorReference, `${label}.caseAuthorReference`, allowToolTest);
    assertUtcDate(row.curatedAt, `${label}.curatedAt`);
    const acceptedAttestations = allowToolTest
      ? [CASE_ATTESTATION, TOOL_TEST_CASE_ATTESTATION]
      : [CASE_ATTESTATION];
    assertEnum(row.caseAttestation, acceptedAttestations, `${label}.caseAttestation`);
    if (row.privacyAttestation !== PRIVACY_ATTESTATION) {
      throw new Error(`${label}.privacyAttestation is invalid`);
    }
    assertStableReference(row.promptVersion, `${label}.promptVersion`);
    return Object.freeze({ ...row, caseSha256: sha256(canonicalJson(row)) });
  });
  assertCoverage(validated);
  return validated;
}

export function assertCoverage(rows) {
  if (rows.length < 100) throw new Error("at least 100 evaluation cases are required before provider collection");
  const coverage = new Map();
  for (const row of rows) {
    const value = coverage.get(row.subjectCode) ?? { total: 0, types: new Set() };
    value.total += 1;
    value.types.add(row.questionType);
    coverage.set(row.subjectCode, value);
  }
  for (const subjectCode of REQUIRED_SUBJECTS) {
    const value = coverage.get(subjectCode);
    if (value === undefined || value.total < 10 || value.types.size < 3) {
      throw new Error(`case coverage is incomplete for ${subjectCode}`);
    }
  }
  return Object.fromEntries(REQUIRED_SUBJECTS.map((subjectCode) => {
    const value = coverage.get(subjectCode);
    return [subjectCode, { total: value.total, questionTypes: value.types.size }];
  }));
}

export function assertModelRunRows(rows, options = {}) {
  const allowToolTest = options.allowToolTest === true;
  if (rows.length > 500) throw new Error("model run dataset exceeds the 500-case safety limit");
  const ids = new Set();
  const runIds = new Set();
  const modelRunIds = new Set();
  const validated = rows.map((row, index) => {
    const label = `model run row ${String(index + 1)}`;
    assertExactKeys(row, [
      "schemaVersion",
      "id",
      "evaluationRunId",
      "releaseCandidate",
      "subjectCode",
      "questionType",
      "caseSha256",
      "developerInstruction",
      "prompt",
      "rubric",
      "sourceKind",
      "sourceReference",
      "sourceReferenceHash",
      "caseAuthorReference",
      "curatedAt",
      "caseAttestation",
      "privacyAttestation",
      "promptVersion",
      "modelProvider",
      "modelName",
      "providerReportedModel",
      "modelConfigSha256",
      "providerResponseId",
      "modelRunId",
      "generatedAt",
      "responseText",
      "responseSha256",
    ], label);
    assertInteger(row.schemaVersion, 1, 1, `${label}.schemaVersion`);
    assertStableReference(row.id, `${label}.id`);
    if (ids.has(row.id)) throw new Error(`duplicate model run case id: ${row.id}`);
    ids.add(row.id);
    assertStableReference(row.evaluationRunId, `${label}.evaluationRunId`);
    runIds.add(row.evaluationRunId);
    assertCommit(row.releaseCandidate, `${label}.releaseCandidate`);
    assertEnum(row.subjectCode, REQUIRED_SUBJECTS, `${label}.subjectCode`);
    assertEnum(row.questionType, QUESTION_TYPES, `${label}.questionType`);
    assertSha256(row.caseSha256, `${label}.caseSha256`);
    assertBoundedString(row.developerInstruction, 8, 4_000, `${label}.developerInstruction`);
    assertBoundedString(row.prompt, 8, 20_000, `${label}.prompt`);
    assertBoundedString(row.rubric, 8, 10_000, `${label}.rubric`);
    assertEnum(row.sourceKind, SOURCE_KINDS, `${label}.sourceKind`);
    assertBoundedString(row.sourceReference, 8, 500, `${label}.sourceReference`);
    assertSha256(row.sourceReferenceHash, `${label}.sourceReferenceHash`);
    if (sha256(row.sourceReference) !== row.sourceReferenceHash) {
      throw new Error(`${label}.sourceReferenceHash does not match sourceReference`);
    }
    assertHumanReference(row.caseAuthorReference, `${label}.caseAuthorReference`, allowToolTest);
    assertUtcDate(row.curatedAt, `${label}.curatedAt`);
    const acceptedCaseAttestations = allowToolTest
      ? [CASE_ATTESTATION, TOOL_TEST_CASE_ATTESTATION]
      : [CASE_ATTESTATION];
    assertEnum(row.caseAttestation, acceptedCaseAttestations, `${label}.caseAttestation`);
    if (row.privacyAttestation !== PRIVACY_ATTESTATION) throw new Error(`${label}.privacyAttestation is invalid`);
    assertStableReference(row.promptVersion, `${label}.promptVersion`);
    if (row.modelProvider !== "openai-compatible") throw new Error(`${label}.modelProvider is not a real supported provider`);
    assertRealModelName(row.modelName, `${label}.modelName`, allowToolTest);
    assertRealModelName(row.providerReportedModel, `${label}.providerReportedModel`, allowToolTest);
    assertSha256(row.modelConfigSha256, `${label}.modelConfigSha256`);
    assertBoundedString(row.providerResponseId, 1, 240, `${label}.providerResponseId`);
    assertBoundedString(row.modelRunId, 1, 240, `${label}.modelRunId`);
    if (modelRunIds.has(row.modelRunId)) throw new Error(`duplicate model run id: ${row.modelRunId}`);
    modelRunIds.add(row.modelRunId);
    assertUtcDate(row.generatedAt, `${label}.generatedAt`);
    assertBoundedString(row.responseText, 1, 100_000, `${label}.responseText`);
    assertSha256(row.responseSha256, `${label}.responseSha256`);
    if (sha256(row.responseText) !== row.responseSha256) throw new Error(`${label}.responseSha256 does not match responseText`);
    const reconstructedCase = {
      schemaVersion: 1,
      id: row.id,
      subjectCode: row.subjectCode,
      questionType: row.questionType,
      developerInstruction: row.developerInstruction,
      prompt: row.prompt,
      rubric: row.rubric,
      sourceKind: row.sourceKind,
      sourceReference: row.sourceReference,
      caseAuthorReference: row.caseAuthorReference,
      curatedAt: row.curatedAt,
      caseAttestation: row.caseAttestation,
      privacyAttestation: row.privacyAttestation,
      promptVersion: row.promptVersion,
    };
    if (sha256(canonicalJson(reconstructedCase)) !== row.caseSha256) {
      throw new Error(`${label}.caseSha256 does not match its human-curated case record`);
    }
    return Object.freeze({ ...row });
  });
  if (runIds.size !== 1) throw new Error("model run rows must use one evaluationRunId");
  assertSingleValue(validated, "releaseCandidate");
  assertSingleValue(validated, "modelConfigSha256");
  return validated;
}

export function assertReviewedOutcomeRows(rows, options = {}) {
  const allowToolTest = options.allowToolTest === true;
  if (rows.length > 500) throw new Error("reviewed outcome dataset exceeds the 500-case safety limit");
  const ids = new Set();
  const modelRunIds = new Set();
  const caseHashes = new Set();
  const reviewed = rows.map((row, index) => {
    const label = `reviewed outcome row ${String(index + 1)}`;
    assertExactKeys(row, [
      "schemaVersion",
      "id",
      "subjectCode",
      "questionType",
      "passed",
      "fabricatedCitation",
      "evaluationRunId",
      "releaseCandidate",
      "caseSha256",
      "responseSha256",
      "sourceKind",
      "sourceReferenceHash",
      "promptVersion",
      "modelProvider",
      "modelName",
      "providerReportedModel",
      "modelConfigSha256",
      "modelRunId",
      "generatedAt",
      "reviewerReference",
      "reviewedAt",
      "attestation",
    ], label);
    assertInteger(row.schemaVersion, 1, 1, `${label}.schemaVersion`);
    assertStableReference(row.id, `${label}.id`);
    if (ids.has(row.id)) throw new Error(`duplicate reviewed outcome id: ${row.id}`);
    ids.add(row.id);
    assertEnum(row.subjectCode, REQUIRED_SUBJECTS, `${label}.subjectCode`);
    assertEnum(row.questionType, QUESTION_TYPES, `${label}.questionType`);
    assertBoolean(row.passed, `${label}.passed`);
    assertBoolean(row.fabricatedCitation, `${label}.fabricatedCitation`);
    assertStableReference(row.evaluationRunId, `${label}.evaluationRunId`);
    assertCommit(row.releaseCandidate, `${label}.releaseCandidate`);
    assertSha256(row.caseSha256, `${label}.caseSha256`);
    if (caseHashes.has(row.caseSha256)) throw new Error(`duplicate reviewed case hash: ${row.caseSha256}`);
    caseHashes.add(row.caseSha256);
    assertSha256(row.responseSha256, `${label}.responseSha256`);
    assertEnum(row.sourceKind, SOURCE_KINDS, `${label}.sourceKind`);
    assertSha256(row.sourceReferenceHash, `${label}.sourceReferenceHash`);
    assertStableReference(row.promptVersion, `${label}.promptVersion`);
    if (row.modelProvider !== "openai-compatible") throw new Error(`${label}.modelProvider is not a real supported provider`);
    assertRealModelName(row.modelName, `${label}.modelName`, allowToolTest);
    assertRealModelName(row.providerReportedModel, `${label}.providerReportedModel`, allowToolTest);
    assertSha256(row.modelConfigSha256, `${label}.modelConfigSha256`);
    assertBoundedString(row.modelRunId, 1, 240, `${label}.modelRunId`);
    if (modelRunIds.has(row.modelRunId)) throw new Error(`duplicate reviewed model run id: ${row.modelRunId}`);
    modelRunIds.add(row.modelRunId);
    assertUtcDate(row.generatedAt, `${label}.generatedAt`);
    assertHumanReference(row.reviewerReference, `${label}.reviewerReference`, allowToolTest);
    assertUtcDate(row.reviewedAt, `${label}.reviewedAt`);
    if (Date.parse(row.reviewedAt) < Date.parse(row.generatedAt)) {
      throw new Error(`${label}.reviewedAt cannot precede the real provider output`);
    }
    const acceptedAttestations = allowToolTest
      ? [REVIEW_ATTESTATION, TOOL_TEST_REVIEW_ATTESTATION]
      : [REVIEW_ATTESTATION];
    assertEnum(row.attestation, acceptedAttestations, `${label}.attestation`);
    return Object.freeze({ ...row });
  });
  assertSingleValue(reviewed, "evaluationRunId");
  assertSingleValue(reviewed, "releaseCandidate");
  assertSingleValue(reviewed, "modelConfigSha256");
  return reviewed;
}

export function assertReviewsMatchModelRuns(outcomes, runs) {
  if (outcomes.length !== runs.length) {
    throw new Error("every real provider model run must have exactly one human-reviewed outcome");
  }
  const outcomesById = new Map(outcomes.map((row) => [row.id, row]));
  for (const run of runs) {
    const outcome = outcomesById.get(run.id);
    if (outcome === undefined) throw new Error(`missing human-reviewed outcome for model run: ${run.id}`);
    for (const key of [
      "subjectCode",
      "questionType",
      "evaluationRunId",
      "releaseCandidate",
      "caseSha256",
      "responseSha256",
      "sourceKind",
      "sourceReferenceHash",
      "promptVersion",
      "modelProvider",
      "modelName",
      "providerReportedModel",
      "modelConfigSha256",
      "modelRunId",
      "generatedAt",
    ]) {
      if (outcome[key] !== run[key]) {
        throw new Error(`reviewed outcome metadata does not match model run for ${run.id}: ${key}`);
      }
    }
  }
}

export function currentReleaseCandidate() {
  const root = repositoryRoot();
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (status.status !== 0) throw new Error("unable to inspect Git status");
  if (status.stdout.trim().length > 0) throw new Error("the Git working tree must be clean for a release-bound evaluation");
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  if (commit.status !== 0) throw new Error("unable to resolve release candidate commit");
  const value = commit.stdout.trim();
  assertCommit(value, "release candidate");
  return value;
}

export function loadEvaluationProviderConfig() {
  loadDotEnvIfPresent();
  if (process.env.MODEL_PROVIDER !== "openai-compatible") {
    throw new Error("MODEL_PROVIDER must be openai-compatible for real evaluation collection");
  }
  const baseUrl = requiredEnvironment("MODEL_BASE_URL");
  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)) {
    throw new Error("MODEL_BASE_URL must be a non-loopback HTTPS provider for real evaluation");
  }
  const apiKey = requiredEnvironment("MODEL_API_KEY");
  if (apiKey.length < 20 || placeholderPattern.test(apiKey)) throw new Error("MODEL_API_KEY is missing or looks like a placeholder");
  const modelName = requiredEnvironment("MODEL_NAME");
  assertRealModelName(modelName, "MODEL_NAME", false);
  const reasoningEffort = requiredEnvironment("MODEL_REASONING_EFFORT");
  if (!["none", "low", "medium", "high", "xhigh", "max"].includes(reasoningEffort)) {
    throw new Error("MODEL_REASONING_EFFORT is invalid");
  }
  const timeoutMs = Number(requiredEnvironment("MODEL_TIMEOUT_MS"));
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) throw new Error("MODEL_TIMEOUT_MS is invalid");
  const maxOutputTokens = Number(process.env.AI_EVAL_MAX_OUTPUT_TOKENS ?? "2048");
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 8_192) {
    throw new Error("AI_EVAL_MAX_OUTPUT_TOKENS is invalid");
  }
  const modelConfigSha256 = sha256(canonicalJson({
    baseUrl,
    modelName,
    reasoningEffort,
    timeoutMs,
    maxOutputTokens,
  }));
  return Object.freeze({ baseUrl, apiKey, modelName, reasoningEffort, timeoutMs, maxOutputTokens, modelConfigSha256 });
}

function loadDotEnvIfPresent() {
  const path = resolve(repositoryRoot(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/gu)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (match === null || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function assertPlainObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertBoundedString(value, minimum, maximum, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length < minimum || value.length > maximum) {
    throw new Error(`${label} must be a trimmed string between ${String(minimum)} and ${String(maximum)} characters`);
  }
}

function assertStableReference(value, label) {
  if (typeof value !== "string" || !stableReferencePattern.test(value)) throw new Error(`${label} is invalid`);
}

function assertHumanReference(value, label, allowToolTest) {
  assertBoundedString(value, 3, 120, label);
  if (!allowToolTest && automationReferencePattern.test(value)) throw new Error(`${label} must identify a human reviewer or curator, not automation`);
}

function assertRealModelName(value, label, allowToolTest) {
  assertBoundedString(value, 1, 120, label);
  if (!allowToolTest && /(deterministic|fake|fixture|mock|test[-_ ]?only)/iu.test(value)) {
    throw new Error(`${label} identifies a test provider and cannot be used for the real evaluation gate`);
  }
}

function assertEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`${label} is invalid`);
}

function assertInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label} is invalid`);
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !sha256Pattern.test(value)) throw new Error(`${label} must be a lowercase SHA-256`);
}

function assertCommit(value, label) {
  if (typeof value !== "string" || !commitPattern.test(value)) throw new Error(`${label} must be a 40-character Git commit SHA`);
}

function assertUtcDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) {
    throw new Error(`${label} must be a UTC ISO timestamp`);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time > Date.now() + 5 * 60 * 1_000) throw new Error(`${label} is invalid or in the future`);
}

function assertSingleValue(rows, key) {
  if (new Set(rows.map((row) => row[key])).size !== 1) throw new Error(`reviewed outcomes must use one ${key}`);
}
