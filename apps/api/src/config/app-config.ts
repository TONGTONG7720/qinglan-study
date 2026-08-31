import { z } from "zod";

const AppConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://127.0.0.1:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    )
    .pipe(z.array(z.url()).min(1)),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

function addProductionIssue(
  context: z.RefinementCtx,
  path: string,
  message: string,
): void {
  context.addIssue({ code: "custom", path: [path], message });
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
      SESSION_COOKIE_NAME: z.string().trim().min(1),
      SESSION_COOKIE_SECURE: z.literal("true"),
      REAUTH_PROOF_SECRET: z.string().min(32),
      INVITATION_TOKEN_SECRET: z.string().min(32),
      EXPECTED_MIGRATION_NAME: z.string().regex(/^\d{14}_[a-z0-9_]+$/u),
      MODEL_PROVIDER: z.enum(["disabled", "openai-compatible"]),
      MODEL_BASE_URL: z.string().trim().optional(),
      MODEL_API_KEY: z.string().optional(),
      MODEL_NAME: z.string().trim().optional(),
      MODEL_REASONING_EFFORT: z
        .enum(["none", "low", "medium", "high", "xhigh", "max"])
        .optional(),
      MODEL_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).optional(),
      MODEL_COST_FEN_PER_CALL: z.coerce.number().int().positive().max(1_000_000).optional(),
      PRODUCTION_SMOKE_TEST: z.enum(["true", "false"]).default("false"),
    })
    .superRefine((value, context) => {
      let databaseUrl: URL | undefined;
      try {
        databaseUrl = new URL(value.DATABASE_URL);
      } catch {
        addProductionIssue(context, "DATABASE_URL", "DATABASE_URL must be a valid PostgreSQL URL");
      }
      if (
        databaseUrl !== undefined
        && !new Set(["postgresql:", "postgres:"]).has(databaseUrl.protocol)
      ) {
        addProductionIssue(context, "DATABASE_URL", "DATABASE_URL must use PostgreSQL");
      }
      if (
        databaseUrl !== undefined
        && new Set(["postgres", "root", "study", "qinglang_admin", "qinglang_migrator"])
          .has(decodeURIComponent(databaseUrl.username))
      ) {
        addProductionIssue(
          context,
          "DATABASE_URL",
          "the API must use a dedicated least-privilege database account",
        );
      }
      if (
        databaseUrl !== undefined
        && (
          decodeURIComponent(databaseUrl.username).length === 0
          || decodeURIComponent(databaseUrl.password).length < 20
        )
      ) {
        addProductionIssue(
          context,
          "DATABASE_URL",
          "the production database URL must contain a named account and strong password",
        );
      }
      if (!value.SESSION_COOKIE_NAME.startsWith("__Host-")) {
        addProductionIssue(
          context,
          "SESSION_COOKIE_NAME",
          "production cookies must use the __Host- prefix",
        );
      }
      if (value.MODEL_PROVIDER === "openai-compatible") {
        if (value.MODEL_BASE_URL === undefined) {
          addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL is required");
        } else {
          try {
            const providerUrl = new URL(value.MODEL_BASE_URL);
            const smokeLoopback = value.PRODUCTION_SMOKE_TEST === "true"
              && providerUrl.protocol === "http:"
              && new Set(["127.0.0.1", "localhost"]).has(providerUrl.hostname);
            if (providerUrl.protocol !== "https:" && !smokeLoopback) {
              addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL must use HTTPS");
            }
          } catch {
            addProductionIssue(context, "MODEL_BASE_URL", "MODEL_BASE_URL must be a valid URL");
          }
        }
        if ((value.MODEL_API_KEY?.length ?? 0) < 20) {
          addProductionIssue(context, "MODEL_API_KEY", "MODEL_API_KEY must contain at least 20 characters");
        }
        if ((value.MODEL_NAME?.length ?? 0) === 0) {
          addProductionIssue(context, "MODEL_NAME", "MODEL_NAME is required");
        }
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

  const smokeTest = parsedProduction.data.PRODUCTION_SMOKE_TEST === "true";
  for (const origin of config.ALLOWED_ORIGINS) {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.origin !== origin) {
      throw new Error("ALLOWED_ORIGINS entries must be origins without paths or query strings");
    }
    if (parsedOrigin.protocol !== "https:") {
      throw new Error("ALLOWED_ORIGINS must use HTTPS in production");
    }
    if (!smokeTest && new Set(["127.0.0.1", "localhost", "::1"]).has(parsedOrigin.hostname)) {
      throw new Error("loopback ALLOWED_ORIGINS are only valid during an explicit smoke test");
    }
  }
}

export function readAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const config = AppConfigSchema.parse(environment);
  validateProductionEnvironment(environment, config);
  return config;
}
