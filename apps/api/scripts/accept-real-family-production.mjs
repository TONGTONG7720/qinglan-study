import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
  CurrentUserSchema,
  ErrorEnvelopeSchema,
  FamilyExportResponseSchema,
  FamilySummarySchema,
  IssuedInvitationSchema,
  JoinAuthorizationSchema,
  RedeemedInvitationSchema,
  StudentTextbookContextResponseSchema,
} from "@study/contracts";
import pg from "pg";
import { z } from "zod";

const requiredAuthorization = "RUN_REAL_FAMILY_PRODUCTION_ACCEPTANCE";
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const argumentsList = process.argv.slice(2);

if (argumentsList.includes("--help")) {
  process.stdout.write(JSON.stringify({
    usage: "family:accept-production [--validate-only] <absolute-git-external-json>",
    writesInAcceptanceMode: [
      "create-or-reuse-one-real-member-guardian",
      "temporarily-revoke-and-restore-that-guardian-student-relation",
      "create-one-short-lived-family-export",
      "expire-one-new-probe-session",
    ],
    neverExecuted: [
      "authorized-personal-deletion",
      "authorized-family-deletion",
      "retention-purge",
    ],
    credentialsSource: "process-environment-only",
    outputContainsPersonalData: false,
  }));
  process.exit(0);
}

if (process.env.REAL_FAMILY_PRODUCTION_ACCEPTANCE_AUTHORIZATION !== requiredAuthorization) {
  throw new Error("Explicit real-family production acceptance authorization is required");
}

const validateOnly = argumentsList.includes("--validate-only");
const inputArguments = argumentsList.filter((argument) => argument !== "--validate-only");
if (inputArguments.length !== 1 || !isAbsolute(inputArguments[0])) {
  throw new Error("Provide one absolute Git-external acceptance JSON path");
}
const inputPath = resolve(inputArguments[0]);
if (isWithin(repositoryRoot, inputPath)) {
  throw new Error("Real-family production acceptance input must remain outside the repository");
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
const SecretEnvironmentNameSchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,80}$/u);
const AccountSchema = z.object({
  loginId: z.string().trim().min(3).max(120),
  passwordEnvironmentName: SecretEnvironmentNameSchema,
}).strict();
const mutationResultSchema = z.object({ id: z.uuid(), status: z.string().min(1) }).strict();
const AcceptanceInputSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.uuid(),
  targetEnvironment: z.object({
    kind: z.literal("PRODUCTION"),
    name: z.string().regex(/^[a-z][a-z0-9-]{2,39}$/u),
    apiBaseUrl: z.url().refine((value) => new URL(value).protocol === "https:", "apiBaseUrl must use HTTPS"),
    databaseName: z.string().regex(/^[a-z][a-z0-9_]{2,62}$/u),
  }).strict(),
  privacyPolicy: z.object({
    version: z.string().trim().min(1).max(40),
    publicUrl: z.url().refine((value) => new URL(value).protocol === "https:", "publicUrl must use HTTPS"),
    documentPath: z.string().min(1),
    documentSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    guardianAcceptedAt: z.iso.datetime(),
  }).strict(),
  family: z.object({
    owner: AccountSchema,
    student: AccountSchema.extend({ subjectCode: SubjectCodeSchema }).strict(),
    acceptanceGuardian: AccountSchema.extend({
      displayName: z.string().trim().min(1).max(60),
      createIfMissing: z.literal(true),
      restoreRelationAfterProbe: z.literal(true),
      confirmation: z.literal("USE_REAL_GUARDIAN_FOR_REVOCATION_PROBE"),
    }).strict(),
  }).strict(),
  crossFamilyProbe: z.object({
    otherStudentLoginId: z.string().trim().min(3).max(120),
    subjectCode: SubjectCodeSchema,
    confirmation: z.literal("AUTHORIZED_CROSS_FAMILY_NON_DISCLOSURE_PROBE"),
  }).strict(),
  deletionBoundary: z.object({
    mode: z.literal("NON_DESTRUCTIVE_ONLY"),
    confirmation: z.literal("DO_NOT_EXECUTE_REAL_DELETION"),
  }).strict(),
}).strict().superRefine((input, context) => {
  const loginIds = [
    input.family.owner.loginId,
    input.family.student.loginId,
    input.family.acceptanceGuardian.loginId,
    input.crossFamilyProbe.otherStudentLoginId,
  ];
  if (new Set(loginIds).size !== loginIds.length) {
    context.addIssue({ code: "custom", message: "Every acceptance account must be distinct", path: ["family"] });
  }
  const secretNames = [
    input.family.owner.passwordEnvironmentName,
    input.family.student.passwordEnvironmentName,
    input.family.acceptanceGuardian.passwordEnvironmentName,
  ];
  if (new Set(secretNames).size !== secretNames.length) {
    context.addIssue({ code: "custom", message: "Every household account must use a distinct secret environment name", path: ["family"] });
  }
});

const input = AcceptanceInputSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
assertProductionRuntimeEnvironment();
if (
  process.env.PRIVACY_POLICY_VERSION !== input.privacyPolicy.version
  || process.env.PRIVACY_POLICY_URL !== input.privacyPolicy.publicUrl
  || process.env.PRIVACY_POLICY_DOCUMENT_SHA256 !== input.privacyPolicy.documentSha256
) {
  throw new Error("Acceptance policy evidence does not match the configured production policy");
}
const apiBaseUrl = requiredHttpsApiBaseUrl(input.targetEnvironment.apiBaseUrl);
const databaseUrl = requiredEnvironment("DATABASE_URL");
const policyDocumentPath = requireExternalAbsolutePath(input.privacyPolicy.documentPath, "privacy policy document");
const policyDocument = await readFile(policyDocumentPath);
if (digestBytes(policyDocument) !== input.privacyPolicy.documentSha256) {
  throw new Error("Privacy policy document SHA-256 does not match acceptance input");
}
const guardianAcceptedAt = new Date(input.privacyPolicy.guardianAcceptedAt);
if (
  guardianAcceptedAt.getTime() > Date.now()
  || Date.now() - guardianAcceptedAt.getTime() > 24 * 60 * 60 * 1_000
) {
  throw new Error("Guardian policy acceptance must be an actual timestamp from the last 24 hours");
}

