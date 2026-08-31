import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { demoTaskDetailDocument } from "./demo-data";
import { StudentTaskDetailView } from "./StudentTaskDetailView";

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/student/today?view=task-detail&task=${demoTaskDetailDocument.taskId}`]}>
      <StudentTaskDetailView currentUser={{ status: "anonymous" }} document={demoTaskDetailDocument} overviewUrl="/student/today" />
    </MemoryRouter>,
  );
}

describe("student task detail view", () => {
  it("shows the fixed task, priority, date, duration, and current step", () => {
    renderDetail();
    expect(screen.getByRole("heading", { level: 1, name: "今日任务" })).toBeInTheDocument();
    expect(screen.getByLabelText("今日优先级第一项")).toHaveTextContent("1");
    expect(screen.getByText("2026-08-21")).toBeInTheDocument();
    expect(screen.getByText("Friday")).toBeInTheDocument();
    expect(screen.getByText(/丙午年 七月初九/u)).toBeInTheDocument();
    expect(screen.getAllByText("二次函数的图像与性质").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/第 2 步 \/ 共 4 步/u)).toBeInTheDocument();
    expect(screen.getAllByText(/总时长/u).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/预计.*42 分钟/u).length).toBeGreaterThanOrEqual(1);
  });

  it("keeps Today current in the shared sidebar", () => {
    renderDetail();
    expect(screen.getByRole("link", { name: "今日学习" })).toHaveClass("is-current");
    expect(screen.getByRole("link", { name: "课程与资料" })).not.toHaveClass("is-current");
    expect(screen.getByText("清朗学习")).toBeInTheDocument();
    expect(screen.getByText("INK STUDY ROOM")).toBeInTheDocument();
  });

  it("renders the four-step path with accessible current semantics", () => {
    renderDetail();
    const path = screen.getByRole("list", { name: "四步学习路径" });
    expect(within(path).getByText(/知识导入/u)).toBeInTheDocument();
    expect(within(path).getByText(/例题讲解/u)).toBeInTheDocument();
    expect(within(path).getByText(/随堂练习/u)).toBeInTheDocument();
    expect(within(path).getByText(/归纳总结/u)).toBeInTheDocument();
    expect(within(path).getByText("已完成")).toBeInTheDocument();
    expect(within(path).getByText("当前")).toBeInTheDocument();
    expect(within(path).getAllByText("待开始")).toHaveLength(2);
    expect(path.querySelector('[aria-current="step"]')).toHaveTextContent("例题讲解");
  });

  it("shows the honest completion criteria without mastery or algorithm claims", () => {
    renderDetail();
    const criteria = document.querySelector(".completion-criteria");
    if (!(criteria instanceof HTMLElement)) throw new Error("Completion criteria missing");
    expect(within(criteria).getByText("1 / 4 已完成")).toBeInTheDocument();
    expect(within(criteria).getByText("0 / 5")).toBeInTheDocument();
    expect(within(criteria).getByText("练习后确认")).toBeInTheDocument();
    expect(within(criteria).getByText("0 / 3")).toBeInTheDocument();
    expect(within(criteria).getByText("学习证据与掌握度须由服务端确认。")).toBeInTheDocument();
    expect(screen.queryByText(/掌握度\s*\d+%|推荐置信度|薄弱点/u)).not.toBeInTheDocument();
  });

  it("uses only the continue action as primary and blocks duplicate activation", () => {
    vi.useFakeTimers();
    renderDetail();
    const primaryButtons = document.querySelectorAll(".task-detail-primary .primary-button");
    expect(primaryButtons).toHaveLength(2);
    for (const button of primaryButtons) expect(button).toHaveTextContent("继续例题讲解");
    const topButton = screen.getAllByRole("button", { name: "继续例题讲解" })[0];
    if (topButton === undefined) throw new Error("Continue button missing");
    fireEvent.click(topButton);
    expect(screen.getAllByRole("button", { name: "正在进入…" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "正在进入…" })[0]).toBeDisabled();
    const enteringButton = screen.getAllByRole("button", { name: "正在进入…" })[0];
    if (enteringButton === undefined) throw new Error("Entering button missing");
    fireEvent.click(enteringButton);
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("keeps service, privacy, and evidence boundaries visible", () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    renderDetail();
    expect(screen.getAllByText("TASK_DETAIL_SERVICE_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("进度同步")[0]?.parentElement).toHaveTextContent("未接入");
    expect(screen.getAllByText("完成提交")[0]?.parentElement).toHaveTextContent("未接入");
    expect(screen.getAllByText(/生产环境不得回退到演示任务/u).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/任务、作答与学习证据仅在授权家庭范围内使用/u).length).toBeGreaterThanOrEqual(1);
    expect(storageSpy).not.toHaveBeenCalled();
    storageSpy.mockRestore();
  });

  it("does not change task status when returning or deferring", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "返回今日学习" }));
    expect(demoTaskDetailDocument.taskStatus).toBe("IN_PROGRESS");
  });
});
