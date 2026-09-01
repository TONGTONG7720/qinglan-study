import {
  assertCaseRows,
  assertCoverage,
  assertExternalPath,
  canonicalJson,
  readJsonLines,
  sha256,
} from "./ai-eval-workflow-lib.mjs";

const usage = "Usage: node scripts/ai-eval-validate-cases.mjs <external-cases.jsonl>";
const [pathArgument] = process.argv.slice(2);
if (pathArgument === "--help") {
  console.log(usage);
  process.exit(0);
}
if (pathArgument === undefined) throw new Error(usage);
const path = assertExternalPath(pathArgument, "evaluation case manifest", { mustExist: true });
const cases = assertCaseRows(readJsonLines(path, "evaluation case manifest").rows);
const coverage = assertCoverage(cases);
const sourceKinds = Object.fromEntries([...new Set(cases.map((row) => row.sourceKind))].sort().map((kind) => [
  kind,
  cases.filter((row) => row.sourceKind === kind).length,
]));
console.log(JSON.stringify({
  status: "CASE_MANIFEST_READY_FOR_REAL_PROVIDER_COLLECTION",
  total: cases.length,
  coverage,
  humanCuratorCount: new Set(cases.map((row) => row.caseAuthorReference)).size,
  sourceKinds,
  caseManifestSha256: sha256(canonicalJson(cases.map(({ caseSha256 }) => caseSha256))),
  pathIsGitExternal: true,
  backendV1VerifiedEligible: false,
}));
