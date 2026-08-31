import { existsSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { readCurriculumDrafts } from "./curriculum-draft-manifest.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const rootEnvironmentPath = resolve(repositoryRoot, ".env");
if (existsSync(rootEnvironmentPath)) {
  process.loadEnvFile(rootEnvironmentPath);
}

const textbookId = process.argv[2];
const manifestPath = process.argv[3];
if (textbookId === undefined || !/^[0-9a-f-]{36}$/iu.test(textbookId)) {
  throw new Error("Pass the imported textbook UUID");
}
if (process.env.DATABASE_URL === undefined) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const textbookResult = await client.query(
    `SELECT
       t."subjectCode",
       t."grade",
       t."publisher",
       t."editionName",
       t."volume",
       t."status",
       t."sourceReference",
       t."verifiedAt",
       COUNT(DISTINCT u."id")::int AS "unitCount",
       COUNT(k."id")::int AS "knowledgeNodeCount"
     FROM "TextbookEdition" t
     LEFT JOIN "Unit" u ON u."textbookEditionId" = t."id"
     LEFT JOIN "KnowledgeNode" k ON k."unitId" = u."id"
     WHERE t."id" = $1
     GROUP BY t."id"`,
    [textbookId],
  );
  if (textbookResult.rowCount !== 1) {
    throw new Error("Imported textbook was not found");
  }
  const contextResult = await client.query(
    `SELECT COUNT(*)::int AS "studentContextCount"
     FROM "StudentTextbookContext"
     WHERE "textbookEditionId" = $1`,
    [textbookId],
  );
  const textbook = textbookResult.rows[0];
  let manifestMatchesDatabase = null;
  if (manifestPath !== undefined) {
    const { drafts } = await readCurriculumDrafts(manifestPath);
    if (drafts.length !== 1) {
      throw new Error("Import verification currently requires a one-textbook manifest");
    }
    const draft = drafts[0];
    const contentResult = await client.query(
      `SELECT
         u."ordinal",
         u."title" AS "unitTitle",
         k."title" AS "knowledgeNodeTitle",
         k."objective",
         k."prerequisiteKnowledge",
         k."commonErrors",
         k."abilityLevels",
         k."questionTypes",
         k."pageStart",
         k."pageEnd",
         k."contentVersion"
       FROM "Unit" u
       JOIN "KnowledgeNode" k ON k."unitId" = u."id"
       WHERE u."textbookEditionId" = $1
       ORDER BY u."ordinal", k."title", k."objective"`,
      [textbookId],
    );
    const expectedContent = draft.units.flatMap((unit) => unit.knowledgeNodes.map((node) => ({
      ordinal: unit.ordinal,
      unitTitle: unit.title,
      knowledgeNodeTitle: node.title,
      objective: node.objective,
      prerequisiteKnowledge: node.prerequisiteKnowledge,
      commonErrors: node.commonErrors,
      abilityLevels: node.abilityLevels,
      questionTypes: node.questionTypes,
      pageStart: node.pageStart,
      pageEnd: node.pageEnd,
      contentVersion: node.contentVersion,
    }))).sort(compareContentRows);
    const actualContent = contentResult.rows.map((row) => ({
      ordinal: row.ordinal,
      unitTitle: row.unitTitle,
      knowledgeNodeTitle: row.knowledgeNodeTitle,
      objective: row.objective,
      prerequisiteKnowledge: row.prerequisiteKnowledge,
      commonErrors: row.commonErrors,
      abilityLevels: parseEnumArray(row.abilityLevels),
      questionTypes: parseEnumArray(row.questionTypes),
      pageStart: row.pageStart,
      pageEnd: row.pageEnd,
      contentVersion: row.contentVersion,
    })).sort(compareContentRows);
    const identityMatches = (
      textbook.subjectCode === draft.subjectCode
      && textbook.grade === draft.grade
      && textbook.publisher === draft.publisher
      && textbook.editionName === draft.editionName
      && textbook.volume === draft.volume
    );
    const mismatchIndex = expectedContent.findIndex((expected, index) => (
      JSON.stringify(expected) !== JSON.stringify(actualContent[index])
    ));
    manifestMatchesDatabase = identityMatches
      && expectedContent.length === actualContent.length
      && mismatchIndex === -1;
    if (!manifestMatchesDatabase) {
      const mismatch = mismatchIndex === -1 ? null : {
        expected: expectedContent[mismatchIndex],
        actual: actualContent[mismatchIndex],
      };
      throw new Error(`Imported textbook content does not match the strict draft manifest: ${JSON.stringify({ identityMatches, expectedRows: expectedContent.length, actualRows: actualContent.length, mismatch })}`);
    }
  }
  if (
    textbook.status !== "DRAFT"
    || textbook.sourceReference !== null
    || textbook.verifiedAt !== null
    || contextResult.rows[0].studentContextCount !== 0
  ) {
    throw new Error("Imported textbook crossed a confirmation or student-alignment gate");
  }
  process.stdout.write(JSON.stringify({
    verified: true,
    textbookId,
    ...textbook,
    studentContextCount: contextResult.rows[0].studentContextCount,
    manifestMatchesDatabase,
  }));
} finally {
  await client.end();
}

function compareContentRows(left, right) {
  return left.ordinal - right.ordinal
    || left.unitTitle.localeCompare(right.unitTitle, "zh-CN")
    || left.knowledgeNodeTitle.localeCompare(right.knowledgeNodeTitle, "zh-CN")
    || left.objective.localeCompare(right.objective, "zh-CN");
}

function parseEnumArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.startsWith("{") || !value.endsWith("}")) {
    throw new Error("Unexpected PostgreSQL enum-array representation");
  }
  const inner = value.slice(1, -1);
  return inner.length === 0 ? [] : inner.split(",");
}
