import { existsSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");

const requiredValidationKinds = [
  "INDEPENDENT_SOLVE",
  "DEDUPLICATION",
  "SEMANTIC_DEDUPLICATION",
  "SUBJECT_FACT_CHECK",
  "HUMAN_SUBJECT_REVIEW",
  "LICENSE_REVIEW",
];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const itemsResult = await client.query(
    `SELECT
       item."id",
       item."stableKey",
       item."subjectCode"::text AS "subjectCode",
       item."status"::text AS "status",
       item."contentHash",
       item."licenseStatus"::text AS "licenseStatus",
       item."semanticEmbeddingModel",
       textbook."status"::text AS "textbookStatus",
       COUNT(link."knowledgeNodeId")::int AS "knowledgeNodeCount",
       COUNT(link."knowledgeNodeId") FILTER (WHERE node."status" = 'CONFIRMED')::int AS "confirmedKnowledgeNodeCount"
     FROM "QuestionBankItem" AS item
     JOIN "TextbookEdition" AS textbook ON textbook."id" = item."textbookEditionId"
     LEFT JOIN "QuestionBankItemKnowledgeNode" AS link ON link."questionBankItemId" = item."id"
     LEFT JOIN "KnowledgeNode" AS node ON node."id" = link."knowledgeNodeId"
     WHERE item."status" NOT IN ('REJECTED', 'RETIRED')
     GROUP BY item."id", textbook."status"
     ORDER BY item."subjectCode", item."stableKey"`,
  );
  const itemIds = itemsResult.rows.map((item) => item.id);
  const [validationsResult, reviewsResult, licensesResult, pendingMatchesResult, releasesResult] = itemIds.length === 0
    ? [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }]
    : await Promise.all([
      client.query(
        `SELECT "id", "questionBankItemId", "kind"::text AS "kind", "status"::text AS "status", "contentHash", "createdAt"
         FROM "QuestionBankValidation"
         WHERE "questionBankItemId" = ANY($1::uuid[])
         ORDER BY "createdAt" DESC, "id" DESC`,
        [itemIds],
      ),
      client.query(
        `SELECT "id", "questionBankItemId", "decision"::text AS "decision", "contentHash", "attestation", "createdAt"
         FROM "QuestionBankReview"
         WHERE "questionBankItemId" = ANY($1::uuid[])
         ORDER BY "createdAt" DESC, "id" DESC`,
        [itemIds],
      ),
      client.query(
        `SELECT "id", "questionBankItemId", "decision"::text AS "decision", "contentHash", "attestation", "createdAt"
         FROM "QuestionBankLicenseReview"
         WHERE "questionBankItemId" = ANY($1::uuid[])
         ORDER BY "createdAt" DESC, "id" DESC`,
        [itemIds],
      ),
      client.query(
        `SELECT match."questionBankItemId", COUNT(*)::int AS "count"
         FROM "QuestionBankSemanticDuplicate" AS match
         JOIN "QuestionBankItem" AS candidate ON candidate."id" = match."candidateItemId"
         WHERE match."questionBankItemId" = ANY($1::uuid[])
           AND match."decision" = 'PENDING'
           AND candidate."status" IN ('DEDUPLICATED', 'FACT_CHECKED', 'REVIEWED', 'PUBLISHED')
         GROUP BY match."questionBankItemId"`,
        [itemIds],
      ),
      client.query(
        `SELECT "questionBankItemId", "status"::text AS "status", "contentHash"
         FROM "QuestionBankRelease"
         WHERE "questionBankItemId" = ANY($1::uuid[])`,
        [itemIds],
      ),
    ]);

  const latestValidations = new Map();
  for (const validation of validationsResult.rows) {
    const key = `${validation.questionBankItemId}:${validation.kind}`;
    if (!latestValidations.has(key)) latestValidations.set(key, validation);
  }
  const latestReviews = latestByItem(reviewsResult.rows);
  const latestLicenses = latestByItem(licensesResult.rows);
  const pendingMatches = new Map(pendingMatchesResult.rows.map((row) => [row.questionBankItemId, row.count]));
  const releases = new Map(releasesResult.rows.map((row) => [row.questionBankItemId, row]));

  const records = itemsResult.rows.map((item) => {
    const missingGates = [];
    for (const kind of requiredValidationKinds) {
      const validation = latestValidations.get(`${item.id}:${kind}`);
      if (validation?.contentHash !== item.contentHash || validation?.status !== "PASSED") missingGates.push(kind);
    }
    if (item.semanticEmbeddingModel === null) missingGates.push("SEMANTIC_EMBEDDING");
    if ((pendingMatches.get(item.id) ?? 0) > 0) missingGates.push("SEMANTIC_HUMAN_ADJUDICATION");
    const license = latestLicenses.get(item.id);
    if (
      !new Set(["AUTHORIZED", "PUBLIC_DOMAIN"]).has(item.licenseStatus)
      || license?.contentHash !== item.contentHash
      || license?.decision !== item.licenseStatus
      || license?.attestation !== "HUMAN_LICENSE_REVIEW_COMPLETED"
    ) missingGates.push("LEGAL_LICENSE_EVIDENCE");
    const review = latestReviews.get(item.id);
    if (
      review?.contentHash !== item.contentHash
      || review?.decision !== "APPROVED"
      || review?.attestation !== "FINAL_ADMIN_CONTENT_REVIEW_COMPLETED"
    ) missingGates.push("FINAL_ADMIN_REVIEW");
    if (item.textbookStatus !== "CONFIRMED") missingGates.push("CONFIRMED_TEXTBOOK");
    if (item.knowledgeNodeCount === 0 || item.confirmedKnowledgeNodeCount !== item.knowledgeNodeCount) missingGates.push("CONFIRMED_KNOWLEDGE_NODES");
    const release = releases.get(item.id);
    if (item.status === "PUBLISHED" && (release?.status !== "ACTIVE" || release?.contentHash !== item.contentHash)) {
      missingGates.push("ACTIVE_RELEASE_RECORD");
    }
    return {
      stableKey: item.stableKey,
      subjectCode: item.subjectCode,
      status: item.status,
      missingGates: [...new Set(missingGates)],
      publishReady: missingGates.length === 0 && item.status === "REVIEWED",
    };
  });
  const missingGateCounts = {};
  for (const record of records) {
    for (const gate of record.missingGates) missingGateCounts[gate] = (missingGateCounts[gate] ?? 0) + 1;
  }
  process.stdout.write(JSON.stringify({
    verified: true,
    itemCount: records.length,
    publishReadyCount: records.filter((record) => record.publishReady).length,
    publishedCount: records.filter((record) => record.status === "PUBLISHED").length,
    missingGateCounts,
    items: records,
    answersIncludedInOutput: false,
    databaseWritten: false,
  }));
} finally {
  await client.end();
}

function latestByItem(rows) {
  const latest = new Map();
  for (const row of rows) {
    if (!latest.has(row.questionBankItemId)) latest.set(row.questionBankItemId, row);
  }
  return latest;
}
