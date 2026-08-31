import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/u),
}).strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
