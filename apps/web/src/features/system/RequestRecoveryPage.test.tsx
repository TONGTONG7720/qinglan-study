import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestRecoveryCoordinator } from "./RequestRecoveryCoordinator";
import { RequestRecoveryPage } from "./RequestRecoveryPage";

function LocationProbe() {
  const location = useLocation();
  const state: unknown = location.state;
  const from = typeof state === "object" && state !== null && "from" in state
    ? String(state.from)
    : "none";
  return <p>{`${location.pathname}|${from}`}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request recovery pages", () => {
  it("sends an expired session to login with only the safe return target", () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: "/session-expired",
        state: { from: "/student/learn?subject=MATH", reason: "SESSION_EXPIRED", rawError: "hidden" },
      }]}>
        <Routes>
          <Route element={<RequestRecoveryPage kind="session-expired" />} path="/session-expired" />
          <Route element={<LocationProbe />} path="/login" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "会话已过期" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /重新登录/u }));
    expect(screen.getByText("/login|/student/learn?subject=MATH")).toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("requires a manual action before retrying a timed-out safe read", () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: "/error-recovery",
        state: { from: "/student/today", reason: "TIMEOUT", retryAfterSeconds: null },
      }]}>
        <Routes>
          <Route element={<RequestRecoveryPage kind="error" />} path="/error-recovery" />
          <Route element={<h1>今日学习重试目标</h1>} path="/student/today" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("SAFE_READ_TIMEOUT")).toBeInTheDocument();
    expect(screen.getByText(/没有自动重试/u)).toBeInTheDocument();
    expect(screen.queryByText("今日学习重试目标")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /手工重试安全读取/u }));
    expect(screen.getByRole("heading", { level: 1, name: "今日学习重试目标" })).toBeInTheDocument();
  });

  it("honors Retry-After copy without scheduling an automatic retry", () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: "/error-recovery",
        state: { from: "/student/learn", reason: "RATE_LIMITED", retryAfterSeconds: 12 },
      }]}>
        <Routes>
          <Route element={<RequestRecoveryPage kind="error" />} path="/error-recovery" />
          <Route element={<h1>课程重试目标</h1>} path="/student/learn" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("RATE_LIMITED")).toBeInTheDocument();
    expect(screen.getByText(/至少等待 12 秒/u)).toBeInTheDocument();
    expect(screen.queryByText("课程重试目标")).not.toBeInTheDocument();
  });

  it("does not leave the offline page until the user retries after the browser reports online", () => {
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={[{
        pathname: "/offline",
        state: { from: "/student/today", reason: "OFFLINE", retryAfterSeconds: null },
      }]}>
        <Routes>
          <Route element={<RequestRecoveryPage kind="offline" />} path="/offline" />
          <Route element={<h1>在线目标</h1>} path="/student/today" />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /手工重新检查/u }));
    expect(screen.getByText(/仍处于离线状态/u)).toBeInTheDocument();
    expect(screen.queryByText("在线目标")).not.toBeInTheDocument();

    online.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /手工重新检查/u }));
    expect(screen.getByRole("heading", { level: 1, name: "在线目标" })).toBeInTheDocument();
  });

  it("moves an active page to offline on the browser offline event without auto-returning", async () => {
    render(
      <MemoryRouter initialEntries={["/student/today"]}>
        <RequestRecoveryCoordinator />
        <Routes>
          <Route element={<h1>今日学习内容</h1>} path="/student/today" />
          <Route element={<RequestRecoveryPage kind="offline" />} path="/offline" />
        </Routes>
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByRole("heading", { level: 1, name: "当前处于离线状态" })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByRole("heading", { level: 1, name: "当前处于离线状态" })).toBeInTheDocument();
    expect(screen.getByText(/网络可能已恢复/u)).toBeInTheDocument();
  });
});
