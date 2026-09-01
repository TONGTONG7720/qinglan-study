import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(
  import.meta.dirname,
  "../../../prisma/migrations/20260901140000_consent_policy_evidence/migration.sql",
), "utf8");
const onboardingScript = readFileSync(resolve(
  import.meta.dirname,
  "../../../scripts/onboard-real-family.mjs",
), "utf8");
const acceptanceScript = readFileSync(resolve(
  import.meta.dirname,
  "../../../scripts/accept-real-family-production.mjs",
), "utf8");

describe("real-family consent and production acceptance invariants", () => {
  it("keeps legacy consent identifiable while requiring paired HTTPS policy evidence", () => {
    expect(migration).toContain("Consent_policy_evidence_pair_check");
    expect(migration).toContain("policyUrl\" ~ '^https://");
    expect(migration).toContain("policyDocumentSha256\" ~ '^[a-f0-9]{64}$'");
    expect(migration).toContain("Consent_policy_evidence_immutable");
    expect(migration).toContain("Consent policy evidence is immutable once recorded");
    expect(migration).toContain("NULL marks legacy consent without production evidence");
  });

  it("requires Git-external policy bytes and an explicit guardian attestation", () => {
    expect(onboardingScript).toContain("GUARDIAN_ACCEPTED_DISPLAYED_PRIVACY_POLICY");
    expect(onboardingScript).toContain("REAL_FAMILY_GUARDIAN_POLICY_ACCEPTANCE");
    expect(onboardingScript).toContain("Accepted privacy policy evidence must remain outside the repository");
    expect(onboardingScript).toContain("policyDocumentSha256");
  });

  it("keeps production deletion checks non-destructive and reports no identifiers", () => {
    expect(acceptanceScript).toContain("NON_DESTRUCTIVE_ONLY");
    expect(acceptanceScript).toContain("DO_NOT_EXECUTE_REAL_DELETION");
    expect(acceptanceScript).toContain("destructiveDeletionExecuted: false");
    expect(acceptanceScript).toContain("databaseIdentifiersIncluded: false");
    expect(acceptanceScript).toContain("Acceptance guardian relation restoration is unconfirmed");
    expect(acceptanceScript).not.toContain("console.log");
  });
});
