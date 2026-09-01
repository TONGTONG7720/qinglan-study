import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
  FamilySummarySchema,
  IssuedInvitationSchema,
  RedeemedInvitationSchema,
  StudentConsentSchema,
  StudentSummarySchema,
  StudentTextbookContextResponseSchema,
} from "@study/contracts";
import pg from "pg";
import { z } from "zod";

const requiredAuthorization = "ONBOARD_REAL_FAMILY_AND_ALIGN_CONFIRMED_TEXTBOOKS";
const argumentsList = process.argv.slice(2);
if (argumentsList.includes("--help")) {
  process.stdout.write(JSON.stringify({
    usage: "family:onboard-real [--validate-only] <absolute-git-external-json>",
    schemaVersion: 2,
    target: "PRODUCTION_HTTPS_ONLY",
    policyEvidence: ["public-https-url", "git-external-exact-bytes", "sha256", "guardian-accepted-at"],
    credentialsSource: "process-environment-only",
    outputContainsPersonalData: false,
  }));
  process.exit(0);
}
if (process.env.REAL_FAMILY_ONBOARDING_AUTHORIZATION !== requiredAuthorization) {
  throw new Error(`Set REAL_FAMILY_ONBOARDING_AUTHORIZATION=${requiredAuthorization}`);
}

const repositoryRoot = resolve(import.meta.dirname, "../../..");

const validateOnly = argumentsList.includes("--validate-only");
const inputArguments = argumentsList.filter((argument) => argument !== "--validate-only");
if (inputArguments.length !== 1 || !isAbsolute(inputArguments[0])) {
  throw new Error("Provide one absolute Git-external onboarding JSON path");
}
const inputPath = resolve(inputArguments[0]);
if (isWithin(repositoryRoot, inputPath)) {
  throw new Error("Real-family onboarding input must remain outside the repository");
}

