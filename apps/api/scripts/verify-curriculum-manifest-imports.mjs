import { existsSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { curriculumDraftSummary, readCurriculumDrafts } from "./curriculum-draft-manifest.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");
const { manifestPath, drafts } = await readCurriculumDrafts(process.argv[2]);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const textbookIds = [];
try {
  for (const draft of drafts) {
    const textbookResult = await client.query(
      `SELECT "id", "status", "sourceReference", "verifiedAt"
       FROM "TextbookEdition"
       WHERE "subjectCode" = $1::"SubjectCode" AND "grade" = $2 AND "publisher" = $3 AND "editionName" = $4 AND "volume" = $5`,
      [draft.subjectCode, draft.grade, draft.publisher, draft.editionName, draft.volume],
    );
    if (textbookResult.rowCount !== 1) throw new Error(`Expected one imported textbook: ${draft.subjectCode} G${String(draft.grade)} ${draft.volume}`);
    const textbook = textbookResult.rows[0];
    if (textbook.status !== "DRAFT" || textbook.sourceReference !== null || textbook.verifiedAt !== null) throw new Error("Imported batch textbook crossed the confirmation gate");
    const contentResult = await client.query(
      `SELECT unit."ordinal", unit."title" AS "unitTitle", node."title" AS "nodeTitle", node."objective",
         node."prerequisiteKnowledge", node."commonErrors", node."abilityLevels", node."questionTypes",
         node."pageStart", node."pageEnd", node."contentVersion"
       FROM "Unit" unit
       JOIN "KnowledgeNode" node ON node."unitId" = unit."id"
       WHERE unit."textbookEditionId" = $1
       ORDER BY unit."ordinal", node."title"`,
      [textbook.id],
    );
    const expected = draft.units.flatMap((unit) => unit.knowledgeNodes.map((node) => ({
      ordinal: unit.ordinal,
      unitTitle: unit.title,
      nodeTitle: node.title,
      objective: node.objective,
      prerequisiteKnowledge: node.prerequisiteKnowledge,
      commonErrors: node.commonErrors,
      abilityLevels: node.abilityLevels,
      questionTypes: node.questionTypes,
      pageStart: node.pageStart,
      pageEnd: node.pageEnd,
      contentVersion: node.contentVersion,
    }))).sort(compareRows);
    const actual = contentResult.rows.map((row) => ({
      ordinal: row.ordinal,
      unitTitle: row.unitTitle,
      nodeTitle: row.nodeTitle,
      objective: row.objective,
      prerequisiteKnowledge: row.prerequisiteKnowledge,
      commonErrors: row.commonErrors,
      abilityLevels: parseEnumArray(row.abilityLevels),
      questionTypes: parseEnumArray(row.questionTypes),
      pageStart: row.pageStart,
      pageEnd: row.pageEnd,
      contentVersion: row.contentVersion,
    })).sort(compareRows);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Imported content mismatch: ${draft.subjectCode} G${String(draft.grade)} ${draft.volume}`);
    const contexts = await client.query('SELECT COUNT(*)::int AS count FROM "StudentTextbookContext" WHERE "textbookEditionId" = $1', [textbook.id]);
    if (contexts.rows[0].count !== 0) throw new Error("Imported batch textbook has an unexpected student context");
    textbookIds.push(textbook.id);
  }
  process.stdout.write(JSON.stringify({ verified: true, manifestPath, ...curriculumDraftSummary(drafts), textbookIds }));
} finally {
  await client.end();
}

function compareRows(left, right) {
  return left.ordinal - right.ordinal || left.unitTitle.localeCompare(right.unitTitle, "zh-CN") || left.nodeTitle.localeCompare(right.nodeTitle, "zh-CN");
}

function parseEnumArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.startsWith("{") || !value.endsWith("}")) throw new Error("Unexpected PostgreSQL enum-array representation");
  const inner = value.slice(1, -1);
  return inner.length === 0 ? [] : inner.split(",");
}
