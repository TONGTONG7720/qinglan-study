import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "./app";

describe("application route contract", () => {
  it("opens the real login route", async () => {
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { level: 1, name: /持之以恒\s*水滴石穿/u })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "欢迎回来" })).toBeInTheDocument();
  });

  it("marks invitation validation and password recovery unavailable in the read-only Beta", async () => {
    render(<MemoryRouter initialEntries={["/login"]}><App releaseScope="READ_ONLY_BETA" /></MemoryRouter>);
    expect(await screen.findByRole("heading", { level: 2, name: "欢迎回来" })).toBeInTheDocument();
    expect(screen.getByText("密码找回暂未开放")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/邀请验证暂未开放/u)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "忘记密码？" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "验证邀请" })).not.toBeInTheDocument();
  });

  it("keeps unknown paths inside the non-disclosing system boundary", () => {
    render(<MemoryRouter initialEntries={["/private/unknown-object"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: "无法打开此内容" })).toBeInTheDocument();
    expect(screen.queryByText(/404|403|FORBIDDEN|NOT_FOUND/u)).not.toBeInTheDocument();
  });

  it("registers guardian and admin production paths without rendering fixture records", () => {
    const guardian = render(<MemoryRouter initialEntries={["/guardian/overview"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: "家长概览" })).toBeInTheDocument();
    expect(screen.getByText("真实数据服务")).toBeInTheDocument();
    guardian.unmount();

    render(<MemoryRouter initialEntries={["/admin/ai-error-cases/demo-case"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: "AI 错误案例详情" })).toBeInTheDocument();
    expect(screen.queryByText("快速辅导超时")).not.toBeInTheDocument();
  });

  it("limits production Beta routes and view-query deep links to a generic not-yet-open boundary", () => {
    for (const path of [
      "/guardian/overview",
      "/admin/ai-error-cases/case-opaque",
      "/student/practice",
      "/student/today?view=plans",
      "/student/learn?view=practice-hub",
      "/invite/validate",
    ]) {
      const page = render(
        <MemoryRouter initialEntries={[path]}>
          <App releaseScope="READ_ONLY_BETA" />
        </MemoryRouter>,
      );
      expect(screen.getByRole("heading", { level: 1, name: "此功能暂未开放" })).toBeInTheDocument();
      expect(screen.getByText(/仅开放登录、本人今日学习、课程与教材概览/u)).toBeInTheDocument();
      expect(screen.queryByText(/家长概览|AI 错误案例详情|练习中心/u)).not.toBeInTheDocument();
      page.unmount();
    }
  });

  it("keeps the two base student read routes inside the Beta scope", () => {
    const page = render(
      <MemoryRouter initialEntries={["/student/learn?subject=MATH"]}>
        <App releaseScope="READ_ONLY_BETA" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("heading", { level: 1, name: "此功能暂未开放" })).not.toBeInTheDocument();
    page.unmount();

    render(
      <MemoryRouter initialEntries={["/student/today"]}>
        <App releaseScope="READ_ONLY_BETA" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("heading", { level: 1, name: "此功能暂未开放" })).not.toBeInTheDocument();
  });
});
