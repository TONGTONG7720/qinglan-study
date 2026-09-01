export const releaseScopes = ["READ_ONLY_BETA", "FULL_PREVIEW"] as const;
export type ReleaseScope = (typeof releaseScopes)[number];

export function resolveReleaseScope(
  mode: string,
  configuredScope: string | undefined,
): ReleaseScope {
  const normalized = configuredScope?.trim();
  if (normalized !== undefined && normalized !== "" && !releaseScopes.includes(normalized as ReleaseScope)) {
    throw new Error(`Unsupported Web release scope: ${normalized}`);
  }

  const requested = normalized === "" || normalized === undefined
    ? mode === "production" ? "READ_ONLY_BETA" : "FULL_PREVIEW"
    : normalized as ReleaseScope;

  if (mode === "production" && requested !== "READ_ONLY_BETA") {
    throw new Error("Production Web builds must use the READ_ONLY_BETA release scope until full vertical services are verified");
  }
  return requested;
}

export function isReadOnlyBetaStudentLocation(value: string): boolean {
  if (!value.startsWith("/")) return false;
  const target = new URL(value, "https://release-scope.invalid");
  if (target.pathname !== "/student/today" && target.pathname !== "/student/learn") return false;
  return !target.searchParams.has("view");
}
