import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import argon2 from "argon2";
import pg from "pg";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const rootEnvironmentPath = resolve(repositoryRoot, ".env");
const credentialPath = resolve(repositoryRoot, ".env.bootstrap.local");

if (existsSync(rootEnvironmentPath)) {
  process.loadEnvFile(rootEnvironmentPath);
}
if (!existsSync(credentialPath)) {
  writeFileSync(
    credentialPath,
    [
      "# LOCAL PREVIEW ONLY. Never deploy this file.",
      "PREVIEW_ADMIN_LOGIN_ID=local-preview-admin",
      `PREVIEW_ADMIN_PASSWORD=${randomBytes(24).toString("base64url")}`,
      "PREVIEW_OWNER_LOGIN_ID=local-preview-owner",
      `PREVIEW_OWNER_PASSWORD=${randomBytes(24).toString("base64url")}`,
      "PREVIEW_STUDENT_LOGIN_ID=local-preview-student",
      `PREVIEW_STUDENT_PASSWORD=${randomBytes(24).toString("base64url")}`,
      "PREVIEW_CONSENT_POLICY_VERSION=LOCAL_PREVIEW_POLICY_V1",
      "PREVIEW_FAMILY_MONTHLY_CAP_FEN=2000",
      "",
    ].join("\n"),
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
}
process.loadEnvFile(credentialPath);

const databaseUrl = process.env.DATABASE_URL;
const adminLoginId = process.env.PREVIEW_ADMIN_LOGIN_ID ?? "local-preview-admin";
const adminPassword = process.env.PREVIEW_ADMIN_PASSWORD;
const ownerLoginId = process.env.PREVIEW_OWNER_LOGIN_ID ?? "local-preview-owner";
const ownerPassword = process.env.PREVIEW_OWNER_PASSWORD;
const studentLoginId = process.env.PREVIEW_STUDENT_LOGIN_ID ?? "local-preview-student";
const studentPassword = process.env.PREVIEW_STUDENT_PASSWORD;
const consentPolicyVersion = process.env.PREVIEW_CONSENT_POLICY_VERSION ?? "LOCAL_PREVIEW_POLICY_V1";
const familyMonthlyCapFen = Number(process.env.PREVIEW_FAMILY_MONTHLY_CAP_FEN ?? "2000");

const passwords = [adminPassword, ownerPassword, studentPassword];
if (
  databaseUrl === undefined
  || passwords.some((password) => password === undefined || password.length < 12 || password.length > 128)
  || new Set(passwords).size !== passwords.length
) {
  throw new Error("DATABASE_URL and three distinct 12-128 character preview passwords are required");
}
if (!Number.isInteger(familyMonthlyCapFen) || familyMonthlyCapFen < 1 || familyMonthlyCapFen > 1_000_000) {
  throw new Error("PREVIEW_FAMILY_MONTHLY_CAP_FEN must be an integer between 1 and 1000000");
}
if (consentPolicyVersion.length < 1 || consentPolicyVersion.length > 40) {
  throw new Error("PREVIEW_CONSENT_POLICY_VERSION must contain 1-40 characters");
}

const parsedUrl = new URL(databaseUrl);
if (!new Set(["127.0.0.1", "localhost"]).has(parsedUrl.hostname) || parsedUrl.pathname !== "/study") {
  throw new Error("Local preview seeding is restricted to the loopback study database");
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("BEGIN");
  const adminId = await upsertUser(
    adminLoginId,
    "本地预览管理员",
    "ADMIN",
    await hashPassword(adminPassword),
  );
  const ownerId = await upsertUser(
    ownerLoginId,
    "本地预览家长",
    "GUARDIAN",
    await hashPassword(ownerPassword),
  );
  const studentId = await upsertUser(
    studentLoginId,
    "林小满",
    "STUDENT",
    await hashPassword(studentPassword),
  );

  const existingFamily = await client.query(
    'SELECT "id" FROM "Family" WHERE "name" = $1 AND "status" = \'ACTIVE\' LIMIT 1',
    ["本地预览家庭（虚构）"],
  );
  const familyId = existingFamily.rows[0]?.id ?? randomUUID();
  if (existingFamily.rowCount === 0) {
    await client.query(
      'INSERT INTO "Family" ("id", "name", "status", "createdAt", "updatedAt") VALUES ($1, $2, \'ACTIVE\', now(), now())',
      [familyId, "本地预览家庭（虚构）"],
    );
  }

  const activeOwner = await client.query(
    `SELECT "userId" FROM "FamilyMembership"
     WHERE "familyId" = $1 AND "accessLevel" = 'OWNER' AND "revokedAt" IS NULL
     LIMIT 1`,
    [familyId],
  );
  if (activeOwner.rowCount === 1 && activeOwner.rows[0].userId !== ownerId) {
    throw new Error("The local preview family already has a different active owner");
  }

  await client.query(
    `INSERT INTO "FamilyMembership" ("id", "familyId", "userId", "role", "accessLevel", "activeAt")
     VALUES ($1, $2, $3, 'GUARDIAN', 'OWNER', now())
     ON CONFLICT ("familyId", "userId", "role") DO UPDATE SET "accessLevel" = 'OWNER', "revokedAt" = NULL`,
    [randomUUID(), familyId, ownerId],
  );
  await client.query(
    `INSERT INTO "FamilyMembership" ("id", "familyId", "userId", "role", "activeAt")
     VALUES ($1, $2, $3, 'STUDENT', now())
     ON CONFLICT ("familyId", "userId", "role") DO UPDATE SET "revokedAt" = NULL`,
    [randomUUID(), familyId, studentId],
  );
  await client.query(
    `INSERT INTO "StudentProfile" ("id", "userId", "familyId", "grade", "dailyMinutes", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 7, 55, 'ACTIVE', now(), now())
     ON CONFLICT ("userId") DO UPDATE SET "familyId" = EXCLUDED."familyId", "grade" = 7, "dailyMinutes" = 55, "status" = 'ACTIVE', "updatedAt" = now()`,
    [randomUUID(), studentId, familyId],
  );

  const relationResult = await client.query(
    `INSERT INTO "GuardianStudentRelation" ("id", "familyId", "guardianUserId", "studentUserId", "grantedAt")
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT ("familyId", "guardianUserId", "studentUserId")
     DO UPDATE SET
       "revokedAt" = NULL,
       "grantedAt" = CASE
         WHEN "GuardianStudentRelation"."revokedAt" IS NULL THEN "GuardianStudentRelation"."grantedAt"
         ELSE now()
       END
     RETURNING "id"`,
    [randomUUID(), familyId, ownerId, studentId],
  );
  const relationId = relationResult.rows[0].id;

  const consentResult = await client.query(
    `INSERT INTO "Consent" ("id", "guardianUserId", "studentUserId", "policyVersion", "grantedAt")
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT ("guardianUserId", "studentUserId", "policyVersion")
     DO UPDATE SET
       "revokedAt" = NULL,
       "grantedAt" = CASE WHEN "Consent"."revokedAt" IS NULL THEN "Consent"."grantedAt" ELSE now() END
     RETURNING "id"`,
    [randomUUID(), ownerId, studentId, consentPolicyVersion],
  );
  const consentId = consentResult.rows[0].id;

  await client.query(
    `INSERT INTO "FamilyAiBudget" ("familyId", "monthlyCapFen")
     VALUES ($1, $2)
     ON CONFLICT ("familyId") DO UPDATE SET "monthlyCapFen" = EXCLUDED."monthlyCapFen"`,
    [familyId, familyMonthlyCapFen],
  );
  const budgetPeriod = currentBudgetPeriod();
  await client.query(
    `INSERT INTO "BudgetPeriodUsage" ("id", "familyId", "period", "reservedFen", "settledFen")
     VALUES ($1, $2, $3, 0, 0)
     ON CONFLICT ("familyId", "period") DO NOTHING`,
    [randomUUID(), familyId, budgetPeriod],
  );

  await insertAuditOnce(adminId, null, "LOCAL_PREVIEW_ADMIN_BOOTSTRAPPED", "User", adminId, {
    role: "ADMIN",
  });
  await insertAuditOnce(ownerId, familyId, "GUARDIAN_RELATION_GRANTED", "GuardianStudentRelation", relationId, {
    studentUserId: studentId,
  });
  await insertAuditOnce(ownerId, familyId, "GUARDIAN_CONSENT_RECORDED", "Consent", consentId, {
    policyVersion: consentPolicyVersion,
  });
  await insertAuditOnce(ownerId, familyId, "FAMILY_AI_BUDGET_SET", "FamilyAiBudget", familyId, {
    monthlyCapFen: familyMonthlyCapFen,
    bootstrap: "LOCAL_PREVIEW",
  });
  await client.query(
    `UPDATE "Session" SET "revokedAt" = now()
     WHERE "userId" = ANY($1::uuid[]) AND "revokedAt" IS NULL`,
    [[adminId, ownerId, studentId]],
  );

  const textbookResult = await client.query(
    `INSERT INTO "TextbookEdition" ("id", "subjectCode", "grade", "publisher", "editionName", "volume", "status", "sourceReference", "verifiedByUserId", "verifiedAt", "createdAt", "updatedAt")
     VALUES ($1, 'MATH', 7, $2, $3, $4, 'CONFIRMED', $5, $6, now(), now(), now())
     ON CONFLICT ("subjectCode", "grade", "publisher", "editionName", "volume")
     DO UPDATE SET "status" = 'CONFIRMED', "verifiedByUserId" = EXCLUDED."verifiedByUserId", "verifiedAt" = now(), "updatedAt" = now()
     RETURNING "id"`,
    [randomUUID(), "本地预览出版社（虚构）", "七年级数学预览版", "上册", "local-preview-authorized-fixture", adminId],
  );
  const textbookId = textbookResult.rows[0].id;
  const unitResult = await client.query(
    `INSERT INTO "Unit" ("id", "textbookEditionId", "ordinal", "title", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, 5, $3, 'CONFIRMED', now(), now())
     ON CONFLICT ("textbookEditionId", "ordinal") DO UPDATE SET "title" = EXCLUDED."title", "status" = 'CONFIRMED', "updatedAt" = now()
     RETURNING "id"`,
    [randomUUID(), textbookId, "一元一次方程"],
  );
  const unitId = unitResult.rows[0].id;

  const existingKnowledgeNode = await client.query(
    `SELECT "id" FROM "KnowledgeNode"
     WHERE "unitId" = $1 AND "title" = $2
     LIMIT 1`,
    [unitId, "等式性质与移项（本地预览）"],
  );
  if (existingKnowledgeNode.rowCount === 0) {
    await client.query(
      `INSERT INTO "KnowledgeNode" ("id", "unitId", "title", "objective", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'CONFIRMED', now(), now())`,
      [
        randomUUID(),
        unitId,
        "等式性质与移项（本地预览）",
        "仅用于本地预览：理解等式两边进行相同运算并据此完成移项。",
      ],
    );
  }

  await client.query(
    `INSERT INTO "StudentTextbookContext" ("id", "studentUserId", "subjectCode", "reportedPublisher", "reportedEdition", "reportedVolume", "reportedDirectory", "textbookEditionId", "currentUnitId", "status", "submittedByUserId", "verifiedByUserId", "verifiedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, 'MATH', $6, $7, $8, $9::jsonb, $3, $4, 'CONFIRMED', $2, $5, now(), now(), now())
     ON CONFLICT ("studentUserId", "subjectCode") DO UPDATE SET "reportedPublisher" = EXCLUDED."reportedPublisher", "reportedEdition" = EXCLUDED."reportedEdition", "reportedVolume" = EXCLUDED."reportedVolume", "reportedDirectory" = EXCLUDED."reportedDirectory", "textbookEditionId" = EXCLUDED."textbookEditionId", "currentUnitId" = EXCLUDED."currentUnitId", "status" = 'CONFIRMED', "verifiedByUserId" = EXCLUDED."verifiedByUserId", "verifiedAt" = now(), "updatedAt" = now()`,
    [randomUUID(), studentId, textbookId, unitId, adminId, "本地预览出版社（虚构）", "七年级数学预览版", "上册", JSON.stringify(["第五单元 一元一次方程"])],
  );

  const candidates = [
    ["OVERDUE_REVIEW", "preview-review", "复习上次标记的一元一次方程错题", 15],
    ["CURRENT_UNIT", "preview-current-unit", "继续学习一元一次方程当前单元", 25],
    ["DIAGNOSTIC", "preview-diagnostic", "完成英语基础检查", 15],
  ];
  for (const [sourceType, sourceId, title, estimatedMinutes] of candidates) {
    await client.query(
      `INSERT INTO "PlanCandidate" ("id", "studentUserId", "sourceType", "sourceId", "title", "estimatedMinutes", "availableAt", "active")
       VALUES ($1, $2, $3::"PlanCandidateSource", $4, $5, $6, now(), true)
       ON CONFLICT ("studentUserId", "sourceType", "sourceId") DO UPDATE SET "title" = EXCLUDED."title", "estimatedMinutes" = EXCLUDED."estimatedMinutes", "active" = true`,
      [randomUUID(), studentId, sourceType, sourceId, title, estimatedMinutes],
    );
  }

  const planResult = await client.query(
    `INSERT INTO "DailyPlan" ("id", "studentUserId", "learningDay", "totalMinutes", "generatedAt")
     VALUES ($1, $2, (now() AT TIME ZONE 'Asia/Shanghai')::date, 55, now())
     ON CONFLICT ("studentUserId", "learningDay") DO UPDATE SET "totalMinutes" = 55
     RETURNING "id"`,
    [randomUUID(), studentId],
  );
  const planId = planResult.rows[0].id;
  for (const [index, candidate] of candidates.entries()) {
    const [sourceType, sourceId, title, estimatedMinutes] = candidate;
    await client.query(
      `INSERT INTO "PlanTask" ("id", "dailyPlanId", "sourceType", "sourceId", "title", "estimatedMinutes", "ordinal", "status", "createdAt")
       VALUES ($1, $2, $3::"PlanCandidateSource", $4, $5, $6, $7, 'PENDING', now())
       ON CONFLICT ("dailyPlanId", "sourceType", "sourceId") DO UPDATE SET "title" = EXCLUDED."title", "estimatedMinutes" = EXCLUDED."estimatedMinutes", "ordinal" = EXCLUDED."ordinal"`,
      [randomUUID(), planId, sourceType, sourceId, title, estimatedMinutes, index + 1],
    );
  }

  await client.query("COMMIT");
  process.stdout.write(JSON.stringify({
    adminLoginId,
    ownerLoginId,
    studentLoginId,
    studentId,
    familyId,
    consentPolicyVersion,
    familyMonthlyCapFen,
    budgetPeriod,
    dailyPlanTasks: candidates.length,
    credentialFile: credentialPath,
  }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

async function upsertUser(loginId, displayName, role, passwordHash) {
  const result = await client.query(
    `INSERT INTO "User" ("id", "loginId", "passwordHash", "displayName", "roles", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, ARRAY[$5::"Role"], 'ACTIVE', now(), now())
     ON CONFLICT ("loginId") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "displayName" = EXCLUDED."displayName", "roles" = EXCLUDED."roles", "status" = 'ACTIVE', "updatedAt" = now()
     RETURNING "id"`,
    [randomUUID(), loginId, passwordHash, displayName, role],
  );
  return result.rows[0].id;
}

function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

function currentBudgetPeriod(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(at);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (year === undefined || month === undefined) {
    throw new Error("Unable to calculate the Asia/Shanghai budget period");
  }
  return `${year}-${month}`;
}

async function insertAuditOnce(actorUserId, familyId, action, resourceType, resourceId, metadata) {
  await client.query(
    `INSERT INTO "AuditEvent" ("id", "actorUserId", "familyId", "action", "resourceType", "resourceId", "metadata", "createdAt")
     SELECT $1, $2, $3, $4::varchar, $5::varchar, $6::varchar, $7::jsonb, now()
     WHERE NOT EXISTS (
       SELECT 1 FROM "AuditEvent"
       WHERE "action" = $4::varchar AND "resourceType" = $5::varchar AND "resourceId" = $6::varchar
     )`,
    [randomUUID(), actorUserId, familyId, action, resourceType, resourceId, JSON.stringify(metadata)],
  );
}
