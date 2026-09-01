ALTER TABLE "Consent"
ADD COLUMN "policyUrl" VARCHAR(2048),
ADD COLUMN "policyDocumentSha256" CHAR(64);

ALTER TABLE "Consent"
ADD CONSTRAINT "Consent_policy_evidence_pair_check"
CHECK (
  ("policyUrl" IS NULL AND "policyDocumentSha256" IS NULL)
  OR
  (
    "policyUrl" IS NOT NULL
    AND "policyUrl" ~ '^https://[^[:space:]]+$'
    AND "policyDocumentSha256" ~ '^[a-f0-9]{64}$'
  )
);

CREATE FUNCTION "prevent_consent_policy_evidence_reinterpretation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."policyUrl" IS NOT NULL
     AND (
       NEW."policyUrl" IS DISTINCT FROM OLD."policyUrl"
       OR NEW."policyDocumentSha256" IS DISTINCT FROM OLD."policyDocumentSha256"
     ) THEN
    RAISE EXCEPTION 'Consent policy evidence is immutable once recorded'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Consent_policy_evidence_immutable"
BEFORE UPDATE OF "policyUrl", "policyDocumentSha256" ON "Consent"
FOR EACH ROW
EXECUTE FUNCTION "prevent_consent_policy_evidence_reinterpretation"();

COMMENT ON COLUMN "Consent"."policyUrl" IS
'Exact public HTTPS policy document accepted by the guardian; NULL marks legacy consent without production evidence.';

COMMENT ON COLUMN "Consent"."policyDocumentSha256" IS
'SHA-256 of the exact displayed policy document bytes; NULL marks legacy consent without production evidence.';
