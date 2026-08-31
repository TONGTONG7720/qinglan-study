import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { TextbookSummarySchema } from "@study/contracts";
import pg from "pg";

const authorization = "CONFIRM_ALL_36_USING_OFFICIAL_ONLINE_SOURCES";
if (process.env.CURRICULUM_CONFIRMATION_AUTHORIZATION !== authorization) {
  throw new Error(`Set CURRICULUM_CONFIRMATION_AUTHORIZATION=${authorization}`);
}
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
const baseUrl = (process.env.CURRICULUM_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/u, "");
const loginId = process.env.CURRICULUM_ADMIN_LOGIN_ID;
const password = process.env.CURRICULUM_ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;
if (loginId === undefined || password === undefined || password.length < 12 || databaseUrl === undefined) {
  throw new Error("CURRICULUM_ADMIN_LOGIN_ID, a 12+ character CURRICULUM_ADMIN_PASSWORD, and DATABASE_URL are required");
}
const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" && !(parsedBaseUrl.protocol === "http:" && new Set(["127.0.0.1", "localhost"]).has(parsedBaseUrl.hostname))) {
  throw new Error("CURRICULUM_API_BASE_URL must use HTTPS unless it targets loopback");
}

const catalog = JSON.parse(await readFile(
  resolve(repositoryRoot, "data/curriculum/chaozhou-smartedu-textbook-catalog.json"),
  "utf8",
));
const bridge = JSON.parse(await readFile(
  resolve(repositoryRoot, "data/curriculum/chaozhou-grade9-legacy-bridge.json"),
  "utf8",
));
if (!Array.isArray(catalog.textbooks) || !Array.isArray(bridge.textbooks)) throw new Error("Curriculum source artifacts are invalid");
const revised = catalog.textbooks.filter((textbook) => textbook.availability === "AVAILABLE");
if (revised.length !== 31 || bridge.textbooks.length !== 5) throw new Error("Online confirmation requires exactly 31 revised and 5 legacy targets");

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
let targets;
try {
  targets = [];
  for (const textbook of revised) {
    const editionName = revisedEditionName(textbook.version);
    const result = await client.query(
      `SELECT "id", "status"::text AS "status", "sourceReference", "verifiedAt"
       FROM "TextbookEdition"
       WHERE "subjectCode" = $1::"SubjectCode" AND "grade" = $2 AND "volume" = $3 AND "editionName" = $4`,
      [textbook.subjectCode, textbook.grade, textbook.volume, editionName],
    );
    if (result.rowCount !== 1) throw new Error(`Expected one revised textbook target: ${textbook.subjectCode} G${String(textbook.grade)} ${textbook.volume}`);
    targets.push({
      id: result.rows[0].id,
      subjectCode: textbook.subjectCode,
      grade: textbook.grade,
      volume: textbook.volume,
      editionName,
      status: result.rows[0].status,
      sourceReference: revisedSourceReference(textbook),
      evidenceKind: "SMARTEDU_2022_REVISION",
    });
  }
  for (const textbook of bridge.textbooks) {
    const result = await client.query(
      `SELECT "id", "subjectCode"::text AS "subjectCode", "grade", "volume", "editionName", "status"::text AS "status"
       FROM "TextbookEdition" WHERE "id" = $1`,
      [textbook.textbookEditionId],
    );
    const stored = result.rows[0];
    if (
      result.rowCount !== 1
      || stored.subjectCode !== textbook.subjectCode
      || stored.grade !== textbook.grade
      || stored.volume !== textbook.volume
    ) throw new Error(`Legacy bridge identity mismatch: ${textbook.subjectCode}`);
    targets.push({
      id: stored.id,
      subjectCode: stored.subjectCode,
      grade: stored.grade,
      volume: stored.volume,
      editionName: stored.editionName,
      status: stored.status,
      sourceReference: legacySourceReference(textbook),
      evidenceKind: "SMARTEDU_LEGACY_APPROVED_EDITION",
    });
  }
} finally {
  await client.end();
}
if (targets.length !== 36 || new Set(targets.map((target) => target.id)).size !== 36) {
  throw new Error("Online confirmation target set must contain 36 unique textbooks");
}
if (targets.some((target) => target.status !== "DRAFT")) {
  throw new Error("First online confirmation run requires every target to remain DRAFT");
}