const SubjectCodeSchema = z.enum([
  "CHINESE",
  "MATH",
  "ENGLISH",
  "MORALITY",
  "HISTORY",
  "PHYSICS",
  "CHEMISTRY",
]);
const secretEnvironmentNameSchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,80}$/u);
const TextbookBindingSchema = z.object({
  subjectCode: SubjectCodeSchema,
  textbookEditionId: z.uuid(),
  currentUnitId: z.uuid(),
}).strict();
const StudentInputSchema = z.object({
  reference: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/u),
  loginId: z.string().trim().min(3).max(120),
  displayName: z.string().trim().min(1).max(60),
  passwordEnvironmentName: secretEnvironmentNameSchema,
  grade: z.number().int().min(7).max(9),
  dailyMinutes: z.number().int().min(10).max(180),
  schoolName: z.string().trim().min(1).max(120).optional(),
  cohortYear: z.number().int().min(2020).max(2100).optional(),
  textbooks: z.array(TextbookBindingSchema).min(5).max(7),
}).strict();
const PrivacyPolicyInputSchema = z.object({
  version: z.string().trim().min(1).max(40),
  publicUrl: z.url().refine((value) => new URL(value).protocol === "https:", "publicUrl must use HTTPS"),
  documentPath: z.string().min(1),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();
const OnboardingInputSchema = z.object({
  schemaVersion: z.literal(2),
  targetEnvironment: z.object({
    kind: z.literal("PRODUCTION"),
    name: z.string().regex(/^[a-z][a-z0-9-]{2,39}$/u),
    apiBaseUrl: z.url().refine((value) => new URL(value).protocol === "https:", "apiBaseUrl must use HTTPS"),
    databaseName: z.string().regex(/^[a-z][a-z0-9_]{2,62}$/u),
  }).strict(),
  privacyPolicy: PrivacyPolicyInputSchema,
  guardianPolicyAcceptance: z.object({
    acceptedAt: z.iso.datetime(),
    confirmation: z.literal("GUARDIAN_ACCEPTED_DISPLAYED_PRIVACY_POLICY"),
  }).strict(),
  family: z.object({
    name: z.string().trim().min(1).max(80),
    monthlyAiBudgetFen: z.number().int().min(1).max(1_000_000),
    owner: z.object({
      loginId: z.string().trim().min(3).max(120),
      displayName: z.string().trim().min(1).max(60),
      passwordEnvironmentName: secretEnvironmentNameSchema,
    }).strict(),
  }).strict(),
  students: z.array(StudentInputSchema).min(1).max(30),
}).strict().superRefine((input, context) => {
  const loginIds = [input.family.owner.loginId, ...input.students.map((student) => student.loginId)];
  if (new Set(loginIds).size !== loginIds.length) {
    context.addIssue({ code: "custom", message: "All login IDs must be unique", path: ["students"] });
  }
  const references = input.students.map((student) => student.reference);
  if (new Set(references).size !== references.length) {
    context.addIssue({ code: "custom", message: "Student references must be unique", path: ["students"] });
  }
  const secretNames = [
    input.family.owner.passwordEnvironmentName,
    ...input.students.map((student) => student.passwordEnvironmentName),
  ];
  if (new Set(secretNames).size !== secretNames.length) {
    context.addIssue({ code: "custom", message: "Every account must use a distinct password environment variable", path: ["students"] });
  }
  for (const [studentIndex, student] of input.students.entries()) {
    const requiredSubjects = subjectsForGrade(student.grade);
    const actualSubjects = student.textbooks.map((textbook) => textbook.subjectCode);
    if (
      new Set(actualSubjects).size !== actualSubjects.length
      || actualSubjects.length !== requiredSubjects.length
      || requiredSubjects.some((subjectCode) => !actualSubjects.includes(subjectCode))
    ) {
      context.addIssue({
        code: "custom",
        message: `Grade ${String(student.grade)} must provide exactly ${requiredSubjects.join(",")}`,
        path: ["students", studentIndex, "textbooks"],
      });
    }
  }
});

const rawInput = JSON.parse(await readFile(inputPath, "utf8"));
const input = OnboardingInputSchema.parse(rawInput);
assertProductionRuntimeEnvironment();
const guardianAcceptedAt = new Date(input.guardianPolicyAcceptance.acceptedAt);
if (
  guardianAcceptedAt.getTime() > Date.now()
  || Date.now() - guardianAcceptedAt.getTime() > 24 * 60 * 60 * 1_000
) {
  throw new Error("Guardian policy acceptance must be an actual timestamp from the last 24 hours");
}
if (
  process.env.PRIVACY_POLICY_VERSION !== input.privacyPolicy.version
  || process.env.PRIVACY_POLICY_URL !== input.privacyPolicy.publicUrl
  || process.env.PRIVACY_POLICY_DOCUMENT_SHA256 !== input.privacyPolicy.documentSha256
) {
  throw new Error("Onboarding policy evidence does not match the configured production policy");
}
if (!isAbsolute(input.privacyPolicy.documentPath)) {
  throw new Error("Privacy policy documentPath must be absolute");
}
const policyDocumentPath = resolve(input.privacyPolicy.documentPath);
if (isWithin(repositoryRoot, policyDocumentPath)) {
  throw new Error("Accepted privacy policy evidence must remain outside the repository");
}
const policyDocument = await readFile(policyDocumentPath);
if (digestBytes(policyDocument) !== input.privacyPolicy.documentSha256) {
  throw new Error("Privacy policy document SHA-256 does not match onboarding input");
}
const databaseUrl = requiredEnvironment("DATABASE_URL");
const baseUrl = new URL(requiredEnvironment("REAL_FAMILY_API_BASE_URL"));
if (baseUrl.protocol !== "https:") {
  throw new Error("REAL_FAMILY_API_BASE_URL must use HTTPS for real-family onboarding");
}
const apiBaseUrl = baseUrl.toString().replace(/\/$/u, "");
if (apiBaseUrl !== new URL(input.targetEnvironment.apiBaseUrl).toString().replace(/\/$/u, "")) {
  throw new Error("REAL_FAMILY_API_BASE_URL does not match the declared production target");
}
await assertTargetDatabase(databaseUrl, input.targetEnvironment.databaseName);

const targets = await loadAndValidateTargets(databaseUrl, input.students);
if (validateOnly) {
  process.stdout.write(JSON.stringify({
    valid: true,
    mode: "VALIDATE_ONLY",
    families: 1,
    students: input.students.length,
    textbookContexts: targets.reduce((count, student) => count + student.textbooks.length, 0),
    targetEnvironmentVerified: true,
    privacyPolicyDocumentVerified: true,
    credentialsIncluded: false,
    personalDataIncluded: false,
  }));
} else {
  const expectedAcceptance = `ACCEPTED:${input.privacyPolicy.version}:${input.privacyPolicy.documentSha256}`;
  if (requiredEnvironment("REAL_FAMILY_GUARDIAN_POLICY_ACCEPTANCE") !== expectedAcceptance) {
    throw new Error("Guardian privacy policy acceptance attestation does not match the displayed document");
  }
  await verifyPublishedPolicy(input.privacyPolicy.publicUrl, input.privacyPolicy.documentSha256);
  const adminCredential = {
    loginId: requiredEnvironment("REAL_FAMILY_ADMIN_LOGIN_ID"),
    password: requiredPassword("REAL_FAMILY_ADMIN_PASSWORD"),
  };
  const ownerCredential = {
    loginId: input.family.owner.loginId,
    password: requiredPassword(input.family.owner.passwordEnvironmentName),
  };
  const studentCredentials = new Map(input.students.map((student) => [
    student.reference,
    { loginId: student.loginId, password: requiredPassword(student.passwordEnvironmentName) },
  ]));
  const householdPasswords = [
    ownerCredential.password,
    ...[...studentCredentials.values()].map((item) => item.password),
  ];
  if (new Set(householdPasswords).size !== householdPasswords.length) {
    throw new Error("Every household account must use a distinct password");
  }
  const sessions = [];
  try {
    const adminSession = await authenticatedSession(adminCredential, "administrator");
    sessions.push(adminSession);
    const onboardingKey = digest({
      schemaVersion: input.schemaVersion,
      familyName: input.family.name,
      ownerLoginId: input.family.owner.loginId,
      privacyPolicy: {
        version: input.privacyPolicy.version,
        publicUrl: input.privacyPolicy.publicUrl,
        documentSha256: input.privacyPolicy.documentSha256,
      },
      guardianAcceptedAt: input.guardianPolicyAcceptance.acceptedAt,
      students: input.students.map((student) => ({
        reference: student.reference,
        loginId: student.loginId,
        grade: student.grade,
        textbooks: student.textbooks,
      })),
    });

    const invitation = await writeRequest({
      session: adminSession,
      path: "/v1/invitations",
      body: { mode: "NEW_FAMILY", expiresInHours: 24, confirmation: "ISSUE_INVITATION" },
      idempotencyKey: idempotencyKey("real-family-invite", onboardingKey),
      schema: IssuedInvitationSchema,
      label: "issue family invitation",
    });
    const redeemed = await publicRequest({
      path: "/v1/invitations/redeem",
      body: {
        mode: "NEW_FAMILY",
        token: invitation.token,
        loginId: input.family.owner.loginId,
        password: ownerCredential.password,
        displayName: input.family.owner.displayName,
        familyName: input.family.name,
        idempotencyKey: idempotencyKey("real-family-redeem", onboardingKey),
        confirmation: "CREATE_FAMILY",
      },
      schema: RedeemedInvitationSchema,
      label: "redeem family invitation",
    });
    const ownerSession = await authenticatedSession(ownerCredential, "family owner");
    sessions.push(ownerSession);
    await writeRequest({
      session: ownerSession,
      path: `/v1/families/${redeemed.familyId}/ai-budget`,
      body: {
        monthlyCapFen: input.family.monthlyAiBudgetFen,
        confirmation: "SET_FAMILY_AI_BUDGET",
      },
      idempotencyKey: idempotencyKey("real-family-budget", onboardingKey),
      schema: z.object({ familyId: z.uuid(), monthlyCapFen: z.number().int() }).passthrough(),
      label: "set family AI budget",
    });

    const completedStudents = [];
    for (const [studentIndex, student] of input.students.entries()) {
      await refreshProof(ownerSession, ownerCredential.password, "family owner");
      const studentKey = digest({ onboardingKey, reference: student.reference, loginId: student.loginId });
      const createdStudent = await writeRequest({
        session: ownerSession,
        path: `/v1/families/${redeemed.familyId}/students`,
        body: {
          loginId: student.loginId,
          password: studentCredentials.get(student.reference).password,
          displayName: student.displayName,
          grade: student.grade,
          dailyMinutes: student.dailyMinutes,
          ...(student.schoolName === undefined ? {} : { schoolName: student.schoolName }),
          ...(student.cohortYear === undefined ? {} : { cohortYear: student.cohortYear }),
          confirmation: "CREATE_STUDENT",
        },
        idempotencyKey: idempotencyKey("real-student-create", studentKey),
        schema: StudentSummarySchema,
        label: `create student ${String(studentIndex + 1)}`,
      });
      const consent = await writeRequest({
        session: ownerSession,
        path: `/v1/families/${redeemed.familyId}/students/${createdStudent.userId}/consents`,
        body: {
          policyVersion: input.privacyPolicy.version,
          policyUrl: input.privacyPolicy.publicUrl,
          policyDocumentSha256: input.privacyPolicy.documentSha256,
          confirmation: "GRANT_STUDENT_CONSENT",
        },
        idempotencyKey: idempotencyKey("real-student-consent", studentKey),
        schema: StudentConsentSchema,
        label: `grant student consent ${String(studentIndex + 1)}`,
      });
      if (consent.revokedAt !== null) throw new Error("Granted student consent unexpectedly returned revoked");
      if (new Date(consent.grantedAt).getTime() < guardianAcceptedAt.getTime()) {
        throw new Error("Consent was recorded before the guardian policy acceptance timestamp");
      }

      const target = targets.find((candidate) => candidate.reference === student.reference);
      if (target === undefined) throw new Error("Validated student target disappeared");
      for (const textbook of target.textbooks) {
        await writeContext(ownerSession, createdStudent.userId, textbook, studentKey, "submit");
        await refreshProof(adminSession, adminCredential.password, "administrator");
        await writeContext(adminSession, createdStudent.userId, textbook, studentKey, "confirm");
      }

      const credential = studentCredentials.get(student.reference);
      if (credential === undefined) throw new Error("Validated student credential disappeared");
      const studentSession = await authenticatedSession(credential, `student ${String(studentIndex + 1)}`);
      sessions.push(studentSession);
      for (const textbook of target.textbooks) {
        await writeContext(studentSession, createdStudent.userId, textbook, studentKey, "unit");
        const readContext = await readRequest({
          session: studentSession,
          path: `/v1/students/${createdStudent.userId}/textbook-contexts/${textbook.subjectCode}`,
          schema: StudentTextbookContextResponseSchema,
          label: `verify textbook context ${String(studentIndex + 1)}`,
        });
        if (
          readContext.mode !== "TEXTBOOK_ALIGNED"
          || readContext.textbook.id !== textbook.textbookEditionId
          || readContext.currentUnit?.id !== textbook.currentUnitId
        ) {
          throw new Error(`Textbook context verification failed for student ${String(studentIndex + 1)}`);
        }
      }
      completedStudents.push({
        reference: student.reference,
        userId: createdStudent.userId,
        grade: createdStudent.grade,
        subjects: target.textbooks.map((textbook) => textbook.subjectCode),
      });
    }

    const family = await readRequest({
      session: ownerSession,
      path: `/v1/families/${redeemed.familyId}`,
      schema: FamilySummarySchema,
      label: "verify family",
    });
    if (family.students.length !== input.students.length) {
      throw new Error("Family student count does not match onboarding input");
    }
    const verification = await verifyDatabase(
      databaseUrl,
      redeemed.familyId,
      redeemed.userId,
      completedStudents,
      input.family.monthlyAiBudgetFen,
      input.privacyPolicy,
    );
    process.stdout.write(JSON.stringify({
      onboarded: true,
      scope: "REAL_FAMILY",
      targetEnvironment: input.targetEnvironment.name,
      students: completedStudents.map((student) => ({
        grade: student.grade,
        subjectCount: student.subjects.length,
      })),
      verification,
      credentialsIncluded: false,
      personalDataIncluded: false,
    }));
  } finally {
    await Promise.all(sessions.map(logout));
  }
}

async function loadAndValidateTargets(connectionString, students) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const validated = [];
    for (const student of students) {
      const textbooks = [];
      for (const binding of student.textbooks) {
        const result = await client.query(
          `SELECT textbook."id" AS "textbookEditionId", textbook."subjectCode"::text AS "subjectCode",
             textbook."grade", textbook."publisher", textbook."editionName", textbook."volume",
             unit."id" AS "currentUnitId", unit."title" AS "currentUnitTitle"
           FROM "TextbookEdition" textbook
           JOIN "Unit" unit ON unit."id" = $2 AND unit."textbookEditionId" = textbook."id"
           WHERE textbook."id" = $1 AND textbook."status" = 'CONFIRMED'
             AND textbook."grade" = $3 AND textbook."subjectCode" = $4::"SubjectCode"
             AND unit."status" = 'CONFIRMED'`,
          [binding.textbookEditionId, binding.currentUnitId, student.grade, binding.subjectCode],
        );
        if (result.rowCount !== 1) {
          throw new Error(`Confirmed textbook/current-unit mismatch for ${student.reference}:${binding.subjectCode}`);
        }
        const directory = await client.query(
          `SELECT "title" FROM "Unit" WHERE "textbookEditionId" = $1 AND "status" = 'CONFIRMED' ORDER BY "ordinal"`,
          [binding.textbookEditionId],
        );
        if (directory.rowCount === 0) throw new Error("Confirmed textbook has no confirmed directory units");
        textbooks.push({ ...result.rows[0], directory: directory.rows.map((row) => row.title) });
      }
      validated.push({ reference: student.reference, textbooks });
    }
    return validated;
  } finally {
    await client.end();
  }
}