const target = await loadAcceptanceTarget(databaseUrl, input);
await assertDatabaseReadiness(databaseUrl, input.targetEnvironment.databaseName);
await verifyConsentAndCurriculum(databaseUrl, input, target);

if (validateOnly) {
  process.stdout.write(JSON.stringify({
    valid: true,
    mode: "VALIDATE_ONLY",
    scope: "REAL_FAMILY_PRODUCTION_ACCEPTANCE",
    targetEnvironment: input.targetEnvironment.name,
    primaryFamilyResolved: true,
    secondRealFamilyResolved: true,
    privacyPolicyDocumentVerified: true,
    consentEvidenceVerified: true,
    confirmedTextbookContextsVerified: true,
    acceptanceGuardianWillBeCreated: target.acceptanceGuardianUserId === null,
    credentialsIncluded: false,
    personalDataIncluded: false,
    databaseIdentifiersIncluded: false,
  }));
} else {
  const expectedAcceptance = `ACCEPTED:${input.privacyPolicy.version}:${input.privacyPolicy.documentSha256}`;
  if (requiredEnvironment("REAL_FAMILY_GUARDIAN_POLICY_ACCEPTANCE") !== expectedAcceptance) {
    throw new Error("Guardian privacy policy acceptance attestation does not match the displayed document");
  }
  await verifyPublishedPolicy(input.privacyPolicy.publicUrl, input.privacyPolicy.documentSha256);
  await verifyHealthReadiness(apiBaseUrl);

  const credentials = loadCredentials(input);
  const sessions = [];
  const acceptanceStartedAt = await databaseTimestamp(databaseUrl);
  try {
    const adminSession = await authenticatedSession(apiBaseUrl, credentials.admin, "administrator");
    const ownerSession = await authenticatedSession(apiBaseUrl, credentials.owner, "family owner");
    const studentSession = await authenticatedSession(apiBaseUrl, credentials.student, "student");
    sessions.push(adminSession, ownerSession, studentSession);
    assertRole(adminSession.user, "ADMIN", null);
    assertRole(ownerSession.user, "GUARDIAN", target.familyId);
    assertRole(studentSession.user, "STUDENT", target.familyId);

    const acceptanceGuardianUserId = await ensureAcceptanceGuardian({
      apiBaseUrl,
      databaseUrl,
      input,
      target,
      adminSession,
      ownerSession,
      credential: credentials.acceptanceGuardian,
    });
    const guardianSession = await authenticatedSession(
      apiBaseUrl,
      credentials.acceptanceGuardian,
      "acceptance guardian",
    );
    sessions.push(guardianSession);
    assertRole(guardianSession.user, "GUARDIAN", target.familyId);

    await verifyRoleReads({
      apiBaseUrl,
      input,
      target,
      adminSession,
      ownerSession,
      studentSession,
      guardianSession,
    });
    await verifyRevocationAndRestore({
      apiBaseUrl,
      databaseUrl,
      input,
      target,
      acceptanceGuardianUserId,
      ownerSession,
      guardianSession,
    });
    await verifySessionBoundaries({
      apiBaseUrl,
      databaseUrl,
      ownerCredential: credentials.owner,
      studentCredential: credentials.student,
    });
    const exportId = await verifyExportBoundary({
      apiBaseUrl,
      input,
      target,
      ownerSession,
      studentSession,
      guardianSession,
      adminSession,
    });
    await verifyDeletionBoundary({
      apiBaseUrl,
      databaseUrl,
      input,
      target,
      ownerSession,
      studentSession,
      guardianSession,
      adminSession,
    });
    await verifyCrossFamilyNonDisclosure({
      apiBaseUrl,
      input,
      target,
      ownerSession,
      studentSession,
      guardianSession,
      adminSession,
    });
    await verifyAcceptanceAudit({
      databaseUrl,
      target,
      acceptanceGuardianUserId,
      exportId,
      acceptanceStartedAt,
    });

    const checks = {
      productionTarget: true,
      privacyPolicyExactBytes: true,
      guardianConsentEvidence: true,
      confirmedTextbooksAndCurrentUnits: true,
      studentGuardianAdminPermissions: true,
      relationRevocationImmediateLoss: true,
      relationRestoredAfterProbe: true,
      logoutRevokesSession: true,
      expiredSessionRejected: true,
      exportBoundary: true,
      deletionBoundaryNonDestructive: true,
      crossFamilyNonDisclosure: true,
      auditTrail: true,
    };
    process.stdout.write(JSON.stringify({
      accepted: true,
      scope: "REAL_FAMILY_PRODUCTION_ACCEPTANCE",
      targetEnvironment: input.targetEnvironment.name,
      checks,
      destructiveDeletionExecuted: false,
      credentialsIncluded: false,
      personalDataIncluded: false,
      databaseIdentifiersIncluded: false,
      evidenceHash: digest({
        runReferenceHash: digest(input.runId),
        targetEnvironment: input.targetEnvironment.name,
        policyVersion: input.privacyPolicy.version,
        policyDocumentSha256: input.privacyPolicy.documentSha256,
        checks,
      }),
    }));
  } finally {
    await Promise.all(sessions.map((session) => logout(apiBaseUrl, session)));
  }
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
      throw new Error(`${name} must equal the reviewed production acceptance value`);
    }
  }
}

