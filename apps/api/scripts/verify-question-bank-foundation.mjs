import { existsSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const migrations = await client.query('SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL');
  const tables = await client.query(`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [["TextbookAsset", "QuestionBankItem", "QuestionBankItemKnowledgeNode", "QuestionBankValidation", "QuestionBankReview"]]);
  const hnsw = await client.query(`SELECT COUNT(*)::int AS count FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ReviewedContent_embedding_hnsw_idx'`);
  const reviewed = await client.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "knowledgeNodeId" IS NULL OR "pageStart" IS NULL OR "pageEnd" IS NULL OR "sourceHash" IS NULL)::int AS invalid FROM "ReviewedContent"');
  const questions = await client.query('SELECT "status"::text, COUNT(*)::int AS count FROM "QuestionBankItem" GROUP BY "status" ORDER BY "status"');
  const assets = await client.query('SELECT COUNT(*)::int AS count FROM "TextbookAsset"');
  if (migrations.rows[0].count !== 12 || tables.rows[0].count !== 5 || hnsw.rows[0].count !== 1 || reviewed.rows[0].invalid !== 0) {
    throw new Error("Question-bank foundation database invariant failed");
  }
  process.stdout.write(JSON.stringify({
    verified: true,
    appliedMigrations: migrations.rows[0].count,
    questionBankTables: tables.rows[0].count,
    reviewedContentRows: reviewed.rows[0].total,
    reviewedContentInvalidRows: reviewed.rows[0].invalid,
    hnswIndexes: hnsw.rows[0].count,
    questionBankStatusCounts: Object.fromEntries(questions.rows.map((row) => [row.status, row.count])),
    textbookAssets: assets.rows[0].count,
  }));
} finally {
  await client.end();
}