async function assertTargetDatabase(connectionString, expectedDatabaseName) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const database = await client.query("SELECT current_database() AS name");
    if (database.rows[0]?.name !== expectedDatabaseName) {
      throw new Error("DATABASE_URL does not point to the declared production database");
    }
    const migration = await client.query(
      `SELECT "migration_name", "finished_at", "rolled_back_at"
       FROM "_prisma_migrations"
       ORDER BY "started_at" DESC
       LIMIT 1`,
    );
    const expectedMigrationName = requiredEnvironment("EXPECTED_MIGRATION_NAME");
    if (
      migration.rowCount !== 1
      || migration.rows[0].migration_name !== expectedMigrationName
      || migration.rows[0].finished_at === null
      || migration.rows[0].rolled_back_at !== null
    ) {
      throw new Error("Production database migration state does not match EXPECTED_MIGRATION_NAME");
    }
  } finally {
    await client.end();
  }
}

async function verifyPublishedPolicy(publicUrl, expectedSha256) {
  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, 15_000);
  try {
    const response = await fetch(publicUrl, { redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error(`Published privacy policy returned HTTP ${String(response.status)}`);
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
      throw new Error("Published privacy policy exceeds the 2 MB acceptance limit");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 2_000_000 || digestBytes(bytes) !== expectedSha256) {
      throw new Error("Published privacy policy bytes do not match the accepted SHA-256");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyDatabase(
  connectionString,
  familyId,
  ownerUserId,
  students,
  monthlyAiBudgetFen,
  privacyPolicy,
) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const owner = await client.query(
      `SELECT count(*)::int AS "count" FROM "FamilyMembership"
       WHERE "familyId" = $1 AND "userId" = $2 AND "role" = 'GUARDIAN'
         AND "accessLevel" = 'OWNER' AND "revokedAt" IS NULL`,
      [familyId, ownerUserId],
    );
    const studentIds = students.map((student) => student.userId);
    const profiles = await client.query(
      `SELECT count(*)::int AS "count" FROM "StudentProfile"
       WHERE "familyId" = $1 AND "userId" = ANY($2::uuid[]) AND "status" = 'ACTIVE'`,
      [familyId, studentIds],
    );
    const relations = await client.query(
      `SELECT count(*)::int AS "count" FROM "GuardianStudentRelation"
       WHERE "familyId" = $1 AND "guardianUserId" = $2 AND "studentUserId" = ANY($3::uuid[])
         AND "revokedAt" IS NULL`,
      [familyId, ownerUserId, studentIds],
    );
    const consents = await client.query(
      `SELECT count(*)::int AS "count" FROM "Consent"
       WHERE "guardianUserId" = $1 AND "studentUserId" = ANY($2::uuid[]) AND "revokedAt" IS NULL
         AND "policyVersion" = $3 AND "policyUrl" = $4 AND "policyDocumentSha256" = $5`,
      [
        ownerUserId,
        studentIds,
        privacyPolicy.version,
        privacyPolicy.publicUrl,
        privacyPolicy.documentSha256,
      ],
    );
    const contexts = await client.query(
      `SELECT count(*)::int AS "count" FROM "StudentTextbookContext" context
       JOIN "TextbookEdition" textbook ON textbook."id" = context."textbookEditionId"
       JOIN "Unit" unit ON unit."id" = context."currentUnitId"
       WHERE context."studentUserId" = ANY($1::uuid[]) AND context."status" = 'CONFIRMED'
         AND textbook."status" = 'CONFIRMED' AND unit."textbookEditionId" = textbook."id"`,
      [studentIds],
    );
    const budget = await client.query(
      `SELECT "monthlyCapFen" FROM "FamilyAiBudget" WHERE "familyId" = $1`,
      [familyId],
    );
    const expectedContexts = students.reduce((count, student) => count + student.subjects.length, 0);
    if (
      owner.rows[0].count !== 1
      || profiles.rows[0].count !== students.length
      || relations.rows[0].count !== students.length
      || consents.rows[0].count !== students.length
      || contexts.rows[0].count !== expectedContexts
      || budget.rowCount !== 1
      || budget.rows[0].monthlyCapFen !== monthlyAiBudgetFen
    ) {
      throw new Error("Post-onboarding database verification failed");
    }
    return {
      activeOwners: 1,
      activeStudents: students.length,
      activeOwnerStudentRelations: students.length,
      activeStudentConsents: students.length,
      consentPolicyEvidenceVerified: true,
      confirmedTextbookContexts: expectedContexts,
      familyAiBudgetConfigured: true,
    };
  } finally {
    await client.end();
  }
}

async function writeContext(session, studentUserId, textbook, studentKey, action) {
  if (action === "submit") {
    return writeRequest({
      session,
      path: `/v1/students/${studentUserId}/textbook-contexts/${textbook.subjectCode}/submit`,
      body: {
        reportedPublisher: textbook.publisher,
        reportedEdition: textbook.editionName,
        reportedVolume: textbook.volume,
        reportedDirectory: textbook.directory,
        confirmation: "SUBMIT_TEXTBOOK_INFORMATION",
      },
      idempotencyKey: idempotencyKey("real-context-submit", `${studentKey}:${textbook.subjectCode}`),
      schema: StudentTextbookContextResponseSchema,
      label: "submit textbook context",
    });
  }
  if (action === "confirm") {
    return writeRequest({
      session,
      path: `/v1/students/${studentUserId}/textbook-contexts/${textbook.subjectCode}/confirm`,
      body: { textbookEditionId: textbook.textbookEditionId, confirmation: "CONFIRM_STUDENT_TEXTBOOK" },
      idempotencyKey: idempotencyKey("real-context-confirm", `${studentKey}:${textbook.subjectCode}`),
      schema: StudentTextbookContextResponseSchema,
      label: "confirm textbook context",
    });
  }
  return writeRequest({
    session,
    path: `/v1/students/${studentUserId}/textbook-contexts/${textbook.subjectCode}/current-unit`,
    body: { unitId: textbook.currentUnitId, confirmation: "UPDATE_CURRENT_UNIT" },
    idempotencyKey: idempotencyKey("real-context-unit", `${studentKey}:${textbook.subjectCode}`),
    schema: StudentTextbookContextResponseSchema,
    label: "set current textbook unit",
  });
}

async function authenticatedSession(credential, label) {
  const response = await fetch(`${apiBaseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Qinglang-CSRF": "1" },
    body: JSON.stringify(credential),
  });
  if (!response.ok) throw new Error(`${label} login failed with HTTP ${String(response.status)}`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) throw new Error(`${label} login returned no session cookie`);
  const session = { cookie, proof: "" };
  await refreshProof(session, credential.password, label);
  return session;
}

async function refreshProof(session, password, label) {
  const response = await fetch(`${apiBaseUrl}/v1/auth/reauthenticate`, {
    method: "POST",
    headers: {
      Cookie: session.cookie,
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
    },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw new Error(`${label} reauthentication failed with HTTP ${String(response.status)}`);
  const body = z.object({ proof: z.string().min(1), expiresAt: z.iso.datetime() }).strict().parse(await response.json());
  session.proof = body.proof;
}

async function writeRequest({ session, path, body, idempotencyKey: key, schema, label }) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Cookie: session.cookie,
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
      "idempotency-key": key,
      "x-reauth-proof": session.proof,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${label} failed with HTTP ${String(response.status)}`);
  return schema.parse(await response.json());
}

async function publicRequest({ path, body, schema, label }) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Qinglang-CSRF": "1" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${label} failed with HTTP ${String(response.status)}`);
  return schema.parse(await response.json());
}