function requiredHttpsApiBaseUrl(expected) {
  const actual = new URL(requiredEnvironment("REAL_FAMILY_API_BASE_URL"));
  if (actual.protocol !== "https:") throw new Error("REAL_FAMILY_API_BASE_URL must use HTTPS");
  const normalizedActual = actual.toString().replace(/\/$/u, "");
  const normalizedExpected = new URL(expected).toString().replace(/\/$/u, "");
  if (normalizedActual !== normalizedExpected) {
    throw new Error("REAL_FAMILY_API_BASE_URL does not match the declared production target");
  }
  return normalizedActual;
}

function requireExternalAbsolutePath(value, label) {
  if (!isAbsolute(value)) throw new Error(`${label} path must be absolute`);
  const resolved = resolve(value);
  if (isWithin(repositoryRoot, resolved)) throw new Error(`${label} must remain outside the repository`);
  return resolved;
}

async function loadAcceptanceTarget(connectionString, acceptanceInput) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const primary = await client.query(
      `SELECT family."id" AS "familyId", owner."id" AS "ownerUserId",
              student."id" AS "studentUserId", profile."grade"
       FROM "User" owner
       JOIN "FamilyMembership" owner_membership
         ON owner_membership."userId" = owner."id"
        AND owner_membership."role" = 'GUARDIAN'
        AND owner_membership."accessLevel" = 'OWNER'
        AND owner_membership."revokedAt" IS NULL
       JOIN "Family" family
         ON family."id" = owner_membership."familyId" AND family."status" = 'ACTIVE'
       JOIN "User" student ON student."loginId" = $2 AND student."status" = 'ACTIVE'
       JOIN "StudentProfile" profile
         ON profile."userId" = student."id" AND profile."familyId" = family."id" AND profile."status" = 'ACTIVE'
       WHERE owner."loginId" = $1 AND owner."status" = 'ACTIVE'`,
      [acceptanceInput.family.owner.loginId, acceptanceInput.family.student.loginId],
    );
    if (primary.rowCount !== 1) throw new Error("Primary real family, owner, and student could not be resolved uniquely");
    const row = primary.rows[0];
    if (!subjectsForGrade(row.grade).includes(acceptanceInput.family.student.subjectCode)) {
      throw new Error("Primary probe subject is unavailable for the real student's grade");
    }

    const crossFamily = await client.query(
      `SELECT student."id" AS "studentUserId", profile."familyId", profile."grade"
       FROM "User" student
       JOIN "StudentProfile" profile ON profile."userId" = student."id" AND profile."status" = 'ACTIVE'
       JOIN "Family" family ON family."id" = profile."familyId" AND family."status" = 'ACTIVE'
       WHERE student."loginId" = $1 AND student."status" = 'ACTIVE'`,
      [acceptanceInput.crossFamilyProbe.otherStudentLoginId],
    );
    if (crossFamily.rowCount !== 1 || crossFamily.rows[0].familyId === row.familyId) {
      throw new Error("A distinct authorized second real family is required for cross-family acceptance");
    }
    if (!subjectsForGrade(crossFamily.rows[0].grade).includes(acceptanceInput.crossFamilyProbe.subjectCode)) {
      throw new Error("Cross-family probe subject is unavailable for the selected real student's grade");
    }

    const guardian = await client.query(
      `SELECT guardian."id" AS "userId", membership."familyId",
              membership."accessLevel", membership."revokedAt"
       FROM "User" guardian
       LEFT JOIN "FamilyMembership" membership
         ON membership."userId" = guardian."id" AND membership."revokedAt" IS NULL
       WHERE guardian."loginId" = $1`,
      [acceptanceInput.family.acceptanceGuardian.loginId],
    );
    if (guardian.rowCount > 1) throw new Error("Acceptance guardian has ambiguous active family memberships");
    if (
      guardian.rowCount === 1
      && (
        guardian.rows[0].familyId !== row.familyId
        || guardian.rows[0].accessLevel !== "MEMBER"
        || guardian.rows[0].revokedAt !== null
      )
    ) {
      throw new Error("Existing acceptance guardian is not an active MEMBER of the primary family");
    }

    const allStudents = await client.query(
      `SELECT "userId" FROM "StudentProfile"
       WHERE "familyId" = $1 AND "status" = 'ACTIVE'
       ORDER BY "userId"`,
      [row.familyId],
    );
    return {
      familyId: row.familyId,
      ownerUserId: row.ownerUserId,
      studentUserId: row.studentUserId,
      studentGrade: row.grade,
      familyStudentIds: allStudents.rows.map((item) => item.userId),
      acceptanceGuardianUserId: guardian.rows[0]?.userId ?? null,
      otherFamilyId: crossFamily.rows[0].familyId,
      otherStudentUserId: crossFamily.rows[0].studentUserId,
    };
  } finally {
    await client.end();
  }
}

async function assertDatabaseReadiness(connectionString, expectedDatabaseName) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const database = await client.query("SELECT current_database() AS name");
    const migration = await client.query(
      `SELECT "migration_name", "finished_at", "rolled_back_at"
       FROM "_prisma_migrations" ORDER BY "started_at" DESC LIMIT 1`,
    );
    if (database.rows[0]?.name !== expectedDatabaseName) {
      throw new Error("DATABASE_URL does not point to the declared production database");
    }
    if (
      migration.rowCount !== 1
      || migration.rows[0].migration_name !== requiredEnvironment("EXPECTED_MIGRATION_NAME")
      || migration.rows[0].finished_at === null
      || migration.rows[0].rolled_back_at !== null
    ) {
      throw new Error("Production database migration state is not ready for acceptance");
    }
  } finally {
    await client.end();
  }
}

