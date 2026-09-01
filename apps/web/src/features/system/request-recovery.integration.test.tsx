import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../app";

const studentId = "a0000000-0000-4000-8000-000000000002";
const currentUser = {
  id: studentId,
  displayName: "真实学生",
  roles: ["STUDENT"],
  activeFamilyId: null,
};
const plan = {
  id: "a0000000-0000-4000-8000-000000000001",
  studentUserId: studentId,
  learningDay: "2026-09-01",
  totalMinutes: 20,
  tasks: [{
    id: "a0000000-0000-4000-8000-000000000003",
    sourceType: "CURRENT_UNIT",
    sourceId: "real-unit",
    title: "后端计划任务",
    estimatedMinutes: 20,
    ordinal: 1,
    status: "PENDING",
  }],
};
const mathContext = {
  mode: "GENERIC_GUIDANCE",
  studentUserId: studentId,
  subjectCode: "MATH",
  grade: 7,
  hasPendingSubmission: false,
};

function json(payload: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(headers)) },
  });
}

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("page request recovery integration", () => {
  it("routes an authenticated data-read 401 to session recovery", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = requestPath(input);
      if (path.endsWith("/v1/auth/me")) return Promise.resolve(json(currentUser));
      if (path.endsWith("/daily-plans/today")) return Promise.resolve(json({}, 401));
      return Promise.resolve(json(mathContext));
    }));

    render(<MemoryRouter initialEntries={["/student/today"]}><App releaseScope="READ_ONLY_BETA" /></MemoryRouter>);

    expect(await screen.findByRole("heading", { level: 1, name: "会话已过期" })).toBeInTheDocument();
    expect(screen.getByText(/旧页面数据已卸载/u)).toBeInTheDocument();
  });

  it("routes a confirmed offline course read to the offline recovery page", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation((input) => {
      if (requestPath(input).endsWith("/v1/auth/me")) return Promise.resolve(json(currentUser));
      return Promise.reject(new TypeError("offline"));
    }));

    render(<MemoryRouter initialEntries={["/student/learn"]}><App releaseScope="READ_ONLY_BETA" /></MemoryRouter>);

    expect(await screen.findByRole(
      "heading",
      { level: 1, name: "当前处于离线状态" },
      { timeout: 3_000 },
    )).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /手工重新检查/u })).toBeInTheDocument();
  });

  it("routes 429 and Retry-After metadata to manual error recovery", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = requestPath(input);
      if (path.endsWith("/v1/auth/me")) return Promise.resolve(json(currentUser));
      if (path.endsWith("/daily-plans/today")) return Promise.resolve(json({}, 429, { "retry-after": "6" }));
      return Promise.resolve(json(mathContext));
    }));

    render(<MemoryRouter initialEntries={["/student/today"]}><App releaseScope="READ_ONLY_BETA" /></MemoryRouter>);

    expect(await screen.findByText("RATE_LIMITED")).toBeInTheDocument();
    expect(screen.getByText(/至少等待 6 秒/u)).toBeInTheDocument();
  });

  it("retries a failed safe read only after the user clicks the recovery action", async () => {
    let planReads = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = requestPath(input);
      if (path.endsWith("/v1/auth/me")) return Promise.resolve(json(currentUser));
      if (path.endsWith("/daily-plans/today")) {
        planReads += 1;
        return Promise.resolve(planReads === 1 ? json({}, 503) : json(plan));
      }
      return Promise.resolve(json(mathContext));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter initialEntries={["/student/today"]}><App releaseScope="READ_ONLY_BETA" /></MemoryRouter>);

    expect(await screen.findByText("SERVICE_UNAVAILABLE")).toBeInTheDocument();
    expect(planReads).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /手工重试安全读取/u }));
    expect((await screen.findAllByText("后端计划任务")).length).toBeGreaterThanOrEqual(1);
    expect(planReads).toBe(2);
  });
});
