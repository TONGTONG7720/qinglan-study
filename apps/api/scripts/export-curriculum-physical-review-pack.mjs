import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");
const legacyDrafts = JSON.parse(await readFile(
  resolve(repositoryRoot, "data/curriculum/legacy-grade9-current-use-candidates.DRAFT.json"),
  "utf8",
));
if (!Array.isArray(legacyDrafts) || legacyDrafts.length !== 5) throw new Error("Legacy grade-9 bridge manifest is invalid");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(
    `SELECT textbook."id" AS "textbookEditionId",
       textbook."subjectCode"::text AS "subjectCode",
       textbook."grade",
       textbook."publisher",
       textbook."editionName",
       textbook."volume",
       textbook."status"::text AS "status",
       (SELECT COUNT(*)::int FROM "Unit" unit WHERE unit."textbookEditionId" = textbook."id") AS "unitCount",
       (SELECT COUNT(*)::int FROM "KnowledgeNode" node
         JOIN "Unit" unit ON unit."id" = node."unitId"
         WHERE unit."textbookEditionId" = textbook."id") AS "knowledgeNodeCount",
       COALESCE((SELECT json_agg(json_build_object('ordinal', unit."ordinal", 'title', unit."title") ORDER BY unit."ordinal")
         FROM "Unit" unit WHERE unit."textbookEditionId" = textbook."id"), '[]'::json) AS "directory"
     FROM "TextbookEdition" textbook
     WHERE textbook."status" IN ('DRAFT', 'CONFIRMED')
       AND (
         textbook."editionName" LIKE '义务教育教科书（根据2022年版课程标准修订）%'
         OR textbook."editionName" = ANY($1::text[])
       )
     ORDER BY textbook."subjectCode", textbook."grade", textbook."volume"`,
    [legacyDrafts.map((draft) => draft.editionName)],
  );
  const outputDirectory = resolve(repositoryRoot, "data/curriculum/review");
  const outputPath = resolve(outputDirectory, "physical-copy-review-input.jsonl");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${result.rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  const bySubject = {};
  for (const row of result.rows) bySubject[row.subjectCode] = (bySubject[row.subjectCode] ?? 0) + 1;
  process.stdout.write(JSON.stringify({
    exported: true,
    textbooks: result.rows.length,
    bySubject,
    statuses: [...new Set(result.rows.map((row) => row.status))],
    imageBytesIncluded: false,
    studentDataIncluded: false,
    outputPath,
  }));
} finally {
  await client.end();
}
