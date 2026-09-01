import {
  HttpError,
  RequestNetworkError,
  RequestTimeoutError,
} from "../../api/http-client";

export type RequestRecoveryReason =
  | "SESSION_EXPIRED"
  | "OFFLINE"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "SERVER_UNAVAILABLE"
  | "NETWORK_FAILURE";

export interface RequestRecoveryState {
  readonly from: string;
  readonly reason: RequestRecoveryReason;
  readonly retryAfterSeconds: number | null;
}

export interface RequestRecoveryDecision extends RequestRecoveryState {
  readonly route: "/session-expired" | "/offline" | "/error-recovery";
}

const recoveryPaths = new Set([
  "/login",
  "/session-expired",
  "/offline",
  "/error-recovery",
  "/limited-release",
]);

export function safeRecoveryPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  const target = new URL(value, "https://request-recovery.invalid");
  return recoveryPaths.has(target.pathname) ? "/" : `${target.pathname}${target.search}${target.hash}`;
}

export function classifyRequestRecovery(error: unknown, from: string): RequestRecoveryDecision | null {
  const safeFrom = safeRecoveryPath(from);
  if (error instanceof HttpError && error.status === 401) {
    return { route: "/session-expired", from: safeFrom, reason: "SESSION_EXPIRED", retryAfterSeconds: null };
  }
  if (error instanceof RequestNetworkError && error.offline) {
    return { route: "/offline", from: safeFrom, reason: "OFFLINE", retryAfterSeconds: null };
  }
  if (error instanceof RequestTimeoutError) {
    return { route: "/error-recovery", from: safeFrom, reason: "TIMEOUT", retryAfterSeconds: null };
  }
  if (error instanceof HttpError && error.status === 429) {
    return {
      route: "/error-recovery",
      from: safeFrom,
      reason: "RATE_LIMITED",
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  if (error instanceof HttpError && error.status >= 500) {
    return { route: "/error-recovery", from: safeFrom, reason: "SERVER_UNAVAILABLE", retryAfterSeconds: null };
  }
  if (error instanceof RequestNetworkError) {
    return { route: "/error-recovery", from: safeFrom, reason: "NETWORK_FAILURE", retryAfterSeconds: null };
  }
  return null;
}

export function parseRequestRecoveryState(value: unknown): RequestRecoveryState | null {
  if (typeof value !== "object" || value === null || !("reason" in value) || !("from" in value)) return null;
  const reason = value.reason;
  if (
    reason !== "SESSION_EXPIRED"
    && reason !== "OFFLINE"
    && reason !== "TIMEOUT"
    && reason !== "RATE_LIMITED"
    && reason !== "SERVER_UNAVAILABLE"
    && reason !== "NETWORK_FAILURE"
  ) return null;
  const retryAfter = "retryAfterSeconds" in value ? value.retryAfterSeconds : null;
  return {
    from: safeRecoveryPath(value.from),
    reason,
    retryAfterSeconds: typeof retryAfter === "number" && Number.isSafeInteger(retryAfter) && retryAfter >= 0
      ? retryAfter
      : null,
  };
}
