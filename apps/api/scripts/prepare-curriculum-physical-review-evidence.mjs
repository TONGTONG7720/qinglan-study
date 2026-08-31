import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);

if (process.argv[2] === "--self-test") {
  const samples = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x03]),
  ].map(describeBuffer);
  if (new Set(samples.map((sample) => sample.sha256)).size !== samples.length) {
    throw new Error("Physical review evidence self-test hashes are not unique");
  }
  process.stdout.write(JSON.stringify({ selfTest: true, samples, pathsIncluded: false, databaseWritten: false }));
  process.exit(0);
}

const textbookEditionId = process.argv[2];
const coverPath = process.argv[3];
const copyrightPath = process.argv[4];
const directoryPaths = process.argv.slice(5);
if (
  textbookEditionId === undefined
  || !/^[0-9a-f-]{36}$/iu.test(textbookEditionId)
  || coverPath === undefined
  || copyrightPath === undefined
  || directoryPaths.length === 0
  || directoryPaths.length > 30
) {
  throw new Error("Pass textbook UUID, cover image, copyright-page image, and one to thirty directory images");
}
if (process.env.DATABASE_URL === undefined) throw new Error("DATABASE_URL is required");

const [cover, copyrightPage, ...directoryImages] = await Promise.all([
  inspectImage(coverPath),
  inspectImage(copyrightPath),
  ...directoryPaths.map(inspectImage),
]);
const hashes = [cover.sha256, copyrightPage.sha256, ...directoryImages.map((image) => image.sha256)];
if (new Set(hashes).size !== hashes.length) {
  throw new Error("Cover, copyright-page, and directory evidence images must be distinct files");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(
    `SELECT textbook."id", textbook."subjectCode"::text AS "subjectCode", textbook."grade",
       textbook."publisher", textbook."editionName", textbook."volume", textbook."status"::text AS "status",
       COUNT(context."id")::int AS "studentContextCount"
     FROM "TextbookEdition" textbook
     LEFT JOIN "StudentTextbookContext" context ON context."textbookEditionId" = textbook."id"
     WHERE textbook."id" = $1
     GROUP BY textbook."id"`,
    [textbookEditionId],
  );
  const textbook = result.rows[0];
  if (result.rowCount !== 1 || !new Set(["DRAFT", "CONFIRMED"]).has(textbook.status)) {
    throw new Error("Physical review evidence preparation requires a DRAFT or CONFIRMED textbook");
  }
  process.stdout.write(JSON.stringify({
    prepared: true,
    textbook: {
      textbookEditionId: textbook.id,
      subjectCode: textbook.subjectCode,
      grade: textbook.grade,
      publisher: textbook.publisher,
      editionName: textbook.editionName,
      volume: textbook.volume,
      status: textbook.status,
    },
    evidence: {
      coverImage: cover,
      copyrightPageImage: copyrightPage,
      directoryImages,
    },
    pathsIncluded: false,
    imageBytesIncluded: false,
    databaseWritten: false,
    textbookStatusChanged: false,
  }));
} finally {
  await client.end();
}

async function inspectImage(pathArgument) {
  const path = resolve(pathArgument);
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > 10_000_000) {
    throw new Error("Physical review evidence must be a non-empty image no larger than 10 MB");
  }
  return describeBuffer(await readFile(path));
}

function describeBuffer(buffer) {
  const mimeType = detectMimeType(buffer);
  if (mimeType === null) throw new Error("Physical review evidence must be JPEG, PNG, or WebP");
  return {
    sha256: createHash("sha256").update(buffer).digest("hex"),
    mimeType,
    sizeBytes: buffer.length,
  };
}

function detectMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  return null;
}
