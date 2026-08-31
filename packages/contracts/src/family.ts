import { z } from "zod";

import { AccessLevelSchema, GradeSchema, RoleSchema } from "./identity.js";

const UuidSchema = z.uuid();
const LoginIdSchema = z.string().trim().min(3).max(120);
const PasswordSchema = z.string().min(12).max(128);
const DisplayNameSchema = z.string().trim().min(1).max(60);
const InvitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const HoursSchema = z.number().int().min(1).max(168);

export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

const LinkedStudentIdsSchema = z
  .array(UuidSchema)
  .min(1)
  .max(30)
  .refine((ids) => new Set(ids).size === ids.length, "linkedStudentIds must be unique");

const NewFamilyInvitationInputSchema = z
  .object({
    mode: z.literal("NEW_FAMILY"),
    expiresInHours: HoursSchema,
    confirmation: z.literal("ISSUE_INVITATION"),
  })
  .strict();

const JoinFamilyInvitationInputSchema = z
  .object({
    mode: z.literal("JOIN_FAMILY"),
    authorizationId: UuidSchema,
    expiresInHours: HoursSchema,
    confirmation: z.literal("ISSUE_INVITATION"),
  })
  .strict();

export const IssueInvitationInputSchema = z.discriminatedUnion("mode", [
  NewFamilyInvitationInputSchema,
  JoinFamilyInvitationInputSchema,
]);
export type IssueInvitationInput = z.infer<typeof IssueInvitationInputSchema>;

export const RevokeInvitationInputSchema = z
  .object({ confirmation: z.literal("REVOKE_INVITATION") })
  .strict();
export type RevokeInvitationInput = z.infer<typeof RevokeInvitationInputSchema>;

export const CreateJoinAuthorizationInputSchema = z
  .object({
    linkedStudentIds: LinkedStudentIdsSchema,
    expiresInHours: HoursSchema,
    confirmation: z.literal("AUTHORIZE_JOIN"),
  })
  .strict();
export type CreateJoinAuthorizationInput = z.infer<typeof CreateJoinAuthorizationInputSchema>;

const RedeemAccountSchema = {
  token: InvitationTokenSchema,
  loginId: LoginIdSchema,
  password: PasswordSchema,
  displayName: DisplayNameSchema,
  idempotencyKey: IdempotencyKeySchema,
};

const RedeemNewFamilyInvitationInputSchema = z
  .object({
    ...RedeemAccountSchema,
    mode: z.literal("NEW_FAMILY"),
    familyName: z.string().trim().min(1).max(80),
    confirmation: z.literal("CREATE_FAMILY"),
  })
  .strict();

const RedeemJoinFamilyInvitationInputSchema = z
  .object({
    ...RedeemAccountSchema,
    mode: z.literal("JOIN_FAMILY"),
    confirmation: z.literal("JOIN_FAMILY"),
  })
  .strict();

export const RedeemInvitationInputSchema = z.discriminatedUnion("mode", [
  RedeemNewFamilyInvitationInputSchema,
  RedeemJoinFamilyInvitationInputSchema,
]);
export type RedeemInvitationInput = z.infer<typeof RedeemInvitationInputSchema>;

export const CreateStudentInputSchema = z
  .object({
    loginId: LoginIdSchema,
    password: PasswordSchema,
    displayName: DisplayNameSchema,
    grade: GradeSchema,
    dailyMinutes: z.number().int().min(10).max(180).default(40),
    schoolName: z.string().trim().min(1).max(120).optional(),
    cohortYear: z.number().int().min(2020).max(2100).optional(),
    confirmation: z.literal("CREATE_STUDENT"),
  })
  .strict();
export type CreateStudentInput = z.infer<typeof CreateStudentInputSchema>;

const ConsentPolicyVersionSchema = z.string().trim().min(1).max(40);

export const GrantStudentConsentInputSchema = z
  .object({
    policyVersion: ConsentPolicyVersionSchema,
    confirmation: z.literal("GRANT_STUDENT_CONSENT"),
  })
  .strict();
export type GrantStudentConsentInput = z.infer<typeof GrantStudentConsentInputSchema>;

export const RevokeStudentConsentInputSchema = z
  .object({
    policyVersion: ConsentPolicyVersionSchema,
    confirmation: z.literal("REVOKE_STUDENT_CONSENT"),
  })
  .strict();
export type RevokeStudentConsentInput = z.infer<typeof RevokeStudentConsentInputSchema>;

export const DisableStudentInputSchema = z
  .object({ confirmation: z.literal("DISABLE_STUDENT") })
  .strict();