async function readRequest({ session, path, schema, label }) {
  const response = await fetch(`${apiBaseUrl}${path}`, { headers: { Cookie: session.cookie } });
  if (!response.ok) throw new Error(`${label} failed with HTTP ${String(response.status)}`);
  return schema.parse(await response.json());
}

async function logout(session) {
  await fetch(`${apiBaseUrl}/v1/auth/logout`, {
    method: "POST",
    headers: { Cookie: session.cookie, "X-Qinglang-CSRF": "1" },
  }).catch(() => undefined);
}

function subjectsForGrade(grade) {
  const common = ["CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY"];
  if (grade === 7) return common;
  if (grade === 8) return [...common, "PHYSICS"];
  return [...common, "PHYSICS", "CHEMISTRY"];
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function digestBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function idempotencyKey(prefix, material) {
  return `${prefix}:${digest(material).slice(0, 40)}`;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function assertProductionRuntimeEnvironment() {
  const requiredValues = {
    NODE_ENV: "production",
    SESSION_COOKIE_SECURE: "true",
    VITE_RELEASE_SCOPE: "READ_ONLY_BETA",
    VITE_ENABLE_DEMO_COURSE_CATALOG: "false",
    VITE_QA_DEMO_BUILD: "false",
    MODEL_PROVIDER: "disabled",
    OBJECT_STORAGE_PROVIDER: "disabled",
    EMAIL_PROVIDER: "disabled",
  };
  for (const [name, expected] of Object.entries(requiredValues)) {
    if (process.env[name]?.trim() !== expected) {
      throw new Error(`${name} must equal the reviewed real-family production value`);
    }
  }
}

function requiredPassword(name) {
  const value = process.env[name];
  if (value === undefined || value.length < 12 || value.length > 128) {
    throw new Error(`${name} must contain a 12-128 character password`);
  }
  return value;
}

function isWithin(parent, child) {
  const pathDifference = relative(parent, child);
  return pathDifference === "" || (!pathDifference.startsWith("..") && !isAbsolute(pathDifference));
}