async function verifyConsentAndCurriculum(connectionString, acceptanceInput, target) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const consent = await client.query(
      `SELECT consent."id", consent."grantedAt"
       FROM "Consent" consent
       WHERE consent."guardianUserId" = $1 AND consent."studentUserId" = $2
         AND consent."policyVersion" = $3 AND consent."policyUrl" = $4
         AND consent."policyDocumentSha256" = $5 AND consent."revokedAt" IS NULL`,
      [
        target.ownerUserId,
        target.studentUserId,
        acceptanceInput.privacyPolicy.version,
        acceptanceInput.privacyPolicy.publicUrl,
        acceptanceInput.privacyPolicy.documentSha256,
      ],
    );
    if (
      consent.rowCount !== 1
      || new Date(consent.rows[0].grantedAt).getTime() < new Date(acceptanceInput.privacyPolicy.guardianAcceptedAt).getTime()
    ) {
      throw new Error("Active guardian consent does not match the exact accepted policy evidence");
    }
    const audit = await client.query(
      `SELECT "metadata" FROM "AuditEvent"
       WHERE "action" = 'STUDENT_CONSENT_GRANTED' AND "resourceId" = $1
       ORDER BY "createdAt" DESC LIMIT 1`,
      [consent.rows[0].id],
    );
    const metadata = audit.rows[0]?.metadata;
    if (
      audit.rowCount !== 1
      || typeof metadata !== "object"
      || metadata === null
      || metadata.policyVersion !== acceptanceInput.privacyPolicy.version
      || metadata.policyUrl !== acceptanceInput.privacyPolicy.publicUrl
      || metadata.policyDocumentSha256 !== acceptanceInput.privacyPolicy.documentSha256
    ) {
      throw new Error("Guardian consent audit evidence is incomplete");
    }
    const contexts = await client.query(
      `SELECT context."subjectCode"::text AS "subjectCode", context."currentUnitId",
              context."status"::text AS "contextStatus", textbook."status"::text AS "textbookStatus",
              unit."status"::text AS "unitStatus"
       FROM "StudentTextbookContext" context
       JOIN "TextbookEdition" textbook ON textbook."id" = context."textbookEditionId"
       JOIN "Unit" unit
         ON unit."id" = context."currentUnitId" AND unit."textbookEditionId" = textbook."id"
       WHERE context."studentUserId" = $1`,
      [target.studentUserId],
    );
    const expectedSubjects = subjectsForGrade(target.studentGrade);
    const actualSubjects = contexts.rows.map((item) => item.subjectCode);
    if (
      contexts.rowCount !== expectedSubjects.length
      || new Set(actualSubjects).size !== expectedSubjects.length
      || expectedSubjects.some((subject) => !actualSubjects.includes(subject))
      || contexts.rows.some((item) =>
        item.currentUnitId === null
        || item.contextStatus !== "CONFIRMED"
        || item.textbookStatus !== "CONFIRMED"
        || item.unitStatus !== "CONFIRMED")
    ) {
      throw new Error("Student does not have one confirmed textbook and actual current unit per required subject");
    }
  } finally {
    await client.end();
  }
}

function loadCredentials(acceptanceInput) {
  const credentials = {
    admin: {
      loginId: requiredEnvironment("REAL_FAMILY_ADMIN_LOGIN_ID"),
      password: requiredPassword("REAL_FAMILY_ADMIN_PASSWORD"),
    },
    owner: {
      loginId: acceptanceInput.family.owner.loginId,
      password: requiredPassword(acceptanceInput.family.owner.passwordEnvironmentName),
    },
    student: {
      loginId: acceptanceInput.family.student.loginId,
      password: requiredPassword(acceptanceInput.family.student.passwordEnvironmentName),
    },
    acceptanceGuardian: {
      loginId: acceptanceInput.family.acceptanceGuardian.loginId,
      password: requiredPassword(acceptanceInput.family.acceptanceGuardian.passwordEnvironmentName),
    },
  };
  const passwords = Object.values(credentials).map((credential) => credential.password);
  if (new Set(passwords).size !== passwords.length) {
    throw new Error("Every production acceptance account must use a distinct password");
  }
  return credentials;
}

async function ensureAcceptanceGuardian({
  apiBaseUrl,
  databaseUrl,
  input: acceptanceInput,
  target,
  adminSession,
  ownerSession,
  credential,
}) {
  if (target.acceptanceGuardianUserId !== null) {
    await ensureRelationActive(
      apiBaseUrl,
      target,
      target.acceptanceGuardianUserId,
      ownerSession,
      `${acceptanceInput.runId}:existing`,
    );
    return target.acceptanceGuardianUserId;
  }
  const material = digest({
    runId: acceptanceInput.runId,
    environment: acceptanceInput.targetEnvironment.name,
    owner: acceptanceInput.family.owner.loginId,
    guardian: acceptanceInput.family.acceptanceGuardian.loginId,
    student: acceptanceInput.family.student.loginId,
  });
  const authorization = await writeRequest({
    apiBaseUrl,
    session: ownerSession,
    path: `/v1/families/${target.familyId}/join-authorizations`,
    body: {
      linkedStudentIds: [target.studentUserId],
      expiresInHours: 1,
      confirmation: "AUTHORIZE_JOIN",
    },
    idempotencyKey: idempotencyKey("real-accept-join-auth", material),
    schema: JoinAuthorizationSchema,
    label: "authorize real guardian join",
  });
  await refreshProof(apiBaseUrl, adminSession, requiredPassword("REAL_FAMILY_ADMIN_PASSWORD"), "administrator");
  const invitation = await writeRequest({
    apiBaseUrl,
    session: adminSession,
    path: "/v1/invitations",
    body: {
      mode: "JOIN_FAMILY",
      authorizationId: authorization.id,
      expiresInHours: 1,
      confirmation: "ISSUE_INVITATION",
    },
    idempotencyKey: idempotencyKey("real-accept-join-invite", material),
    schema: IssuedInvitationSchema,
    label: "issue real guardian join invitation",
  });
  const redeemed = await publicWriteRequest({
    apiBaseUrl,
    path: "/v1/invitations/redeem",
    body: {
      mode: "JOIN_FAMILY",
      token: invitation.token,
      loginId: credential.loginId,
      password: credential.password,
      displayName: acceptanceInput.family.acceptanceGuardian.displayName,
      idempotencyKey: idempotencyKey("real-accept-join-redeem", material),
      confirmation: "JOIN_FAMILY",
    },
    schema: RedeemedInvitationSchema,
    label: "redeem real guardian join invitation",
  });
  if (
    redeemed.familyId !== target.familyId
    || redeemed.accessLevel !== "MEMBER"
    || !redeemed.linkedStudentIds.includes(target.studentUserId)
  ) {
    throw new Error("Real guardian join verification failed");
  }
  const verified = await lookupGuardian(databaseUrl, credential.loginId, target.familyId);
  if (verified === null || verified.userId !== redeemed.userId) {
    throw new Error("Real guardian database readback failed");
  }
  return verified.userId;
}

