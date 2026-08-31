import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { StudentTextbookContextResponseSchema } from "@study/contracts";
import pg from "pg";

const authorization = "ALIGN_LOCAL_PREVIEW_STUDENT_TO_CONFIRMED_CURRICULUM";
if (process.env.CURRICULUM_ALIGNMENT_AUTHORIZATION !== authorization) {
  throw new Error(`Set CURRICULUM_ALIGNMENT_AUTHORIZATION=${authorization}`);
}
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environmentPath = resolve(repositoryRoot, ".env");
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
const baseUrl = (process.env.CURRICULUM_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/u, "");
const databaseUrl = process.env.DATABASE_URL;
const credentials = {
  admin: credentialsFor("ADMIN"),
  owner: credentialsFor("OWNER"),
  student: credentialsFor("STUDENT"),
};
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== "https:" && !(parsedBaseUrl.protocol === "http:" && new Set(["127.0.0.1", "localhost"]).has(parsedBaseUrl.hostname))) {
  throw new Error("CURRICULUM_API_BASE_URL must use HTTPS unless it targets loopback");
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
let student;
let targets;
try {
  const studentResult = await client.query(
    `SELECT user_record."id", user_record."loginId", profile."grade", profile."familyId", family."name" AS "familyName"
     FROM "User" user_record
     JOIN "StudentProfile" profile ON profile."userId" = user_record."id"
     JOIN "Family" family ON family."id" = profile."familyId"
     WHERE user_record."loginId" = 'local-preview-student' AND profile."status" = 'ACTIVE'`,
  );
  student = studentResult.rows[0];
  if (studentResult.rowCount !== 1 || student.grade !== 7 || !student.familyName.startsWith("本地预览家庭")) {
    throw new Error("Curriculum alignment is restricted to the grade-7 local preview student");
  }
  const targetResult = await client.query(
    `SELECT textbook."id", textbook."subjectCode"::text AS "subjectCode", textbook."grade",
       textbook."publisher", textbook."editionName", textbook."volume", textbook."status"::text AS "status"
     FROM "TextbookEdition" textbook
     WHERE textbook."grade" = 7 AND textbook."volume" = '上册' AND textbook."status" = 'CONFIRMED'
       AND textbook."editionName" LIKE '义务教育教科书（根据2022年版课程标准修订）%'
       AND textbook."subjectCode" IN ('CHINESE', 'MATH', 'ENGLISH', 'MORALITY', 'HISTORY')
     ORDER BY textbook."subjectCode"`,
  );
  if (targetResult.rowCount !== 5 || new Set(targetResult.rows.map((row) => row.subjectCode)).size !== 5) {
    throw new Error("Expected five unique confirmed grade-7 upper textbook targets");
  }
  targets = [];
  for (const textbook of targetResult.rows) {
    const units = await client.query(
      `SELECT "id", "ordinal", "title" FROM "Unit"
       WHERE "textbookEditionId" = $1 AND "status" = 'CONFIRMED' ORDER BY "ordinal"`,
      [textbook.id],
    );
    if (units.rowCount === 0) throw new Error(`Confirmed textbook has no units: ${textbook.id}`);
    const preferred = textbook.subjectCode === "MATH"
      ? units.rows.find((unit) => unit.title.includes("一元一次方程")) ?? units.rows[0]
      : units.rows[0];
    targets.push({
      ...textbook,
      directory: units.rows.map((unit) => unit.title),
      currentUnit: preferred,
    });
  }
} finally {
  await client.end();
}

const sessions = {
  owner: await authenticatedSession(credentials.owner),
  admin: await authenticatedSession(credentials.admin),
  student: await authenticatedSession(credentials.student),
};
const aligned = [];
try {
  for (const target of targets) {
    await post(
      sessions.owner,
      `/v1/students/${student.id}/textbook-contexts/${target.subjectCode}/submit`,
      {
        reportedPublisher: target.publisher,
        reportedEdition: target.editionName,
        reportedVolume: target.volume,
        reportedDirectory: target.directory,
        confirmation: "SUBMIT_TEXTBOOK_INFORMATION",
      },
      `submit:${student.id}:${target.subjectCode}:${target.id}`,
      "GENERIC_GUIDANCE",
    );
    await post(
      sessions.admin,
      `/v1/students/${student.id}/textbook-contexts/${target.subjectCode}/confirm`,
      {
        textbookEditionId: target.id,
        confirmation: "CONFIRM_STUDENT_TEXTBOOK",
      },
      `confirm:${student.id}:${target.subjectCode}:${target.id}`,
      "TEXTBOOK_ALIGNED",
    );
    const updated = await post(
      sessions.student,
      `/v1/students/${student.id}/textbook-contexts/${target.subjectCode}/current-unit`,
      {
        unitId: target.currentUnit.id,
        confirmation: "UPDATE_CURRENT_UNIT",
      },
      `unit:${student.id}:${target.subjectCode}:${target.currentUnit.id}`,
      "TEXTBOOK_ALIGNED",
    );
    const readResponse = await fetch(
      `${baseUrl}/v1/students/${student.id}/textbook-contexts/${target.subjectCode}`,
      { headers: { Cookie: sessions.student.cookie } },
    );
    if (!readResponse.ok) throw new Error(`Curriculum aligned read failed with HTTP ${String(readResponse.status)}`);
    const readContext = StudentTextbookContextResponseSchema.parse(await readResponse.json());
    if (
      readContext.mode !== "TEXTBOOK_ALIGNED"
      || readContext.textbook.id !== target.id
      || readContext.textbook.status !== "CONFIRMED"
      || readContext.currentUnit?.id !== target.currentUnit.id
    ) throw new Error(`Curriculum aligned read mismatch for ${target.subjectCode}`);
    aligned.push({
      studentUserId: student.id,
      subjectCode: target.subjectCode,
      textbookEditionId: target.id,
      publisher: target.publisher,
      editionName: target.editionName,
      volume: target.volume,
      currentUnit: updated.currentUnit,
      apiReadMode: readContext.mode,
    });
  }
} finally {
  await Promise.all(Object.values(sessions).map(async (session) => {
    await fetch(`${baseUrl}/v1/auth/logout`, { method: "POST", headers: { Cookie: session.cookie } }).catch(() => undefined);
  }));
}

const verificationClient = new pg.Client({ connectionString: databaseUrl });
await verificationClient.connect();
let verification;
try {
  const contexts = await verificationClient.query(
    `SELECT context."subjectCode"::text AS "subjectCode", context."status"::text AS "status",
       context."textbookEditionId", context."currentUnitId", textbook."status"::text AS "textbookStatus",
       textbook."grade", textbook."volume", unit."textbookEditionId" AS "unitTextbookEditionId"
     FROM "StudentTextbookContext" context
     JOIN "TextbookEdition" textbook ON textbook."id" = context."textbookEditionId"
     JOIN "Unit" unit ON unit."id" = context."currentUnitId"
     WHERE context."studentUserId" = $1
     ORDER BY context."subjectCode"`,
    [student.id],
  );
  const expectedSubjects = new Set(["CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY"]);
  if (
    contexts.rowCount !== 5
    || contexts.rows.some((context) => (
      !expectedSubjects.delete(context.subjectCode)
      || context.status !== "CONFIRMED"
      || context.textbookStatus !== "CONFIRMED"
      || context.grade !== 7
      || context.volume !== "上册"
      || context.currentUnitId === null
      || context.unitTextbookEditionId !== context.textbookEditionId
    ))
    || expectedSubjects.size !== 0
  ) throw new Error("Local preview student curriculum alignment verification failed");
  verification = {
    contexts: contexts.rowCount,
    subjects: contexts.rows.map((context) => context.subjectCode),
    allConfirmed: true,
    allTextbooksConfirmed: true,
    allCurrentUnitsBelongToTextbooks: true,
  };
} finally {
  await verificationClient.end();
}

const reportPath = resolve(repositoryRoot, "data/curriculum/local-preview-student-alignment-report.json");
await writeFile(reportPath, `${JSON.stringify({
  schemaVersion: 1,
  alignedOn: "2026-08-27",
  authorization: authorization,
  scope: "LOCAL_PREVIEW_FIXTURE_ONLY",
  student: { userId: student.id, loginId: student.loginId, grade: student.grade, familyName: student.familyName },
  aligned,
  verification,
}, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({
  aligned: true,
  studentUserId: student.id,
  grade: student.grade,
  contexts: aligned.length,
  subjects: aligned.map((context) => context.subjectCode),
  verification,
  reportPath,
  credentialsIncludedInReport: false,
}));

async function authenticatedSession(credential) {
  const loginResponse = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId: credential.loginId, password: credential.password }),
  });
  if (!loginResponse.ok) throw new Error(`Curriculum actor login failed with HTTP ${String(loginResponse.status)}`);
  const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) throw new Error("Curriculum actor login did not return a session cookie");
  const proofResponse = await fetch(`${baseUrl}/v1/auth/reauthenticate`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ password: credential.password }),
  });
  if (!proofResponse.ok) throw new Error(`Curriculum actor reauthentication failed with HTTP ${String(proofResponse.status)}`);
  const body = await proofResponse.json();
  if (typeof body !== "object" || body === null || !("proof" in body) || typeof body.proof !== "string") {
    throw new Error("Curriculum actor reauthentication proof is invalid");
  }
  return { cookie, proof: body.proof };
}

async function post(session, path, body, operationKey, expectedMode) {
  const key = createHash("sha256").update(operationKey, "utf8").digest("hex");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Cookie: session.cookie,
      "Content-Type": "application/json",
      "idempotency-key": `curriculum-align:${key.slice(0, 40)}`,
      "x-reauth-proof": session.proof,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Curriculum alignment request ${path} failed with HTTP ${String(response.status)}`);
  const parsed = StudentTextbookContextResponseSchema.parse(await response.json());
  if (parsed.mode !== expectedMode) throw new Error(`Curriculum alignment expected ${expectedMode} but received ${parsed.mode}`);
  return parsed;
}

function credentialsFor(role) {
  const loginId = process.env[`CURRICULUM_${role}_LOGIN_ID`];
  const password = process.env[`CURRICULUM_${role}_PASSWORD`];
  if (loginId === undefined || password === undefined || password.length < 12) {
    throw new Error(`CURRICULUM_${role}_LOGIN_ID and a 12+ character CURRICULUM_${role}_PASSWORD are required`);
  }
  return { loginId, password };
}
