import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";

import {
  FROZEN_RUNNER_NORMALIZED_SHA256,
  PRIVACY_ATTESTATION,
  QUESTION_TYPES,
  REQUIRED_SUBJECTS,
  TOOL_TEST_CASE_ATTESTATION,
  TOOL_TEST_REVIEW_ATTESTATION,
  acquirePrivateLock,
  assertCaseRows,
  assertExternalPath,
  assertModelRunRows,
  assertReviewedOutcomeRows,
  assertReviewsMatchModelRuns,
  canonicalJson,
  normalizedFileSha256,
  repositoryRoot,
  sha256,
} from "./ai-eval-workflow-lib.mjs";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "qinglang-ai-eval-tool-test-"));
after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));

test("keeps evaluation artifacts outside the Git working tree", () => {
  assert.throws(
    () => assertExternalPath(resolve(repositoryRoot(), "inside.jsonl"), "dataset"),
    /outside the Git working tree/u,
  );
  assert.equal(
    assertExternalPath(join(temporaryDirectory, "outside.jsonl"), "dataset"),
    join(temporaryDirectory, "outside.jsonl"),
  );
});

test("prevents concurrent writers from duplicating provider calls or reviews", () => {
  const path = join(temporaryDirectory, "locked-output.jsonl");
  const release = acquirePrivateLock(path, "tool-test output");
  assert.throws(() => acquirePrivateLock(path, "tool-test output"), /already locked/u);
  release();
  const releaseAgain = acquirePrivateLock(path, "tool-test output");
  releaseAgain();
});

test("pins the normalized frozen runner hash", () => {
  assert.equal(
    normalizedFileSha256(resolve(repositoryRoot(), "scripts", "ai-eval-runner.mjs")),
    FROZEN_RUNNER_NORMALIZED_SHA256,
  );
});

test("reports NOT_RUN when no real reviewed dataset path is supplied", () => {
  const result = spawnSync(process.execPath, [resolve(repositoryRoot(), "scripts", "ai-eval-reviewed-gate.mjs")], {
    cwd: repositoryRoot(),
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "NOT_RUN",
    backendV1VerifiedEligible: false,
    reason: "REAL_HUMAN_REVIEWED_DATASET_PATH_REQUIRED",
  });
});