async function ensureRelationActive(apiBaseUrl, target, guardianUserId, ownerSession, material) {
  const relation = await readRelationState(requiredEnvironment("DATABASE_URL"), target.familyId, guardianUserId, target.studentUserId);
  if (relation) return;
  await writeRequest({
    apiBaseUrl,
    session: ownerSession,
    path: `/v1/families/${target.familyId}/relations/grant`,
    body: { guardianUserId, studentUserId: target.studentUserId, confirmation: "GRANT_RELATION" },
    idempotencyKey: idempotencyKey("real-accept-relation-initial", material),
    schema: mutationResultSchema,
    label: "restore existing real guardian relation before acceptance",
  });
}

async function verifyRoleReads({
  apiBaseUrl,
  input: acceptanceInput,
  target,
  adminSession,
  ownerSession,
  studentSession,
  guardianSession,
}) {
  const contextPath = `/v1/students/${target.studentUserId}/textbook-contexts/${acceptanceInput.family.student.subjectCode}`;
  for (const [session, label] of [
    [studentSession, "student"],
    [ownerSession, "owner guardian"],
    [guardianSession, "member guardian"],
    [adminSession, "administrator"],
  ]) {
    const context = await readSuccess(apiBaseUrl, session, contextPath, StudentTextbookContextResponseSchema, label);
    if (context.mode !== "TEXTBOOK_ALIGNED" || context.currentUnit === null) {
      throw new Error(`${label} did not receive the confirmed textbook context`);
    }
  }
  const ownerFamily = await readSuccess(
    apiBaseUrl,
    ownerSession,
    `/v1/families/${target.familyId}`,
    FamilySummarySchema,
    "owner family read",
  );
  if (!ownerFamily.students.some((student) => student.userId === target.studentUserId)) {
    throw new Error("Owner family read omitted the real student");
  }
  const studentFamily = await readSuccess(
    apiBaseUrl,
    studentSession,
    `/v1/families/${target.familyId}`,
    FamilySummarySchema,
    "student family read",
  );
  if (studentFamily.students.length !== 1 || studentFamily.students[0]?.userId !== target.studentUserId) {
    throw new Error("Student family read exceeded the OWN boundary");
  }
  await expectError(apiBaseUrl, adminSession, `/v1/families/${target.familyId}`, 404, "admin household endpoint denial");
}

async function verifyRevocationAndRestore({
  apiBaseUrl,
  databaseUrl,
  input: acceptanceInput,
  target,
  acceptanceGuardianUserId,
  ownerSession,
  guardianSession,
}) {
  const material = digest({
    runId: acceptanceInput.runId,
    environment: acceptanceInput.targetEnvironment.name,
    guardian: acceptanceInput.family.acceptanceGuardian.loginId,
    student: acceptanceInput.family.student.loginId,
  });
  const contextPath = `/v1/students/${target.studentUserId}/textbook-contexts/${acceptanceInput.family.student.subjectCode}`;
  let probeError = null;
  try {
    await writeRequest({
      apiBaseUrl,
      session: ownerSession,
      path: `/v1/families/${target.familyId}/relations/revoke`,
      body: {
        guardianUserId: acceptanceGuardianUserId,
        studentUserId: target.studentUserId,
        confirmation: "REVOKE_RELATION",
      },
      idempotencyKey: idempotencyKey("real-accept-relation-revoke", material),
      schema: mutationResultSchema,
      label: "revoke real guardian relation",
    });
    await expectError(apiBaseUrl, guardianSession, contextPath, 404, "revoked guardian immediate denial");
    const family = await readSuccess(
      apiBaseUrl,
      guardianSession,
      `/v1/families/${target.familyId}`,
      FamilySummarySchema,
      "revoked guardian family read",
    );
    if (family.students.length !== 0) throw new Error("Revoked guardian still received student data");
  } catch (error) {
    probeError = error;
  }
  if (!await readRelationState(
    databaseUrl,
    target.familyId,
    acceptanceGuardianUserId,
    target.studentUserId,
  )) {
    try {
      await writeRequest({
        apiBaseUrl,
        session: ownerSession,
        path: `/v1/families/${target.familyId}/relations/grant`,
        body: {
          guardianUserId: acceptanceGuardianUserId,
          studentUserId: target.studentUserId,
          confirmation: "GRANT_RELATION",
        },
        idempotencyKey: idempotencyKey("real-accept-relation-restore", material),
        schema: mutationResultSchema,
        label: "restore real guardian relation",
      });
    } catch (error) {
      if (!await readRelationState(
        databaseUrl,
        target.familyId,
        acceptanceGuardianUserId,
        target.studentUserId,
      )) {
        throw new Error("Acceptance guardian relation restoration is unconfirmed; stop and escalate immediately", {
          cause: error,
        });
      }
    }
  }
  if (probeError !== null) throw probeError;
  await readSuccess(apiBaseUrl, guardianSession, contextPath, StudentTextbookContextResponseSchema, "restored guardian read");
}