const loginResponse = await fetch(`${baseUrl}/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ loginId, password }),
});
if (!loginResponse.ok) throw new Error(`Curriculum admin login failed with HTTP ${String(loginResponse.status)}`);
const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
if (cookie === undefined) throw new Error("Curriculum admin login did not return a session cookie");
const proofResponse = await fetch(`${baseUrl}/v1/auth/reauthenticate`, {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});
if (!proofResponse.ok) throw new Error(`Curriculum admin reauthentication failed with HTTP ${String(proofResponse.status)}`);
const proofBody = await proofResponse.json();
if (typeof proofBody !== "object" || proofBody === null || !("proof" in proofBody) || typeof proofBody.proof !== "string") {
  throw new Error("Curriculum admin reauthentication proof is invalid");
}

const confirmed = [];
try {
  for (const target of targets) {
    const operation = createHash("sha256").update(`online-confirm:${target.id}:${target.sourceReference}`, "utf8").digest("hex");
    const response = await fetch(`${baseUrl}/v1/curriculum/textbooks/${target.id}/confirm`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "idempotency-key": `curriculum-online:${operation.slice(0, 40)}`,
        "x-reauth-proof": proofBody.proof,
      },
      body: JSON.stringify({
        sourceReference: target.sourceReference,
        confirmation: "CONFIRM_TEXTBOOK",
      }),
    });
    if (!response.ok) throw new Error(`Online textbook confirmation failed for ${target.id} with HTTP ${String(response.status)}`);
    const summary = TextbookSummarySchema.parse(await response.json());
    if (summary.status !== "CONFIRMED") throw new Error(`Textbook ${summary.id} did not become CONFIRMED`);
    confirmed.push({ ...target, status: summary.status });
  }
} finally {
  await fetch(`${baseUrl}/v1/auth/logout`, { method: "POST", headers: { Cookie: cookie } }).catch(() => undefined);
}

const verificationClient = new pg.Client({ connectionString: databaseUrl });
await verificationClient.connect();
let verification;
try {
  const ids = confirmed.map((target) => target.id);
  const textbooks = await verificationClient.query(
    `SELECT COUNT(*)::int AS "total",
       COUNT(*) FILTER (WHERE "status" = 'CONFIRMED' AND "verifiedAt" IS NOT NULL AND "sourceReference" IS NOT NULL)::int AS "confirmed"
     FROM "TextbookEdition" WHERE "id" = ANY($1::uuid[])`,
    [ids],
  );
  const units = await verificationClient.query(
    `SELECT COUNT(*)::int AS "total", COUNT(*) FILTER (WHERE "status" = 'CONFIRMED')::int AS "confirmed"
     FROM "Unit" WHERE "textbookEditionId" = ANY($1::uuid[])`,
    [ids],
  );
  const nodes = await verificationClient.query(
    `SELECT COUNT(*)::int AS "total", COUNT(*) FILTER (WHERE node."status" = 'CONFIRMED')::int AS "confirmed"
     FROM "KnowledgeNode" node JOIN "Unit" unit ON unit."id" = node."unitId"
     WHERE unit."textbookEditionId" = ANY($1::uuid[])`,
    [ids],
  );
  const contexts = await verificationClient.query(
    `SELECT COUNT(*)::int AS "count" FROM "StudentTextbookContext" WHERE "textbookEditionId" = ANY($1::uuid[])`,
    [ids],
  );
  const audits = await verificationClient.query(
    `SELECT COUNT(*)::int AS "count" FROM "AuditEvent"
     WHERE "action" = 'CURRICULUM_TEXTBOOK_CONFIRMED' AND "resourceId" = ANY($1::text[])`,
    [ids],
  );
  verification = {
    textbooks: textbooks.rows[0],
    units: units.rows[0],
    knowledgeNodes: nodes.rows[0],
    studentContexts: contexts.rows[0].count,
    confirmationAuditEvents: audits.rows[0].count,
  };
  if (
    verification.textbooks.total !== 36
    || verification.textbooks.confirmed !== 36
    || verification.units.total !== verification.units.confirmed
    || verification.knowledgeNodes.total !== 1118
    || verification.knowledgeNodes.confirmed !== 1118
    || verification.studentContexts !== 0
    || verification.confirmationAuditEvents !== 36
  ) throw new Error("Online curriculum confirmation verification failed");
} finally {
  await verificationClient.end();
}

const reportPath = resolve(repositoryRoot, "data/curriculum/online-admin-confirmation-report.json");
await writeFile(reportPath, `${JSON.stringify({
  schemaVersion: 1,
  confirmedOn: "2026-08-27",
  authorization: "USER_EXPLICITLY_AUTHORIZED_OFFICIAL_ONLINE_SOURCES_AND_DEFAULT_ADMIN",
  policy: "Confirms supported textbook editions; does not bind all editions to one student.",
  targets: confirmed.map((target) => ({
    textbookEditionId: target.id,
    subjectCode: target.subjectCode,
    grade: target.grade,
    volume: target.volume,
    editionName: target.editionName,
    evidenceKind: target.evidenceKind,
    sourceReference: target.sourceReference,
    status: target.status,
  })),
  verification,
}, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({
  confirmed: true,
  textbooks: confirmed.length,
  revised: confirmed.filter((target) => target.evidenceKind === "SMARTEDU_2022_REVISION").length,
  legacyBridges: confirmed.filter((target) => target.evidenceKind === "SMARTEDU_LEGACY_APPROVED_EDITION").length,
  verification,
  reportPath,
  credentialsIncludedInReport: false,
}));

function revisedEditionName(version) {
  return `义务教育教科书（根据2022年版课程标准修订）·${version}`;
}

function revisedSourceReference(textbook) {
  return `国家中小学智慧教育平台官方在线目录与预览核验；详情：${textbook.detailsUrl}；标题：${textbook.title}；资源ID：${textbook.contentId}；用户于2026-08-27明确授权默认管理员线上来源确认。`;
}

function legacySourceReference(textbook) {
  return `国家中小学智慧教育平台官方封面与目录核验；详情：https://s-file-2.ykt.cbern.com.cn/zxx/ndrv2/resources/tch_material/details/${textbook.contentId}.json；封面：${textbook.approvalLabel}；用户于2026-08-27明确授权默认管理员线上来源确认。`;
}
