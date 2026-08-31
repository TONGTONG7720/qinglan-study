import { z } from "zod";

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(240),
    requestId: z.uuid(),
  }).strict(),
}).strict();

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
