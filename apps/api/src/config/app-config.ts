import { z } from "zod";

const AppConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
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

export function readAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  return AppConfigSchema.parse(environment);
}
