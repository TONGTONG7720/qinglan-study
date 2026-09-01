import { isIP } from "node:net";

import { z } from "zod";

const placeholderPattern = /(change[-_ ]?me|development|example|fictional|local[-_ ]?only|replace|test[-_ ]?only)/iu;
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

const BooleanEnvironmentSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const AppConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
  REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().min(16_384).max(2_000_000).default(256_000),
  CSRF_PROTECTION_ENABLED: BooleanEnvironmentSchema.default(false),
  MODEL_PROVIDER: z.enum(["disabled", "fake", "openai-compatible"]).default("disabled"),
  OBJECT_STORAGE_PROVIDER: z.enum(["disabled", "s3"]).default("disabled"),
  OBJECT_SCAN_PROVIDER: z.enum(["disabled", "clamav"]).default("disabled"),
  EMAIL_PROVIDER: z.literal("disabled").default("disabled"),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://127.0.0.1:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    )
    .pipe(z.array(z.url()).min(1))
    .refine((origins) => new Set(origins).size === origins.length, {
      message: "ALLOWED_ORIGINS entries must be unique",
    }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

function addProductionIssue(
  context: z.RefinementCtx,
  path: string,
  message: string,
): void {
  context.addIssue({ code: "custom", path: [path], message });
}

function hasStrongSecretShape(value: string, minimumLength: number): boolean {
  return value.length >= minimumLength
    && value.length <= 512
    && value.trim() === value
    && !/\s/u.test(value)
    && !placeholderPattern.test(value)
    && new Set(value).size >= 8;
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [first = -1, second = -1] = octets;
  return first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

function isPrivateProviderHost(hostname: string): boolean {
  const normalizedHostname = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (loopbackHosts.has(normalizedHostname)) {
    return true;
  }
  const addressKind = isIP(normalizedHostname);
  if (addressKind === 4) {
    return isPrivateIpv4(normalizedHostname);
  }
  if (addressKind === 6) {
    const normalized = normalizedHostname.toLowerCase();
    return normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:");
  }
  return false;
}

function validateDatabaseUrl(value: string, context: z.RefinementCtx): void {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(value);
  } catch {
    addProductionIssue(context, "DATABASE_URL", "DATABASE_URL must be a valid PostgreSQL URL");
    return;
  }
  if (!new Set(["postgresql:", "postgres:"]).has(databaseUrl.protocol)) {
    addProductionIssue(context, "DATABASE_URL", "DATABASE_URL must use PostgreSQL");
  }
  const username = decodeURIComponent(databaseUrl.username);
  const password = decodeURIComponent(databaseUrl.password);
  if (new Set(["postgres", "root", "study", "qinglang_admin", "qinglang_migrator"])
    .has(username)) {
    addProductionIssue(
      context,
      "DATABASE_URL",
      "the API must use a dedicated least-privilege database account",
    );
  }
  if (username.length === 0 || !hasStrongSecretShape(password, 32)) {
    addProductionIssue(
      context,
      "DATABASE_URL",
      "the production database URL must contain a named account and strong password",
    );
  }
}

function validateProviderUrl(
  value: string,
  smokeTest: boolean,
  context: z.RefinementCtx,
): void {
  let providerUrl: URL;
  try {
    providerUrl = new URL(value);
  } catch {
    addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL must be a valid URL");
    return;
  }
  const smokeLoopback = smokeTest
    && providerUrl.protocol === "http:"
    && loopbackHosts.has(providerUrl.hostname);
  if (providerUrl.protocol !== "https:" && !smokeLoopback) {
    addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL must use HTTPS");
  }
  if (providerUrl.username.length > 0 || providerUrl.password.length > 0) {
    addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL must not contain credentials");
  }
  if (providerUrl.search.length > 0 || providerUrl.hash.length > 0) {
    addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL must not contain query or fragment data");
  }
  if (!smokeTest && isPrivateProviderHost(providerUrl.hostname)) {
    addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL must not target a private address");
  }
}

function validateObjectStorageUrl(
  value: string,
  smokeTest: boolean,
  context: z.RefinementCtx,
): void {
  let storageUrl: URL;
  try {
    storageUrl = new URL(value);
  } catch {
    addProductionIssue(context, "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_ENDPOINT must be a valid URL");
    return;
  }
  const smokeLoopback = smokeTest
    && storageUrl.protocol === "http:"
    && loopbackHosts.has(storageUrl.hostname);
  if (storageUrl.protocol !== "https:" && !smokeLoopback) {
    addProductionIssue(context, "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_ENDPOINT must use HTTPS");
  }
  if (storageUrl.username.length > 0 || storageUrl.password.length > 0) {
    addProductionIssue(context, "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_ENDPOINT must not contain credentials");
  }
  if (storageUrl.search.length > 0 || storageUrl.hash.length > 0) {
    addProductionIssue(context, "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_ENDPOINT must not contain query or fragment data");
  }
}

function validateProductionEnvironment(
  environment: NodeJS.ProcessEnv,
  config: AppConfig,
): void {
  if (config.NODE_ENV !== "production") {
    return;
  }

  const ProductionEnvironmentSchema = z
    .object({
      DATABASE_URL: z.string().trim().min(1),
      SESSION_COOKIE_NAME: z.string().trim().regex(/^__Host-[A-Za-z0-9_-]{1,100}$/u),
      SESSION_COOKIE_SECURE: z.literal("true"),
      REAUTH_PROOF_SECRET: z.string(),
      INVITATION_TOKEN_SECRET: z.string(),
      EXPECTED_MIGRATION_NAME: z.string().regex(/^\d{14}_[a-z0-9_]+$/u),
      REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().min(16_384).max(2_000_000),
      CSRF_PROTECTION_ENABLED: z.literal("true"),
      VITE_ENABLE_DEMO_COURSE_CATALOG: z.literal("false"),
      VITE_QA_DEMO_BUILD: z.literal("false"),
      VITE_RELEASE_SCOPE: z.literal("READ_ONLY_BETA"),
      MODEL_PROVIDER: z.enum(["disabled", "openai-compatible"]),
      OBJECT_STORAGE_PROVIDER: z.enum(["disabled", "s3"]),
      OBJECT_SCAN_PROVIDER: z.enum(["disabled", "clamav"]),
      EMAIL_PROVIDER: z.literal("disabled"),
      MODEL_BASE_URL: z.string().trim().optional(),
      MODEL_API_KEY: z.string().optional(),
      MODEL_NAME: z.string().trim().optional(),
      MODEL_REASONING_EFFORT: z
        .enum(["none", "low", "medium", "high", "xhigh", "max"])
        .optional(),
      MODEL_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).optional(),
      MODEL_COST_FEN_PER_CALL: z.coerce.number().int().positive().max(1_000_000).optional(),
      OBJECT_STORAGE_ENDPOINT: z.string().trim().optional(),
      OBJECT_STORAGE_REGION: z.string().trim().optional(),
      OBJECT_STORAGE_BUCKET: z.string().trim().optional(),
      OBJECT_STORAGE_ACCESS_KEY_ID: z.string().trim().optional(),
      OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
      OBJECT_STORAGE_FORCE_PATH_STYLE: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.enum(["true", "false"]).optional(),
      ),
      OBJECT_STORAGE_UPLOAD_TTL_SECONDS: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.coerce.number().int().min(60).max(900).optional(),
      ),
      OBJECT_STORAGE_READ_TTL_SECONDS: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.coerce.number().int().min(30).max(300).optional(),
      ),
      OBJECT_STORAGE_RETENTION_DAYS: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.coerce.number().int().min(1).max(90).optional(),
      ),
      OBJECT_STORAGE_SSE: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.enum(["none", "AES256"]).optional(),
      ),
      CLAMAV_HOST: z.string().trim().optional(),
      CLAMAV_PORT: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.coerce.number().int().min(1).max(65_535).optional(),
      ),
      CLAMAV_TIMEOUT_MS: z.preprocess(
        (value) => value === "" ? undefined : value,
        z.coerce.number().int().min(1_000).max(60_000).optional(),
      ),
      SMTP_HOST: z.string().trim().optional(),
      SMTP_USERNAME: z.string().trim().optional(),
      SMTP_PASSWORD: z.string().optional(),
      PRODUCTION_SMOKE_TEST: z.enum(["true", "false"]).default("false"),
    })
    .superRefine((value, context) => {
      validateDatabaseUrl(value.DATABASE_URL, context);
      if (!hasStrongSecretShape(value.REAUTH_PROOF_SECRET, 48)) {
        addProductionIssue(context, "REAUTH_PROOF_SECRET", "REAUTH_PROOF_SECRET must be a strong secret");
      }
      if (!hasStrongSecretShape(value.INVITATION_TOKEN_SECRET, 48)) {
        addProductionIssue(
          context,
          "INVITATION_TOKEN_SECRET",
          "INVITATION_TOKEN_SECRET must be a strong secret",
        );
      }
      if (value.REAUTH_PROOF_SECRET === value.INVITATION_TOKEN_SECRET) {
        addProductionIssue(context, "INVITATION_TOKEN_SECRET", "production secrets must be distinct");
      }

      const smokeTest = value.PRODUCTION_SMOKE_TEST === "true";
      if (value.MODEL_PROVIDER === "openai-compatible") {
        if (value.MODEL_BASE_URL === undefined || value.MODEL_BASE_URL.length === 0) {
          addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL is required");
        } else {
          validateProviderUrl(value.MODEL_BASE_URL, smokeTest, context);
        }
        if (value.MODEL_API_KEY === undefined || !hasStrongSecretShape(value.MODEL_API_KEY, 20)) {
          addProductionIssue(context, "MODEL_API_KEY", "MODEL_API_KEY must contain a real provider key");
        }
        if (value.MODEL_NAME === undefined || value.MODEL_NAME.length === 0) {
          addProductionIssue(context, "MODEL_NAME", "MODEL_NAME is required");
        }
        if (value.MODEL_REASONING_EFFORT === undefined) {
          addProductionIssue(context, "MODEL_REASONING_EFFORT", "MODEL_REASONING_EFFORT is required");
        }
        if (value.MODEL_TIMEOUT_MS === undefined) {
          addProductionIssue(context, "MODEL_TIMEOUT_MS", "MODEL_TIMEOUT_MS is required");
        }
        if (value.MODEL_COST_FEN_PER_CALL === undefined) {
          addProductionIssue(context, "MODEL_COST_FEN_PER_CALL", "MODEL_COST_FEN_PER_CALL is required");
        }
      } else if (
        (value.MODEL_BASE_URL?.length ?? 0) > 0
        || (value.MODEL_API_KEY?.length ?? 0) > 0
        || (value.MODEL_NAME?.length ?? 0) > 0
      ) {
        addProductionIssue(context, "MODEL_PROVIDER", "disabled model configuration must not include provider credentials");
      }

      const storageValues = [
        value.OBJECT_STORAGE_ENDPOINT,
        value.OBJECT_STORAGE_REGION,
        value.OBJECT_STORAGE_BUCKET,
        value.OBJECT_STORAGE_ACCESS_KEY_ID,
        value.OBJECT_STORAGE_SECRET_ACCESS_KEY,
        value.OBJECT_STORAGE_FORCE_PATH_STYLE,
        value.OBJECT_STORAGE_UPLOAD_TTL_SECONDS,
        value.OBJECT_STORAGE_READ_TTL_SECONDS,
        value.OBJECT_STORAGE_RETENTION_DAYS,
        value.OBJECT_STORAGE_SSE,
      ];
      const scannerValues = [value.CLAMAV_HOST, value.CLAMAV_PORT, value.CLAMAV_TIMEOUT_MS];
      if (value.OBJECT_STORAGE_PROVIDER === "s3") {
        if (value.OBJECT_STORAGE_ENDPOINT === undefined || value.OBJECT_STORAGE_ENDPOINT.length === 0) {
          addProductionIssue(context, "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_ENDPOINT is required");
        } else {
          validateObjectStorageUrl(value.OBJECT_STORAGE_ENDPOINT, smokeTest, context);
        }
        if (value.OBJECT_STORAGE_REGION === undefined || value.OBJECT_STORAGE_REGION.length === 0) {
          addProductionIssue(context, "OBJECT_STORAGE_REGION", "OBJECT_STORAGE_REGION is required");
        }
        if (
          value.OBJECT_STORAGE_BUCKET === undefined
          || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(value.OBJECT_STORAGE_BUCKET)
        ) {
          addProductionIssue(context, "OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_BUCKET must be a valid private bucket name");
        }
        if (value.OBJECT_STORAGE_ACCESS_KEY_ID === undefined || value.OBJECT_STORAGE_ACCESS_KEY_ID.length < 3) {
          addProductionIssue(context, "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_ACCESS_KEY_ID is required");
        }
        if (
          value.OBJECT_STORAGE_SECRET_ACCESS_KEY === undefined
          || !hasStrongSecretShape(value.OBJECT_STORAGE_SECRET_ACCESS_KEY, 20)
        ) {
          addProductionIssue(context, "OBJECT_STORAGE_SECRET_ACCESS_KEY", "a strong object storage secret is required");
        }
        if (value.OBJECT_STORAGE_FORCE_PATH_STYLE === undefined) {
          addProductionIssue(context, "OBJECT_STORAGE_FORCE_PATH_STYLE", "OBJECT_STORAGE_FORCE_PATH_STYLE is required");
        }
        if (value.OBJECT_STORAGE_UPLOAD_TTL_SECONDS === undefined) {
          addProductionIssue(context, "OBJECT_STORAGE_UPLOAD_TTL_SECONDS", "OBJECT_STORAGE_UPLOAD_TTL_SECONDS is required");
        }
        if (value.OBJECT_STORAGE_READ_TTL_SECONDS === undefined) {
          addProductionIssue(context, "OBJECT_STORAGE_READ_TTL_SECONDS", "OBJECT_STORAGE_READ_TTL_SECONDS is required");
        }
        if (value.OBJECT_STORAGE_RETENTION_DAYS === undefined) {
          addProductionIssue(context, "OBJECT_STORAGE_RETENTION_DAYS", "OBJECT_STORAGE_RETENTION_DAYS is required");
        }
        if (value.OBJECT_STORAGE_SSE !== "AES256") {
          addProductionIssue(context, "OBJECT_STORAGE_SSE", "production object storage must use AES256 server-side encryption");
        }
        if (value.OBJECT_SCAN_PROVIDER !== "clamav") {
          addProductionIssue(context, "OBJECT_SCAN_PROVIDER", "S3 uploads require the ClamAV scanner");
        }
      } else if (storageValues.some((entry) => entry !== undefined && String(entry).length > 0)) {
        addProductionIssue(context, "OBJECT_STORAGE_PROVIDER", "disabled object storage must not include credentials or endpoints");
      }
      if (value.OBJECT_SCAN_PROVIDER === "clamav") {
        if (value.OBJECT_STORAGE_PROVIDER !== "s3") {
          addProductionIssue(context, "OBJECT_SCAN_PROVIDER", "ClamAV requires enabled object storage");
        }
        if (value.CLAMAV_HOST === undefined || value.CLAMAV_HOST.length === 0) {
          addProductionIssue(context, "CLAMAV_HOST", "CLAMAV_HOST is required");
        } else if (
          value.CLAMAV_HOST !== "malware-scanner"
          && !isPrivateProviderHost(value.CLAMAV_HOST)
        ) {
          addProductionIssue(context, "CLAMAV_HOST", "CLAMAV_HOST must remain on the private deployment network");
        }
        if (value.CLAMAV_PORT === undefined) {
          addProductionIssue(context, "CLAMAV_PORT", "CLAMAV_PORT is required");
        }
        if (value.CLAMAV_TIMEOUT_MS === undefined) {
          addProductionIssue(context, "CLAMAV_TIMEOUT_MS", "CLAMAV_TIMEOUT_MS is required");
        }
      } else if (scannerValues.some((entry) => entry !== undefined && String(entry).length > 0)) {
        addProductionIssue(context, "OBJECT_SCAN_PROVIDER", "disabled malware scanning must not include scanner settings");
      }
      if ([value.SMTP_HOST, value.SMTP_USERNAME, value.SMTP_PASSWORD]
        .some((entry) => (entry?.length ?? 0) > 0)) {
        addProductionIssue(
          context,
          "EMAIL_PROVIDER",
          "email delivery is disabled until a production adapter is implemented",
        );
      }
    });

  const parsedProduction = ProductionEnvironmentSchema.safeParse(environment);
  if (!parsedProduction.success) {
    throw parsedProduction.error;
  }
  if (config.API_HOST !== "0.0.0.0") {
    throw new Error("API_HOST must be 0.0.0.0 inside the production container");
  }
  if (config.TRUST_PROXY_HOPS !== 1) {
    throw new Error("TRUST_PROXY_HOPS must be 1 when Caddy is the only trusted proxy");
  }
  if (!config.CSRF_PROTECTION_ENABLED) {
    throw new Error("CSRF protection must be enabled in production");
  }
  if (config.MODEL_PROVIDER === "fake") {
    throw new Error("MODEL_PROVIDER=fake is test-only");
  }
  const smokeTest = parsedProduction.data.PRODUCTION_SMOKE_TEST === "true";
  for (const origin of config.ALLOWED_ORIGINS) {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.origin !== origin
      || parsedOrigin.username.length > 0
      || parsedOrigin.password.length > 0
    ) {
      throw new Error("ALLOWED_ORIGINS entries must be exact origins without credentials, paths, or query strings");
    }
    if (parsedOrigin.protocol !== "https:") {
      throw new Error("ALLOWED_ORIGINS must use HTTPS in production");
    }
    if (!smokeTest && loopbackHosts.has(parsedOrigin.hostname)) {
      throw new Error("loopback ALLOWED_ORIGINS are only valid during an explicit smoke test");
    }
  }
}

export function readAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const config = AppConfigSchema.parse(environment);
  validateProductionEnvironment(environment, config);
  return config;
}
