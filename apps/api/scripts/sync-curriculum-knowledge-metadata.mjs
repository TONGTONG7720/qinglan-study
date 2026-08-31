import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { readCurriculumDrafts } from "./curriculum-draft-manifest.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);

const textbookId = process.argv[2];
const manifestPath = process.argv[3];
if (textbookId === undefined || !/^[0-9a-f-]{36}$/iu.test(textbookId) || manifestPath === undefined) {
  throw new Error("Pass the DRAFT textbook UUID and strict curriculum manifest path");
}
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");

const { drafts } = await readCurriculumDrafts(manifestPath);
if (drafts.length !== 1) throw new Error("Knowledge metadata sync requires a one-textbook manifest");
const draft = drafts[0];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const gateResult = await client.query(
    `SELECT
       t."status",
       COUNT(DISTINCT context."id")::int AS "studentContextCount",
       MIN(audit."actorUserId"::text) AS "actorUserId"
     FROM "TextbookEdition" t
     LEFT JOIN "StudentTextbookContext" context ON context."textbookEditionId" = t."id"
     LEFT JOIN "AuditEvent" audit
       ON audit."resourceType" = 'TextbookEdition'
      AND audit."resourceId" = t."id"::text
      AND audit."action" = 'CURRICULUM_TEXTBOOK_DRAFT_CREATED'
     WHERE t."id" = $1
       AND t."subjectCode" = $2::"SubjectCode"
       AND t."grade" = $3
       AND t."publisher" = $4
       AND t."editionName" = $5
       AND t."volume" = $6
     GROUP BY t."id"`,
    [textbookId, draft.subjectCode, draft.grade, draft.publisher, draft.editionName, draft.volume],
  );
  const gate = gateResult.rows[0];
  if (gateResult.rowCount !== 1 || gate.status !== "DRAFT" || gate.studentContextCount !== 0 || gate.actorUserId === null) {
    throw new Error("Knowledge metadata sync is restricted to an unaligned DRAFT textbook");
  }

  let updatedNodes = 0;
  for (const unit of draft.units) {
    for (const node of unit.knowledgeNodes) {
      const result = await client.query(
        `UPDATE "KnowledgeNode" node
         SET
           "prerequisiteKnowledge" = $5::jsonb,
           "commonErrors" = $6::jsonb,
           "abilityLevels" = $7::"KnowledgeAbilityLevel"[],
           "questionTypes" = $8::"QuestionBankType"[],
           "pageStart" = $9,
           "pageEnd" = $10,
           "contentVersion" = $11,
           "updatedAt" = now()
         FROM "Unit" unit
         WHERE node."unitId" = unit."id"
           AND unit."textbookEditionId" = $1
           AND unit."ordinal" = $2
           AND unit."title" = $3
           AND node."title" = $4
           AND node."status" = 'DRAFT'`,
        [
          textbookId,
          unit.ordinal,
          unit.title,
          node.title,
          JSON.stringify(node.prerequisiteKnowledge),
          JSON.stringify(node.commonErrors),
          node.abilityLevels,
          node.questionTypes,
          node.pageStart,
          node.pageEnd,
          node.contentVersion,
        ],
      );
      if (result.rowCount !== 1) throw new Error(`Expected one DRAFT knowledge node: ${unit.title} / ${node.title}`);
      updatedNodes += 1;
    }
  }
  await client.query(
    `INSERT INTO "AuditEvent"
       ("id", "actorUserId", "action", "resourceType", "resourceId", "metadata", "createdAt")
     VALUES ($1, $2, 'CURRICULUM_KNOWLEDGE_METADATA_SYNCED', 'TextbookEdition', $3, $4::jsonb, now())`,
    [randomUUID(), gate.actorUserId, textbookId, JSON.stringify({ updatedNodes, manifestPath })],
  );
  await client.query("COMMIT");
  process.stdout.write(JSON.stringify({ synced: true, textbookId, updatedNodes }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
