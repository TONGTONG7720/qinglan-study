import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ReleaseScopeProvider } from "../config/release-scope";
import { Sidebar } from "./Sidebar";

const anonymous = { status: "anonymous" } as const;

describe("Sidebar release scope", () => {
  it("shows only the two read-only student destinations in the Beta", () => {
    render(
      <MemoryRouter>
        <ReleaseScopeProvider scope="READ_ONLY_BETA">
          <Sidebar currentUser={anonymous} demoActive={false} />
        </ReleaseScopeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("邀请制只读 Beta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "今日学习" })).toHaveAttribute("href", "/student/today");
    expect(screen.getByRole("link", { name: "课程与资料" })).toHaveAttribute("href", "/student/learn");
    expect(screen.queryByRole("link", { name: "AI 辅导" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "错题复习" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "考试与评估" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "家庭周报" })).not.toBeInTheDocument();
  });
});