export type DisableStudentInput = z.infer<typeof DisableStudentInputSchema>;

export const GrantGuardianRelationInputSchema = z
  .object({
    guardianUserId: UuidSchema,
    studentUserId: UuidSchema,
    confirmation: z.literal("GRANT_RELATION"),
  })
  .strict();
export type GrantGuardianRelationInput = z.infer<typeof GrantGuardianRelationInputSchema>;

export const RevokeGuardianRelationInputSchema = z
  .object({
    guardianUserId: UuidSchema,
    studentUserId: UuidSchema,
    confirmation: z.literal("REVOKE_RELATION"),
  })
  .strict();
export type RevokeGuardianRelationInput = z.infer<typeof RevokeGuardianRelationInputSchema>;

export const RemoveMemberInputSchema = z
  .object({ confirmation: z.literal("REMOVE_MEMBER") })
  .strict();
export type RemoveMemberInput = z.infer<typeof RemoveMemberInputSchema>;

export const LeaveFamilyInputSchema = z
  .object({ confirmation: z.literal("LEAVE_FAMILY") })
  .strict();
export type LeaveFamilyInput = z.infer<typeof LeaveFamilyInputSchema>;

export const ProposeOwnershipTransferInputSchema = z
  .object({
    targetUserId: UuidSchema,
    confirmation: z.literal("PROPOSE_OWNERSHIP_TRANSFER"),
  })
  .strict();
export type ProposeOwnershipTransferInput = z.infer<typeof ProposeOwnershipTransferInputSchema>;

export const AcceptOwnershipTransferInputSchema = z
  .object({ confirmation: z.literal("ACCEPT_OWNERSHIP_TRANSFER") })
  .strict();
export type AcceptOwnershipTransferInput = z.infer<typeof AcceptOwnershipTransferInputSchema>;

export const InvitationSummarySchema = z
  .object({
    id: UuidSchema,
    mode: z.enum(["NEW_FAMILY", "JOIN_FAMILY"]),
    familyId: UuidSchema.nullable(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type InvitationSummary = z.infer<typeof InvitationSummarySchema>;

export const IssuedInvitationSchema = z
  .object({ invitation: InvitationSummarySchema, token: InvitationTokenSchema })
  .strict();
export type IssuedInvitation = z.infer<typeof IssuedInvitationSchema>;

export const RedeemedInvitationSchema = z
  .object({
    userId: UuidSchema,
    familyId: UuidSchema,
    accessLevel: AccessLevelSchema,
    linkedStudentIds: z.array(UuidSchema),
  })
  .strict();
export type RedeemedInvitation = z.infer<typeof RedeemedInvitationSchema>;

export const JoinAuthorizationSchema = z
  .object({
    id: UuidSchema,
    familyId: UuidSchema,
    linkedStudentIds: LinkedStudentIdsSchema,
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type JoinAuthorization = z.infer<typeof JoinAuthorizationSchema>;

export const StudentSummarySchema = z
  .object({
    userId: UuidSchema,
    displayName: DisplayNameSchema,
    grade: GradeSchema,
    dailyMinutes: z.number().int().min(10).max(180),
    status: z.enum(["ACTIVE", "DISABLED"]),
  })
  .strict();
export type StudentSummary = z.infer<typeof StudentSummarySchema>;

export const StudentConsentSchema = z
  .object({
    id: UuidSchema,
    guardianUserId: UuidSchema,
    studentUserId: UuidSchema,
    policyVersion: ConsentPolicyVersionSchema,
    grantedAt: z.iso.datetime(),
    revokedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type StudentConsent = z.infer<typeof StudentConsentSchema>;

export const FamilyMemberSchema = z
  .object({
    userId: UuidSchema,
    displayName: DisplayNameSchema,
    role: RoleSchema,
    accessLevel: AccessLevelSchema.nullable(),
  })
  .strict();
export type FamilyMember = z.infer<typeof FamilyMemberSchema>;

export const FamilySummarySchema = z
  .object({
    id: UuidSchema,
    name: z.string().trim().min(1).max(80),
    members: z.array(FamilyMemberSchema),
    students: z.array(StudentSummarySchema),
  })
  .strict();
export type FamilySummary = z.infer<typeof FamilySummarySchema>;

export const OwnershipTransferSchema = z
  .object({
    id: UuidSchema,
    familyId: UuidSchema,
    proposedByUserId: UuidSchema,
    targetUserId: UuidSchema,
    status: z.enum(["PENDING", "ACCEPTED", "CANCELLED", "EXPIRED"]),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type OwnershipTransfer = z.infer<typeof OwnershipTransferSchema>;
