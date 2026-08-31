import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { demoStudentHomeSnapshot } from "./demo-data";
import { StudentHomeView } from "./StudentHomePage";

describe("student home page", () => {
  it("renders the daily plan and changes the selected task", () => {
    render(
      <MemoryRouter initialEntries={["/student/today"]}>
        <StudentHomeView currentUser={{ status: "anonymous" }} snapshot={demoStudentHomeSnapshot} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "早安，开发演示同学" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "今日学习" })).toBeInTheDocument();
    expect(screen.getByText("开发演示数据")).toBeInTheDocument();

    const secondTask = screen.getByRole("button", { name: /《桃花源记》阅读与赏析/u });
    expect(secondTask).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(secondTask);
    expect(secondTask).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "继续学习" }));
    expect(secondTask).toHaveAttribute("aria-pressed", "true");
  });

  it("links the home page to the existing course materials route", () => {
    render(
      <MemoryRouter initialEntries={["/student/today"]}>
        <StudentHomeView currentUser={{ status: "anonymous" }} snapshot={demoStudentHomeSnapshot} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("link", { name: "课程与资料" })[0]).toHaveAttribute(
      "href",
      "/student/learn",
    );
    expect(screen.getByRole("link", { name: /查看家庭支持边界/u })).toHaveAttribute("href", "/guardian/overview");
  });
});
