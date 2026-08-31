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
});