async function verifySessionBoundaries({ apiBaseUrl, databaseUrl, ownerCredential, studentCredential }) {
  const logoutProbe = await authenticatedSession(apiBaseUrl, ownerCredential, "logout probe");
  await logoutStrict(apiBaseUrl, logoutProbe);
  await expectError(apiBaseUrl, logoutProbe, "/v1/auth/me", 401, "logged-out session denial");

  const expiryProbe = await authenticatedSession(apiBaseUrl, studentCredential, "expiry probe");
  await expireExactSession(databaseUrl, expiryProbe);
  await expectError(apiBaseUrl, expiryProbe, "/v1/auth/me", 401, "expired session denial");
}

async function verifyExportBoundary({
  apiBaseUrl,
  input: acceptanceInput,
  target,
  ownerSession,
  studentSession,
  guardianSession,
  adminSession,
}) {
  const exportResult = await writeRequest({
    apiBaseUrl,
    session: ownerSession,
    path: `/v1/families/${target.familyId}/exports`,
    body: { confirmation: "EXPORT_FAMILY_DATA" },
    idempotencyKey: idempotencyKey(
      "real-accept-export",
      `${acceptanceInput.runId}:${acceptanceInput.targetEnvironment.name}`,
    ),
    schema: FamilyExportResponseSchema,
    label: "create short-lived family export",
  });
  const exportLifetimeMs = new Date(exportResult.expiresAt).getTime() - Date.now();
  if (
    exportResult.archive === null
    || exportResult.familyId !== target.familyId
    || exportResult.status !== "READY"
    || exportLifetimeMs < 23 * 60 * 60 * 1_000
    || exportLifetimeMs > 25 * 60 * 60 * 1_000
  ) {
    throw new Error("Owner export did not return a ready scoped archive");
  }
  const archiveStudentIds = exportResult.archive.students.map((student) => student.userId).sort();
  const expectedStudentIds = [...target.familyStudentIds].sort();
  if (JSON.stringify(archiveStudentIds) !== JSON.stringify(expectedStudentIds)) {
    throw new Error("Family export contains missing or cross-family students");
  }
  const serializedArchive = JSON.stringify(exportResult.archive).toLowerCase();
  for (const forbidden of ["password", "sessiontoken", "rawtoken", "invitationtoken", "loginid"]) {
    if (serializedArchive.includes(forbidden)) throw new Error("Family export contains a forbidden credential field");
  }
  const path = `/v1/families/${target.familyId}/exports/${exportResult.id}`;
  await expectError(apiBaseUrl, studentSession, path, 404, "student export denial");
  await expectError(apiBaseUrl, guardianSession, path, 409, "member guardian export denial");
  await expectError(apiBaseUrl, adminSession, path, 404, "administrator export denial");
  return exportResult.id;
}

async function verifyDeletionBoundary({
  apiBaseUrl,
  databaseUrl,
  input,
  target,
  ownerSession,
  studentSession,
  guardianSession,
  adminSession,
}) {
  const before = await deletionSnapshot(databaseUrl, target.familyId);
  if (before.familyStatus !== "ACTIVE") throw new Error("Primary family is not active before deletion boundary verification");
  const path = `/v1/families/${target.familyId}/deletions/family`;
  for (const [session, expectedStatus, label] of [
    [studentSession, 404, "student family deletion denial"],
    [guardianSession, 409, "member guardian family deletion denial"],
    [adminSession, 404, "administrator family deletion denial"],
  ]) {
    await expectWriteError({
      apiBaseUrl,
      session,
      path,
      body: { confirmation: "DELETE_FAMILY" },
      idempotencyKey: idempotencyKey(
        "real-accept-delete-denied",
        `${input.runId}:${label}:${target.familyId}`,
      ),
      expectedStatus,
      label,
    });
  }
  await expectWriteError({
    apiBaseUrl,
    session: ownerSession,
    path,
    body: { confirmation: "BOUNDARY_CHECK_ONLY_DO_NOT_DELETE" },
    idempotencyKey: idempotencyKey(
      "real-accept-delete-confirmation",
      `${input.runId}:${target.familyId}`,
    ),
    expectedStatus: 400,
    label: "owner deletion confirmation guard",
  });
  const after = await deletionSnapshot(databaseUrl, target.familyId);
  if (
    after.familyStatus !== "ACTIVE"
    || after.deletionRequests !== before.deletionRequests
    || after.retentionJobs !== before.retentionJobs
  ) {
    throw new Error("Non-destructive deletion boundary verification changed production deletion state");
  }
}

