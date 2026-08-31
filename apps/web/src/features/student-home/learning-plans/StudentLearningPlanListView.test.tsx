import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { demoLearningPlanListDocument } from "./demo-data";
import { StudentLearningPlanListRoute, StudentLearningPlanListView } from "./StudentLearningPlanListView";
import type { LearningPlanListDocument } from "./types";

function renderPlanList({
  document = demoLearningPlanListDocument,
  initialEntry = "/student/today?view=plans",
  onOpenPlan = vi.fn(),
  onReturnToday = vi.fn(),
}: {
  readonly document?: LearningPlanListDocument;
  readonly initialEntry?: string;
  readonly onOpenPlan?: (planId: string) => void;
  readonly onReturnToday?: () => void;
} = {}) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <StudentLearningPlanListView
        currentUser={{ status: "anonymous" }}
        document={document}
        onOpenPlan={onOpenPlan}
        onReturnToday={onReturnToday}
      />
    </MemoryRouter>,
  );
  return { onOpenPlan, onReturnToday };
}

function planButtons(): HTMLElement[] {
  return screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("data-od-id")?.startsWith("learning-plan-") === true);
}

describe("student learning plan list view", () => {
  it("renders the STU-003 header, sidebar state, date, and derived right rail counts", () => {
    renderPlanList();

    expect(screen.getByRole("heading", { level: 1, name: "学习计划" })).toBeInTheDocument();
    expect(screen.getByText("清朗学习")).toBeInTheDocument();
    expect(screen.getByText("INK STUDY ROOM")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /每日任务/u })).toHaveClass("is-current");
    expect(screen.getByRole("link", { name: "今日学习" })).not.toHaveClass("is-current");
    expect(screen.getByText("Fixture 演示")).toBeInTheDocument();
    expect(screen.getByText("2026-08-21")).toBeInTheDocument();
    expect(screen.getByText("Friday")).toBeInTheDocument();
    expect(screen.getByText(/丙午年 七月初九/u)).toBeInTheDocument();

    expect(screen.getByLabelText("4 份学习计划")).toHaveTextContent("4");
    const rail = screen.getByRole("complementary", { name: "计划与服务信息" });
    expect(within(rail).getByText("全部计划").parentElement).toHaveTextContent("4");
    expect(within(rail).getByText("当前").parentElement).toHaveTextContent("1");
    expect(within(rail).getByText("即将开始").parentElement).toHaveTextContent("2");
    expect(within(rail).getByText("已完成").parentElement).toHaveTextContent("1");
    expect(within(rail).getByText("预计总时长").parentElement).toHaveTextContent("175 分钟");
  });

  it("renders the ledger rows in stable order with exact fixture dates and progress", () => {
    renderPlanList();

    expect(planButtons().map((button) => button.getAttribute("data-od-id"))).toEqual([
      "learning-plan-fixture-plan-math-current",
      "learning-plan-fixture-plan-chinese-upcoming",
      "learning-plan-fixture-plan-english-upcoming",
      "learning-plan-fixture-plan-history-completed",
    ]);

    const math = screen.getByRole("button", { name: /01，数学，二次函数图像学习计划/u });
    expect(math).toHaveTextContent("2 / 5 项");
    expect(math).toHaveTextContent("约 42 分钟");
    expect(math).toHaveTextContent("打开计划");

    expect(screen.getByRole("button", { name: /02，语文/u })).toHaveTextContent("08.22 开始");
    expect(screen.getByRole("button", { name: /03，英语/u })).toHaveTextContent("08.23 开始");
    expect(screen.getByRole("button", { name: /04，历史/u })).toHaveTextContent("当前会话已完成");
    expect(screen.getByText("完成状态是否同步到服务端仍待确认。")).toBeInTheDocument();
  });

  it("filters status and subjects while keeping EMPTY separate from NO_FILTER_RESULTS", () => {
    renderPlanList();

    expect(screen.getByRole("tab", { name: "全部" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "当前" }));
    expect(planButtons()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /二次函数图像学习计划/u })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "即将开始" }));
    expect(planButtons().map((button) => button.textContent)).toEqual([
      expect.stringContaining("《桃花源记》阅读与赏析"),
      expect.stringContaining("Unit 6 Reading & Grammar"),
    ]);

    fireEvent.change(screen.getByLabelText("选择学科"), { target: { value: "CHEMISTRY" } });
    expect(screen.getByText("当前筛选没有计划")).toBeInTheDocument();
    expect(screen.queryByText("还没有学习计划")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(planButtons()).toHaveLength(4);
  });

  it("shows EMPTY when the student has no plans at all", () => {
    renderPlanList({
      document: {
        ...demoLearningPlanListDocument,
        plans: [],
      },
    });

    expect(screen.getByText("还没有学习计划")).toBeInTheDocument();
    expect(screen.queryByText("当前筛选没有计划")).not.toBeInTheDocument();
  });

  it("supports keyboard tab switching and reports filtered result count politely", () => {
    renderPlanList();

    const allTab = screen.getByRole("tab", { name: "全部" });
    fireEvent.keyDown(allTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "当前" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("当前筛选显示 1 份计划。")).toBeInTheDocument();
  });

  it("opens the current plan from the primary action and blocks duplicate triggers", () => {
    vi.useFakeTimers();
    const onOpenPlan = vi.fn();
    renderPlanList({ onOpenPlan });

    fireEvent.click(screen.getByRole("button", { name: "继续当前计划" }));
    const primaryButton = document.querySelector('[data-od-id="continue-current-plan"]');
    if (!(primaryButton instanceof HTMLButtonElement)) {
      throw new Error("Continue current plan button missing");
    }
    expect(primaryButton).toHaveTextContent("正在打开…");
    expect(primaryButton).toBeDisabled();
    for (const button of planButtons()) {
      expect(button).toBeDisabled();
    }

    vi.advanceTimersByTime(160);
    expect(onOpenPlan).toHaveBeenCalledTimes(1);
    expect(onOpenPlan).toHaveBeenCalledWith("fixture-plan-math-current");
    vi.useRealTimers();
  });

  it("opens the selected row with the correct plan id without marking upcoming as started", () => {
    vi.useFakeTimers();
    const onOpenPlan = vi.fn();
    renderPlanList({ onOpenPlan });

    const english = screen.getByRole("button", { name: /03，英语，Unit 6 Reading & Grammar/u });
    expect(english).toHaveTextContent("待开始");
    expect(english).not.toHaveTextContent("继续当前计划");
    fireEvent.click(english);

    vi.advanceTimersByTime(160);
    expect(onOpenPlan).toHaveBeenCalledWith("fixture-plan-english-upcoming");
    vi.useRealTimers();
  });

  it("keeps service, privacy, and production fallback boundaries visible", () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    renderPlanList();

    expect(screen.getAllByText("LEARNING_PLAN_LIST_SERVICE_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/生产环境不得回退到演示计划/u).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/计划、任务与学习证据仅在授权家庭范围内使用/u).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/掌握度\s*\d+%|推荐置信度|排行榜|积分/u)).not.toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
    storageSpy.mockRestore();
  });

  it("returns to Today without modifying plan status", () => {
    const onReturnToday = vi.fn();
    renderPlanList({ onReturnToday });

    fireEvent.click(screen.getByRole("button", { name: "返回今日学习" }));
    expect(onReturnToday).toHaveBeenCalledTimes(1);
    expect(
      demoLearningPlanListDocument.plans.find((plan) => plan.id === "fixture-plan-history-completed")?.serverConfirmation,
    ).toBe("PENDING");
  });

  it("uses one non-disclosing surface for missing or denied plan details", () => {
    render(
      <MemoryRouter initialEntries={["/student/today?view=plan-detail"]}>
        <StudentLearningPlanListRoute currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByText("计划不存在或无法访问")).toBeInTheDocument();
    expect(screen.getByText("NOT_FOUND_OR_DENIED")).toBeInTheDocument();
  });
});
