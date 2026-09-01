import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  FROZEN_RUNNER_NORMALIZED_SHA256,
  assertCoverage,
  assertExternalPath,
  assertModelRunRows,
  assertNotLocked,
  assertReviewedOutcomeRows,
  assertReviewsMatchModelRuns,
  currentReleaseCandidate,
  normalizedFileSha256,
  readJsonLines,
  repositoryRoot,
  sha256,
} from "./ai-eval-workflow-lib.mjs";

const usage = "Usage: node scripts/ai-eval-reviewed-gate.mjs <external-model-runs.jsonl> <external-reviewed-outcomes.jsonl>";
const [runPathArgument, reviewedPathArgument] = process.argv.slice(2);

if (runPathArgument === "--help") {
  console.log(usage);
  process.exit(0);
}
if (runPathArgument === undefined && reviewedPathArgument === undefined) {
  console.log(JSON.stringify({
    status: "NOT_RUN",
    backendV1VerifiedEligible: false,
    reason: "REAL_HUMAN_REVIEWED_DATASET_PATH_REQUIRED",
  }));
  process.exitCode = 2;
} else {
  if (runPathArgument === undefined || reviewedPathArgument === undefined) throw new Error(usage);
  const runPath = assertExternalPath(runPathArgument, "model run dataset", { mustExist: true });
  const reviewedPath = assertExternalPath(reviewedPathArgument, "reviewed outcome dataset", { mustExist: true });
  if (runPath === reviewedPath) throw new Error("model runs and reviewed outcomes must use different paths");
  assertNotLocked(runPath, "model run dataset");
  assertNotLocked(reviewedPath, "reviewed outcome dataset");
  const modelRunsDataset = readJsonLines(runPath, "model run dataset");
  const modelRuns = assertModelRunRows(modelRunsDataset.rows);
  assertCoverage(modelRuns);
  const dataset = readJsonLines(reviewedPath, "reviewed outcome dataset");
  const outcomes = assertReviewedOutcomeRows(dataset.rows);
  assertCoverage(outcomes);
  assertReviewsMatchModelRuns(outcomes, modelRuns);
  const releaseCandidate = currentReleaseCandidate();
  if (outcomes[0].releaseCandidate !== releaseCandidate) {
    throw new Error("reviewed outcomes target a different release candidate commit");
  }

  const runnerPath = resolve(repositoryRoot(), "scripts", "ai-eval-runner.mjs");
  const runnerSha256 = normalizedFileSha256(runnerPath);
  if (runnerSha256 !== FROZEN_RUNNER_NORMALIZED_SHA256) {
    throw new Error("frozen AI evaluation runner hash changed; a new explicit review is required");
  }
  const result = spawnSync(process.execPath, [runnerPath, reviewedPath], {
    cwd: repositoryRoot(),
    encoding: "utf8",
    maxBuffer: 2 * 1_024 * 1_024,
  });
  if (result.status !== 0) throw new Error(`frozen AI evaluation gate failed: ${runnerFailure(result.stderr)}`);
  let aggregate;
  try {
    aggregate = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("frozen AI evaluation runner returned invalid aggregate JSON");
  }
  const reviewers = [...new Set(outcomes.map((row) => row.reviewerReference))].sort();
  const reviewedTimes = outcomes.map((row) => row.reviewedAt).sort();
  console.log(JSON.stringify({
    status: "PASSED",
    backendV1VerifiedEligible: true,
    releaseCandidate,
    evaluationRunId: outcomes[0].evaluationRunId,
    modelConfigSha256: outcomes[0].modelConfigSha256,
    modelRunsSha256: sha256(modelRunsDataset.raw.replace(/\r\n/gu, "\n")),
    datasetSha256: sha256(dataset.raw.replace(/\r\n/gu, "\n")),
    frozenRunnerSha256: runnerSha256,
    humanReviewerCount: reviewers.length,
    firstReviewedAt: reviewedTimes[0],
    lastReviewedAt: reviewedTimes.at(-1),
    aggregate,
  }));
}

function runnerFailure(stderr) {
  const match = /Error: ([^\r\n]+)/u.exec(stderr);
  return (match?.[1] ?? "threshold or integrity check failed").slice(0, 240);
}