async function verifyCrossFamilyNonDisclosure({
  apiBaseUrl,
  input: acceptanceInput,
  target,
  ownerSession,
  studentSession,
  guardianSession,
  adminSession,
}) {
  const missingStudentId = randomUUID();
  const actualContext = `/v1/students/${target.otherStudentUserId}/textbook-contexts/${acceptanceInput.crossFamilyProbe.subjectCode}`;
  const missingContext = `/v1/students/${missingStudentId}/textbook-contexts/${acceptanceInput.crossFamilyProbe.subjectCode}`;
  for (const [session, label] of [
    [ownerSession, "owner cross-family context"],
    [studentSession, "student cross-family context"],
    [guardianSession, "member guardian cross-family context"],
  ]) {
    await expectNonDisclosingPair(apiBaseUrl, session, actualContext, missingContext, label);
  }
  await readSuccess(
    apiBaseUrl,
    adminSession,
    actualContext,
    StudentTextbookContextResponseSchema,
    "administrator authorized cross-family context",
  );
  const missingFamilyId = randomUUID();
  for (const [session, label] of [
    [ownerSession, "owner cross-family household"],
    [studentSession, "student cross-family household"],
    [guardianSession, "member guardian cross-family household"],
  ]) {
    await expectNonDisclosingPair(
      apiBaseUrl,
      session,
      `/v1/families/${target.otherFamilyId}`,
      `/v1/families/${missingFamilyId}`,
      label,
    );
  }
}

async function verifyAcceptanceAudit({
  databaseUrl,
  target,
  acceptanceGuardianUserId,
  exportId,
  acceptanceStartedAt,
}) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const events = await client.query(
      `SELECT "action", "resourceId" FROM "AuditEvent"
       WHERE "familyId" = $1 AND "createdAt" >= $2
         AND "action" = ANY($3::text[])`,
      [
        target.familyId,
        acceptanceStartedAt,
        ["GUARDIAN_RELATION_REVOKED", "GUARDIAN_RELATION_GRANTED", "FAMILY_EXPORT_CREATED"],
      ],
    );
    const actions = events.rows.map((event) => event.action);
    if (
      !actions.includes("GUARDIAN_RELATION_REVOKED")
      || !actions.includes("GUARDIAN_RELATION_GRANTED")
      || !events.rows.some((event) => event.action === "FAMILY_EXPORT_CREATED" && event.resourceId === exportId)
    ) {
      throw new Error("Production acceptance audit trail is incomplete");
    }
    const relation = await client.query(
      `SELECT count(*)::int AS count FROM "GuardianStudentRelation"
       WHERE "familyId" = $1 AND "guardianUserId" = $2 AND "studentUserId" = $3
         AND "revokedAt" IS NULL`,
      [target.familyId, acceptanceGuardianUserId, target.studentUserId],
    );
    if (relation.rows[0]?.count !== 1) throw new Error("Acceptance guardian relation was not restored");
  } finally {
    await client.end();
  }
}

async function authenticatedSession(apiBaseUrl, credential, label) {
  const response = await fetchOnce(`${apiBaseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Qinglang-CSRF": "1" },
    body: JSON.stringify(credential),
  }, `${label} login`);
  if (!response.ok) throw new Error(`${label} login failed with HTTP ${String(response.status)}`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) throw new Error(`${label} login returned no session cookie`);
  const payload = parseResponse(
    z.object({ user: CurrentUserSchema }).strict(),
    await response.json(),
    `${label} login`,
  );
  const session = { cookie, proof: "", user: payload.user };
  await refreshProof(apiBaseUrl, session, credential.password, label);
  return session;
}

async function refreshProof(apiBaseUrl, session, password, label) {
  const response = await fetchOnce(`${apiBaseUrl}/v1/auth/reauthenticate`, {
    method: "POST",
    headers: {
      Cookie: session.cookie,
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
    },
    body: JSON.stringify({ password }),
  }, `${label} reauthentication`);
  if (!response.ok) throw new Error(`${label} reauthentication failed with HTTP ${String(response.status)}`);
  const payload = parseResponse(
    z.object({ proof: z.string().min(1), expiresAt: z.iso.datetime() }).strict(),
    await response.json(),
    `${label} reauthentication`,
  );
  session.proof = payload.proof;
}

async function writeRequest({ apiBaseUrl, session, path, body, idempotencyKey: key, schema, label }) {
  const response = await fetchOnce(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Cookie: session.cookie,
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
      "idempotency-key": key,
      "x-reauth-proof": session.proof,
    },
    body: JSON.stringify(body),
  }, label);
  if (!response.ok) throw new Error(`${label} failed with HTTP ${String(response.status)}; do not replay automatically`);
  return parseResponse(schema, await response.json(), label);
}

async function publicWriteRequest({ apiBaseUrl, path, body, schema, label }) {
  const response = await fetchOnce(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Qinglang-CSRF": "1" },
    body: JSON.stringify(body),
  }, label);
  if (!response.ok) throw new Error(`${label} failed with HTTP ${String(response.status)}; do not replay automatically`);
  return parseResponse(schema, await response.json(), label);
}

async function readSuccess(apiBaseUrl, session, path, schema, label) {
  const response = await fetchOnce(`${apiBaseUrl}${path}`, { headers: { Cookie: session.cookie } }, label);
  if (!response.ok) throw new Error(`${label} failed with HTTP ${String(response.status)}`);
  return parseResponse(schema, await response.json(), label);
}

async function expectError(apiBaseUrl, session, path, expectedStatus, label) {
  const response = await fetchOnce(`${apiBaseUrl}${path}`, { headers: { Cookie: session.cookie } }, label);
  return parseExpectedError(response, expectedStatus, label);
}

async function expectWriteError({ apiBaseUrl, session, path, body, idempotencyKey: key, expectedStatus, label }) {
  const response = await fetchOnce(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Cookie: session.cookie,
      "Content-Type": "application/json",
      "X-Qinglang-CSRF": "1",
      "idempotency-key": key,
      "x-reauth-proof": session.proof,
    },
    body: JSON.stringify(body),
  }, label);
  return parseExpectedError(response, expectedStatus, label);
}

async function parseExpectedError(response, expectedStatus, label) {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} returned HTTP ${String(response.status)} instead of ${String(expectedStatus)}`);
  }
  return parseResponse(ErrorEnvelopeSchema, await response.json(), label).error;
}