test("all workflow commands expose a non-mutating help path", () => {
  for (const script of [
    "ai-eval-validate-cases.mjs",
    "ai-eval-collect.mjs",
    "ai-eval-review.mjs",
    "ai-eval-reviewed-gate.mjs",
  ]) {
    const result = spawnSync(process.execPath, [resolve(repositoryRoot(), "scripts", script), "--help"], {
      cwd: repositoryRoot(),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${script} help failed: ${result.stderr}`);
    assert.match(result.stdout, /Usage:/u);
  }
});

test("tool-test cases can test structure but are rejected as release evidence", () => {
  const rows = buildCaseRows();
  assert.equal(assertCaseRows(rows, { allowToolTest: true }).length, 105);
  assert.throws(() => assertCaseRows(rows), /human reviewer or curator|caseAttestation/u);
});

test("tool-test reviews can test structure but are rejected as human review", () => {
  const rows = buildReviewedRows();
  assert.equal(assertReviewedOutcomeRows(rows, { allowToolTest: true }).length, 105);
  assert.throws(() => assertReviewedOutcomeRows(rows), /human reviewer or curator|attestation/u);
});

test("review hashes and metadata must match the exact real-provider run bundle", () => {
  const runs = assertModelRunRows(buildModelRunRows(), { allowToolTest: true });
  const outcomes = assertReviewedOutcomeRows(buildReviewedRows(), { allowToolTest: true });
  assert.doesNotThrow(() => assertReviewsMatchModelRuns(outcomes, runs));
  const changed = outcomes.map((row, index) => index === 0 ? { ...row, responseSha256: "f".repeat(64) } : row);
  assert.throws(() => assertReviewsMatchModelRuns(changed, runs), /responseSha256/u);
});

test("the unchanged frozen runner enforces pass and fabricated-citation thresholds", () => {
  const path = join(temporaryDirectory, "runner-tool-test.jsonl");
  const rows = buildReviewedRows().map((row) => ({
    id: row.id,
    subjectCode: row.subjectCode,
    questionType: row.questionType,
    passed: true,
    fabricatedCitation: false,
  }));
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  const runner = resolve(repositoryRoot(), "scripts", "ai-eval-runner.mjs");
  const passed = spawnSync(process.execPath, [runner, path], { cwd: repositoryRoot(), encoding: "utf8" });
  assert.equal(passed.status, 0);
  assert.equal(JSON.parse(passed.stdout).total, 105);

  rows[0] = { ...rows[0], fabricatedCitation: true };
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  const rejected = spawnSync(process.execPath, [runner, path], { cwd: repositoryRoot(), encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /fabricated citation detected/u);
});

test("collector cannot call a provider without explicit confirmation", () => {
  const result = spawnSync(process.execPath, [
    resolve(repositoryRoot(), "scripts", "ai-eval-collect.mjs"),
    join(temporaryDirectory, "cases.jsonl"),
    join(temporaryDirectory, "runs.jsonl"),
    "tool-run-001",
    "DO_NOT_RUN",
  ], { cwd: repositoryRoot(), encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit real-provider evaluation confirmation is required/u);
});

test("human review CLI refuses non-interactive automation", () => {
  const result = spawnSync(process.execPath, [
    resolve(repositoryRoot(), "scripts", "ai-eval-review.mjs"),
    join(temporaryDirectory, "runs.jsonl"),
    join(temporaryDirectory, "reviews.jsonl"),
    "human-reviewer-01",
  ], { cwd: repositoryRoot(), encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /interactive TTY/u);
});

function buildCaseRows() {
  return REQUIRED_SUBJECTS.flatMap((subjectCode) => Array.from({ length: 15 }, (_value, index) => ({
    schemaVersion: 1,
    id: `tool-${subjectCode.toLowerCase()}-${String(index).padStart(3, "0")}`,
    subjectCode,
    questionType: QUESTION_TYPES[index % 3],
    developerInstruction: "Tool-test instruction only; this is not release evidence.",
    prompt: `Tool-test prompt ${subjectCode} ${String(index)} only.`,
    rubric: "Tool-test rubric only; no human judgment is claimed.",
    sourceKind: "ORIGINAL_HUMAN",
    sourceReference: `tool-test-source-${subjectCode.toLowerCase()}-${String(index)}`,
    caseAuthorReference: "tool-test-curator",
    curatedAt: "2026-08-30T00:00:00.000Z",
    caseAttestation: TOOL_TEST_CASE_ATTESTATION,
    privacyAttestation: PRIVACY_ATTESTATION,
    promptVersion: "tool-prompt-v1",
  })));
}

function buildReviewedRows() {
  return buildCaseRows().map((row) => ({
    schemaVersion: 1,
    id: row.id,
    subjectCode: row.subjectCode,
    questionType: row.questionType,
    passed: true,
    fabricatedCitation: false,
    evaluationRunId: "tool-run-001",
    releaseCandidate: "a".repeat(40),
    caseSha256: sha256(canonicalJson(row)),
    responseSha256: sha256(`Tool-test response for ${row.id}; not release evidence.`),
    sourceKind: row.sourceKind,
    sourceReferenceHash: sha256(row.sourceReference),
    promptVersion: row.promptVersion,
    modelProvider: "openai-compatible",
    modelName: "tool-test-model",
    providerReportedModel: "tool-test-model-actual",
    modelConfigSha256: "b".repeat(64),
    modelRunId: sha256(`model-run:${row.id}`),
    generatedAt: "2026-08-30T00:30:00.000Z",
    reviewerReference: "tool-test-reviewer",
    reviewedAt: "2026-08-30T01:00:00.000Z",
    attestation: TOOL_TEST_REVIEW_ATTESTATION,
  }));
}

function buildModelRunRows() {
  return buildCaseRows().map((row) => {
    const responseText = `Tool-test response for ${row.id}; not release evidence.`;
    return {
      schemaVersion: 1,
      id: row.id,
      evaluationRunId: "tool-run-001",
      releaseCandidate: "a".repeat(40),
      subjectCode: row.subjectCode,
      questionType: row.questionType,
      caseSha256: sha256(canonicalJson(row)),
      developerInstruction: row.developerInstruction,
      prompt: row.prompt,
      rubric: row.rubric,
      sourceKind: row.sourceKind,
      sourceReference: row.sourceReference,
      sourceReferenceHash: sha256(row.sourceReference),
      caseAuthorReference: row.caseAuthorReference,
      curatedAt: row.curatedAt,
      caseAttestation: row.caseAttestation,
      privacyAttestation: row.privacyAttestation,
      promptVersion: row.promptVersion,
      modelProvider: "openai-compatible",
      modelName: "tool-test-model",
      providerReportedModel: "tool-test-model-actual",
      modelConfigSha256: "b".repeat(64),
      providerResponseId: `tool-response-${row.id}`,
      modelRunId: sha256(`model-run:${row.id}`),
      generatedAt: "2026-08-30T00:30:00.000Z",
      responseText,
      responseSha256: sha256(responseText),
    };
  });
}
