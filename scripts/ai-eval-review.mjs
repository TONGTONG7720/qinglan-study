import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

import {
  REVIEW_ATTESTATION,
  acquirePrivateLock,
  appendPrivateJsonLine,
  assertCoverage,
  assertExternalPath,
  assertModelRunRows,
  assertReviewedOutcomeRows,
  assertReviewsMatchModelRuns,
  readJsonLines,
} from "./ai-eval-workflow-lib.mjs";

const usage = "Usage: node scripts/ai-eval-review.mjs <external-model-runs.jsonl> <external-reviewed-outcomes.jsonl> <human-reviewer-reference>";
const [runPathArgument, outputPathArgument, reviewerReference] = process.argv.slice(2);

if (runPathArgument === "--help") {
  console.log(usage);
  process.exit(0);
}
if (runPathArgument === undefined || outputPathArgument === undefined || reviewerReference === undefined) {
  throw new Error(usage);
}
if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
  throw new Error("human review requires an interactive TTY and cannot run in CI or a redirected process");
}
if (/(?:^|[._-])(agent|bot|chatgpt|codex|fixture|fake|model|robot|test)(?:$|[._-])/iu.test(reviewerReference)) {
  throw new Error("reviewer reference must identify a human reviewer, not automation");
}
if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{2,119}$/u.test(reviewerReference)) {
  throw new Error("human-reviewer-reference is invalid");
}

const runPath = assertExternalPath(runPathArgument, "model run input", { mustExist: true });
const outputPath = assertExternalPath(outputPathArgument, "reviewed outcome output");
if (runPath === outputPath) throw new Error("model runs and reviewed outcomes must use different paths");
const releaseLock = acquirePrivateLock(outputPath, "reviewed outcome output");
process.once("exit", releaseLock);
const runs = assertModelRunRows(readJsonLines(runPath, "model run input").rows);
assertCoverage(runs);
const existing = existsSync(outputPath)
  ? assertReviewedOutcomeRows(readJsonLines(outputPath, "reviewed outcome output").rows)
  : [];
const completed = new Map(existing.map((row) => [row.id, row]));

for (const outcome of existing) {
  const run = runs.find((item) => item.id === outcome.id);
  if (run === undefined) throw new Error(`reviewed outcome has no matching model run: ${outcome.id}`);
  assertReviewMatchesRun(outcome, run);
}

const terminal = createInterface({ input: process.stdin, output: process.stdout });
try {
  const attestation = await terminal.question(`Type ${REVIEW_ATTESTATION} to begin human review: `);
  if (attestation !== REVIEW_ATTESTATION) throw new Error("human review attestation was not confirmed");
  let reviewedNow = 0;
  for (const [index, run] of runs.entries()) {
    if (completed.has(run.id)) continue;
    console.log("\n============================================================");
    console.log(`Case ${String(index + 1)}/${String(runs.length)}: ${run.id}`);
    console.log(`Subject: ${run.subjectCode} | Type: ${run.questionType}`);
    console.log(`Source: ${run.sourceKind} | ${run.sourceReference}`);
    console.log(`Human curator: ${run.caseAuthorReference} | Curated: ${run.curatedAt}`);
    console.log("\nDEVELOPER INSTRUCTION\n");
    console.log(run.developerInstruction);
    console.log("\nPROMPT\n");
    console.log(run.prompt);
    console.log("\nREVIEW RUBRIC\n");
    console.log(run.rubric);
    console.log("\nREAL PROVIDER RESPONSE\n");
    console.log(run.responseText);
    const passed = await askYesNo(terminal, "Does the response pass the human rubric? [y/n/q] ");
    if (passed === "QUIT") break;
    const fabricatedCitation = await askYesNo(terminal, "Does it contain any fabricated citation? [y/n/q] ");
    if (fabricatedCitation === "QUIT") break;
    const outcome = {
      schemaVersion: 1,
      id: run.id,
      subjectCode: run.subjectCode,
      questionType: run.questionType,
      passed,
      fabricatedCitation,
      evaluationRunId: run.evaluationRunId,
      releaseCandidate: run.releaseCandidate,
      caseSha256: run.caseSha256,
      responseSha256: run.responseSha256,
      sourceKind: run.sourceKind,
      sourceReferenceHash: run.sourceReferenceHash,
      promptVersion: run.promptVersion,
      modelProvider: run.modelProvider,
      modelName: run.modelName,
      providerReportedModel: run.providerReportedModel,
      modelConfigSha256: run.modelConfigSha256,
      modelRunId: run.modelRunId,
      generatedAt: run.generatedAt,
      reviewerReference,
      reviewedAt: new Date().toISOString(),
      attestation: REVIEW_ATTESTATION,
    };
    assertReviewedOutcomeRows([...completed.values(), outcome]);
    appendPrivateJsonLine(outputPath, outcome);
    completed.set(outcome.id, outcome);
    reviewedNow += 1;
    console.error(`Human-reviewed ${String(completed.size)}/${String(runs.length)}.`);
  }
  console.log(JSON.stringify({
    status: completed.size === runs.length ? "HUMAN_REVIEW_COMPLETE_AWAITING_GATE" : "HUMAN_REVIEW_INCOMPLETE",
    totalModelRuns: runs.length,
    previouslyReviewed: existing.length,
    reviewedNow,
    totalReviewed: completed.size,
    outputPathIsGitExternal: true,
    backendV1VerifiedEligible: false,
  }));
} finally {
  terminal.close();
  releaseLock();
}

async function askYesNo(terminal, prompt) {
  for (;;) {
    const value = (await terminal.question(prompt)).trim().toLowerCase();
    if (value === "y" || value === "yes") return true;
    if (value === "n" || value === "no") return false;
    if (value === "q" || value === "quit") return "QUIT";
    console.error("Enter y, n, or q.");
  }
}

function assertReviewMatchesRun(outcome, run) {
  assertReviewsMatchModelRuns([outcome], [run]);
}
