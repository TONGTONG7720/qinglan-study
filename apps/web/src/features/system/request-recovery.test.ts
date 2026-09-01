import { describe, expect, it } from "vitest";

import {
  HttpError,
  RequestNetworkError,
  RequestTimeoutError,
} from "../../api/http-client";
import {
  classifyRequestRecovery,
  parseRequestRecoveryState,
  safeRecoveryPath,
} from "./request-recovery";

describe("request recovery classification", () => {
  it("routes session, offline, timeout, rate limit, server, and network failures", () => {
    expect(classifyRequestRecovery(new HttpError(401, "expired"), "/student/today")).toMatchObject({ route: "/session-expired", reason: "SESSION_EXPIRED" });
    expect(classifyRequestRecovery(new RequestNetworkError(true), "/student/today")).toMatchObject({ route: "/offline", reason: "OFFLINE" });
    expect(classifyRequestRecovery(new RequestTimeoutError(100), "/student/today")).toMatchObject({ route: "/error-recovery", reason: "TIMEOUT" });
    expect(classifyRequestRecovery(new HttpError(429, "limited", 7), "/student/today")).toMatchObject({ route: "/error-recovery", reason: "RATE_LIMITED", retryAfterSeconds: 7 });
    expect(classifyRequestRecovery(new HttpError(503, "down"), "/student/learn")).toMatchObject({ route: "/error-recovery", reason: "SERVER_UNAVAILABLE" });
    expect(classifyRequestRecovery(new RequestNetworkError(false), "/student/learn")).toMatchObject({ route: "/error-recovery", reason: "NETWORK_FAILURE" });
    expect(classifyRequestRecovery(new HttpError(404, "missing"), "/student/today")).toBeNull();
  });

  it("keeps recovery targets local and avoids recovery loops", () => {
    expect(safeRecoveryPath("/student/learn?subject=MATH")).toBe("/student/learn?subject=MATH");
    expect(safeRecoveryPath("https://evil.example/path")).toBe("/");
    expect(safeRecoveryPath("//evil.example/path")).toBe("/");
    expect(safeRecoveryPath("/offline")).toBe("/");
    expect(safeRecoveryPath("/session-expired")).toBe("/");
  });

  it("parses only the minimal non-sensitive recovery state", () => {
    expect(parseRequestRecoveryState({
      from: "/student/today",
      reason: "RATE_LIMITED",
      retryAfterSeconds: 9,
      rawError: "must be ignored",
    })).toEqual({ from: "/student/today", reason: "RATE_LIMITED", retryAfterSeconds: 9 });
    expect(parseRequestRecoveryState({ from: "/student/today", reason: "UNKNOWN" })).toBeNull();
  });
});
