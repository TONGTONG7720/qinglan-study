import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "study-smartedu-check-"));
if (dirname(temporaryRoot) !== resolve(tmpdir())) throw new Error("Unsafe SmartEdu temporary directory");
const cachePath = join(temporaryRoot, "flattened-catalog.json");
const selectedPath = join(temporaryRoot, "selected-36.json");
try {
  await run(process.execPath, [resolve(import.meta.dirname, "refresh-smartedu-textbook-cache.mjs"), cachePath], {
    cwd: repositoryRoot,
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  await run(process.execPath, [resolve(import.meta.dirname, "build-chaozhou-smartedu-catalog.mjs"), cachePath, selectedPath], {
    cwd: repositoryRoot,
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  const baseline = JSON.parse(await readFile(
    resolve(repositoryRoot, "data/curriculum/chaozhou-smartedu-textbook-catalog.json"),
    "utf8",
  ));
  const current = JSON.parse(await readFile(selectedPath, "utf8"));
  if (!Array.isArray(baseline.textbooks) || !Array.isArray(current.textbooks)) {
    throw new Error("SmartEdu selected catalog comparison input is invalid");
  }
  const baselineByKey = new Map(baseline.textbooks.map((textbook) => [key(textbook), textbook]));
  const currentByKey = new Map(current.textbooks.map((textbook) => [key(textbook), textbook]));
  const newlyAvailable = [];
  const changedResources = [];
  const newlyUnavailable = [];
  for (const [textbookKey, textbook] of currentByKey) {
    const previous = baselineByKey.get(textbookKey);
    if (previous === undefined) throw new Error(`Unexpected textbook key in refreshed catalog: ${textbookKey}`);
    if (previous.availability !== "AVAILABLE" && textbook.availability === "AVAILABLE") {
      newlyAvailable.push(summary(textbook));
    } else if (previous.availability === "AVAILABLE" && textbook.availability !== "AVAILABLE") {
      newlyUnavailable.push(summary(previous));
    } else if (
      textbook.availability === "AVAILABLE"
      && (
        previous.contentId !== textbook.contentId
        || previous.previewAssetId !== textbook.previewAssetId
        || previous.catalogTimestamp !== textbook.catalogTimestamp
      )
    ) {
      changedResources.push({
        key: textbookKey,
        previous: resource(previous),
        current: resource(textbook),
      });
    }
  }
  const pending = current.textbooks.filter((textbook) => textbook.availability === "PENDING_OFFICIAL_RELEASE").map(summary);
  process.stdout.write(JSON.stringify({
    checked: true,
    status: newlyAvailable.length > 0 ? "NEW_RELEASES_FOUND" : "NO_NEW_RELEASES",
    officialSource: current.source?.catalogUrl,
    baselineAvailable: baseline.summary?.availableTextbooks,
    currentAvailable: current.summary?.availableTextbooks,
    currentPending: current.summary?.pendingOfficialRelease,
    newlyAvailable,
    newlyUnavailable,
    changedResources,
    pending,
    repositoryWritten: false,
    databaseWritten: false,
  }));
} finally {
  if (dirname(temporaryRoot) !== resolve(tmpdir())) throw new Error("Unsafe SmartEdu temporary cleanup target");
  await rm(temporaryRoot, { recursive: true, force: true });
}

function key(textbook) {
  return `${textbook.subjectCode}:${String(textbook.grade)}:${textbook.volume}`;
}

function summary(textbook) {
  return {
    subjectCode: textbook.subjectCode,
    grade: textbook.grade,
    volume: textbook.volume,
    availability: textbook.availability,
  };
}

function resource(textbook) {
  return {
    contentId: textbook.contentId,
    previewAssetId: textbook.previewAssetId,
    catalogTimestamp: textbook.catalogTimestamp,
  };
}