async function expectNonDisclosingPair(apiBaseUrl, session, actualPath, missingPath, label) {
  const actual = await expectError(apiBaseUrl, session, actualPath, 404, `${label} actual target`);
  const missing = await expectError(apiBaseUrl, session, missingPath, 404, `${label} missing target`);
  if (actual.code !== missing.code || actual.message !== missing.message || actual.code !== "RESOURCE_NOT_FOUND") {
    throw new Error(`${label} exposed an enumerable authorization difference`);
  }
}

async function fetchOnce(url, init, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new Error(`${label} transport result is unknown; inspect the original operation before any rerun`);
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyPublishedPolicy(publicUrl, expectedSha256) {
  const response = await fetchOnce(publicUrl, { redirect: "error" }, "published privacy policy");
  if (!response.ok) throw new Error(`Published privacy policy returned HTTP ${String(response.status)}`);
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
    throw new Error("Published privacy policy exceeds the 2 MB acceptance limit");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 2_000_000 || digestBytes(bytes) !== expectedSha256) {
    throw new Error("Published privacy policy bytes do not match the guardian-accepted SHA-256");
  }
}

async function verifyHealthReadiness(apiBaseUrl) {
  const response = await fetchOnce(`${apiBaseUrl}/v1/health/ready`, {}, "production readiness");
  const schema = z.object({
    status: z.literal("ok"),
    service: z.literal("api"),
    version: z.string(),
    checks: z.object({ database: z.literal("ok"), migrations: z.literal("ok") }).strict(),
  }).strict();
  if (!response.ok) throw new Error(`Production readiness returned HTTP ${String(response.status)}`);
  parseResponse(schema, await response.json(), "production readiness");
}

function parseResponse(schema, value, label) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`${label} returned an invalid response without exposing its body`);
  return parsed.data;
}

async function logoutStrict(apiBaseUrl, session) {
  const response = await fetchOnce(`${apiBaseUrl}/v1/auth/logout`, {
    method: "POST",
    headers: { Cookie: session.cookie, "X-Qinglang-CSRF": "1" },
  }, "logout probe");
  if (response.status !== 204) throw new Error(`Logout probe returned HTTP ${String(response.status)}`);
}

async function logout(apiBaseUrl, session) {
  await fetchOnce(`${apiBaseUrl}/v1/auth/logout`, {
    method: "POST",
    headers: { Cookie: session.cookie, "X-Qinglang-CSRF": "1" },
  }, "acceptance cleanup logout").catch(() => undefined);
}

async function expireExactSession(connectionString, session) {
  const separator = session.cookie.indexOf("=");
  if (separator <= 0) throw new Error("Expiry probe session cookie is malformed");
  const rawToken = session.cookie.slice(separator + 1);
  const tokenHash = createHash("sha256").update(rawToken, "utf8").digest("hex");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `UPDATE "Session" SET "expiresAt" = $2
       WHERE "tokenHash" = $1 AND "revokedAt" IS NULL`,
      [tokenHash, new Date(Date.now() - 1_000)],
    );
    if (result.rowCount !== 1) throw new Error("Could not expire the exact probe session");
  } finally {
    await client.end();
  }
}

async function deletionSnapshot(connectionString, familyId) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT family."status"::text AS "familyStatus",
              (SELECT count(*)::int FROM "DeletionRequest" WHERE "familyId" = family."id") AS "deletionRequests",
              (SELECT count(*)::int FROM "RetentionJob"
               WHERE "payload"->>'familyId' = family."id"::text) AS "retentionJobs"
       FROM "Family" family WHERE family."id" = $1`,
      [familyId],
    );
    if (result.rowCount !== 1) throw new Error("Primary family disappeared during deletion boundary verification");
    return result.rows[0];
  } finally {
    await client.end();
  }
}

async function databaseTimestamp(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query("SELECT CURRENT_TIMESTAMP AS now");
    const timestamp = result.rows[0]?.now;
    if (!(timestamp instanceof Date)) throw new Error("Could not read the production database timestamp");
    return timestamp;
  } finally {
    await client.end();
  }
}

async function lookupGuardian(connectionString, loginId, familyId) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT guardian."id" AS "userId" FROM "User" guardian
       JOIN "FamilyMembership" membership
         ON membership."userId" = guardian."id" AND membership."familyId" = $2
        AND membership."role" = 'GUARDIAN' AND membership."accessLevel" = 'MEMBER'
        AND membership."revokedAt" IS NULL
       WHERE guardian."loginId" = $1 AND guardian."status" = 'ACTIVE'`,
      [loginId, familyId],
    );
    return result.rowCount === 1 ? result.rows[0] : null;
  } finally {
    await client.end();
  }
}

async function readRelationState(connectionString, familyId, guardianUserId, studentUserId) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT 1 FROM "GuardianStudentRelation"
       WHERE "familyId" = $1 AND "guardianUserId" = $2 AND "studentUserId" = $3
         AND "revokedAt" IS NULL`,
      [familyId, guardianUserId, studentUserId],
    );
    return result.rowCount === 1;
  } finally {
    await client.end();
  }
}

function assertRole(user, expectedRole, expectedFamilyId) {
  if (user.roles.length !== 1 || user.roles[0] !== expectedRole || user.activeFamilyId !== expectedFamilyId) {
    throw new Error(`${expectedRole} production role resolution failed`);
  }
}

function subjectsForGrade(grade) {
  const common = ["CHINESE", "MATH", "ENGLISH", "MORALITY", "HISTORY"];
  if (grade === 7) return common;
  if (grade === 8) return [...common, "PHYSICS"];
  return [...common, "PHYSICS", "CHEMISTRY"];
}

function idempotencyKey(prefix, material) {
  return `${prefix}:${digest(material).slice(0, 40)}`;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function digestBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
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
