import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");

const progress = JSON.parse(await readFile(
  resolve(repositoryRoot, "data/curriculum/chaozhou-36-volume-progress.json"),
  "utf8",
));
const catalog = JSON.parse(await readFile(
  resolve(repositoryRoot, "data/curriculum/chaozhou-smartedu-textbook-catalog.json"),
  "utf8",
));
const legacyDrafts = JSON.parse(await readFile(
  resolve(repositoryRoot, "data/curriculum/legacy-grade9-current-use-candidates.DRAFT.json"),
  "utf8",
));
if (!Array.isArray(catalog.textbooks)) throw new Error("Chaozhou SmartEdu catalog is invalid");
if (!Array.isArray(legacyDrafts) || legacyDrafts.length !== 5) throw new Error("Legacy grade-9 bridge manifest is invalid");
const availableKeys = new Set(catalog.textbooks
  .filter((textbook) => textbook.availability === "AVAILABLE")
  .map(textbookKey));
const pendingKeys = new Set(catalog.textbooks
  .filter((textbook) => textbook.availability === "PENDING_OFFICIAL_RELEASE")
  .map(textbookKey));
const legacyIdentityKeys = new Set(legacyDrafts.map(identityKey));
const legacyCoverageKeys = new Set(legacyDrafts.map((textbook) => (
  textbook.subjectCode === "ENGLISH" && textbook.volume === "全一册"
    ? "ENGLISH:9:下册"
    : textbookKey(textbook)
)));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(
    `SELECT textbook."id", textbook."subjectCode"::text AS "subjectCode", textbook."grade", textbook."volume"
     FROM "TextbookEdition" textbook
     WHERE textbook."status" = 'CONFIRMED'
       AND textbook."editionName" LIKE '义务教育教科书（根据2022年版课程标准修订）%'
     ORDER BY textbook."subjectCode", textbook."grade", textbook."volume"`,
  );
  const confirmedRevisedKeys = new Set(result.rows.map(textbookKey));
  const counts = {};
  for (const row of result.rows) counts[row.subjectCode] = (counts[row.subjectCode] ?? 0) + 1;
  const contexts = await client.query(
    `SELECT COUNT(*)::int AS "count"
     FROM "StudentTextbookContext" context
     JOIN "TextbookEdition" textbook ON textbook."id" = context."textbookEditionId"
     WHERE textbook."status" = 'CONFIRMED'
       AND (
         textbook."editionName" LIKE '义务教育教科书（根据2022年版课程标准修订）%'
         OR textbook."editionName" = ANY($1::text[])
       )`,
    [legacyDrafts.map((draft) => draft.editionName)],
  );
  const legacyResult = await client.query(
    `SELECT textbook."id", textbook."subjectCode"::text AS "subjectCode", textbook."grade",
       textbook."publisher", textbook."editionName", textbook."volume", textbook."status"::text AS "status",
       textbook."sourceReference", textbook."verifiedAt"
     FROM "TextbookEdition" textbook
     WHERE textbook."status" = 'CONFIRMED'
       AND textbook."editionName" = ANY($1::text[])
     ORDER BY textbook."subjectCode", textbook."volume"`,
    [legacyDrafts.map((draft) => draft.editionName)],
  );
  const legacyDatabaseKeys = new Set(legacyResult.rows.map(identityKey));
  const metadata = await client.query(
    `SELECT COUNT(*)::int AS "total",
       COUNT(*) FILTER (
         WHERE node."pageStart" IS NULL
           OR node."pageEnd" IS NULL
           OR node."contentVersion" IS NULL
           OR jsonb_array_length(node."prerequisiteKnowledge") = 0
           OR jsonb_array_length(node."commonErrors") = 0
           OR cardinality(node."abilityLevels") = 0
           OR cardinality(node."questionTypes") = 0
       )::int AS "incomplete"
     FROM "KnowledgeNode" node
     JOIN "Unit" unit ON unit."id" = node."unitId"
     JOIN "TextbookEdition" textbook ON textbook."id" = unit."textbookEditionId"
     WHERE textbook."status" = 'CONFIRMED'
       AND textbook."editionName" LIKE '义务教育教科书（根据2022年版课程标准修订）%'`,
  );
  const allTargetMetadata = await client.query(
    `SELECT COUNT(*)::int AS "total",
       COUNT(*) FILTER (
         WHERE node."pageStart" IS NULL
           OR node."pageEnd" IS NULL
           OR node."contentVersion" IS NULL
           OR jsonb_array_length(node."prerequisiteKnowledge") = 0
           OR jsonb_array_length(node."commonErrors") = 0
           OR cardinality(node."abilityLevels") = 0
           OR cardinality(node."questionTypes") = 0
       )::int AS "incomplete"
     FROM "KnowledgeNode" node
     JOIN "Unit" unit ON unit."id" = node."unitId"
     JOIN "TextbookEdition" textbook ON textbook."id" = unit."textbookEditionId"
     WHERE textbook."status" = 'CONFIRMED'
       AND (
         textbook."editionName" LIKE '义务教育教科书（根据2022年版课程标准修订）%'
         OR textbook."editionName" = ANY($1::text[])
       )`,
    [legacyDrafts.map((draft) => draft.editionName)],
  );
  const total = result.rows.length;
  if (
    catalog.summary?.expectedTextbooks !== 36
    || catalog.summary?.availableTextbooks !== 31
    || catalog.summary?.pendingOfficialRelease !== 5
    || availableKeys.size !== 31
    || pendingKeys.size !== 5
    || total !== progress.summary.databaseConfirmed2022
    || total !== availableKeys.size
    || !sameSet(confirmedRevisedKeys, availableKeys)
    || [...pendingKeys].some((key) => confirmedRevisedKeys.has(key))
    || counts.CHINESE !== 5
    || counts.MORALITY !== 5
    || counts.HISTORY !== 5
    || counts.MATH !== 5
    || counts.ENGLISH !== 5
    || counts.PHYSICS !== 4
    || counts.CHEMISTRY !== 2
    || contexts.rows[0].count !== progress.summary.studentContextsOnConfirmedTargets
    || metadata.rows[0].total !== progress.summary.knowledgeNodes
    || metadata.rows[0].incomplete !== 0
    || legacyIdentityKeys.size !== 5
    || legacyResult.rowCount !== 5
    || !sameSet(legacyIdentityKeys, legacyDatabaseKeys)
    || legacyResult.rows.some((textbook) => textbook.sourceReference === null || textbook.verifiedAt === null)
    || ![...pendingKeys].every((key) => legacyCoverageKeys.has(key))
    || allTargetMetadata.rows[0].total !== progress.summary.knowledgeNodesIncludingLegacy
    || allTargetMetadata.rows[0].incomplete !== 0
  ) {
    throw new Error("Chaozhou curriculum progress does not match the official catalog and PostgreSQL");
  }
  process.stdout.write(JSON.stringify({
    verified: true,
    expectedTextbooks: catalog.summary.expectedTextbooks,
    officialAvailable: availableKeys.size,
    pendingOfficialRelease: pendingKeys.size,
    databaseConfirmed2022: total,
    bySubject: counts,
    studentContextsOnConfirmedTargets: contexts.rows[0].count,
    knowledgeNodes: metadata.rows[0].total,
    incompleteKnowledgeMetadata: metadata.rows[0].incomplete,
    legacyBridgeConfirmed: legacyResult.rowCount,
    legacyBridgeKnowledgeNodes: progress.summary.legacyBridgeKnowledgeNodes,
    databaseConfirmedRecordsIncludingLegacy: total + legacyResult.rowCount,
    knowledgeNodesIncludingLegacy: allTargetMetadata.rows[0].total,
    incompleteKnowledgeMetadataIncludingLegacy: allTargetMetadata.rows[0].incomplete,
    officialAvailableKeysMatchDatabaseConfirmedEditions: true,
    pendingOfficialVolumesAbsentFromDatabase: true,
    pendingOfficialVolumesHaveExplicitLegacyBridgeCandidates: true,
    englishLegacyVolume: legacyDrafts.find((draft) => draft.subjectCode === "ENGLISH")?.volume,
    unifiedFirstBatch: progress.unifiedFirstBatch,
    mathEnglishSecondBatch: progress.mathEnglishSecondBatch,
    physicsChemistryThirdBatch: progress.physicsChemistryThirdBatch,
  }));
} finally {
  await client.end();
}

function textbookKey(textbook) {
  return `${textbook.subjectCode}:${String(textbook.grade)}:${textbook.volume}`;
}

function identityKey(textbook) {
  return `${textbook.subjectCode}:${String(textbook.grade)}:${textbook.publisher}:${textbook.editionName}:${textbook.volume}`;
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
