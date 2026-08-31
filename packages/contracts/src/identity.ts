import { z } from "zod";

export const RoleSchema = z.enum(["STUDENT", "GUARDIAN", "ADMIN"]);
export type Role = z.infer<typeof RoleSchema>;

export const AccessLevelSchema = z.enum(["OWNER", "MEMBER"]);
export type AccessLevel = z.infer<typeof AccessLevelSchema>;

export const GradeSchema = z.union([z.literal(7), z.literal(8), z.literal(9)]);
export type Grade = z.infer<typeof GradeSchema>;

export const ScopeSchema = z.enum(["OWN", "LINKED_STUDENT", "FAMILY", "ADMIN_ONLY"]);
export type Scope = z.infer<typeof ScopeSchema>;

export const LoginInputSchema = z
  .object({
    loginId: z.string().trim().min(3).max(120),
    password: z.string().min(12).max(128),
  })
  .strict();
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const ReauthenticateInputSchema = z
  .object({ password: z.string().min(12).max(128) })
  .strict();
export type ReauthenticateInput = z.infer<typeof ReauthenticateInputSchema>;

export const SessionPrincipalSchema = z
  .object({
    sessionId: z.uuid(),
    userId: z.uuid(),
    roles: z.array(RoleSchema).min(1),
    activeFamilyId: z.uuid().nullable(),
  })
  .strict();
export type SessionPrincipal = z.infer<typeof SessionPrincipalSchema>;

export const CurrentUserSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().trim().min(1).max(60),
    roles: z.array(RoleSchema).min(1),
    activeFamilyId: z.uuid().nullable(),
  })
  .strict();
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
