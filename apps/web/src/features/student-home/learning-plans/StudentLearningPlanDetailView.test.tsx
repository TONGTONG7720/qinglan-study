import { useEffect } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { demoLearningPlanDetailDocument } from "./demo-data";
import { StudentLearningPlanDetailView } from "./StudentLearningPlanDetailView";

function LocationProbe({ onChange }: { readonly onChange: (value: string) => void }) {
  const location = useLocation();
  useEffect(() => {
    onChange(`${location.pathname}${location.search}`);
  }, [location, onChange]);
  return null;
}

function renderPlanDetail({
  onReturnToList = vi.fn(),
  onReturnToday = vi.fn(),
  onLocationChange,
}: {
  readonly onReturnToList?: () => void;
  readonly onReturnToday?: () => void;
  readonly onLocationChange?: (value: string) => void;
} = {}) {
  render(
    <MemoryRouter initialEntries={["/student/today?view=plan-detail&plan=fixture-plan-math-current"]}>
      {onLocationChange === undefined ? null : <LocationProbe onChange={onLocationChange} />}
      <StudentLearningPlanDetailView
        currentUser={{ status: "anonymous" }}
        document={demoLearningPlanDetailDocument}
        onReturnToday={onReturnToday}
        onReturnToList={onReturnToList}
      />
    </MemoryRouter>,
  );
  return { onReturnToList, onReturnToday };
}

describe("student learning plan detail view", () => {
  it("renders the STU-004 header, current sidebar state, date, and derived progress", () => {
    renderPlanDetail();

    expect(screen.getByRole("heading", { level: 1, name: "二次函数图像学习计划" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /每日任务/u })).toHaveClass("is-current");
    expect(screen.getByText("Fixture 演示")).toBeInTheDocument();
    expect(screen.getByText("2026-08-21")).toBeInTheDocument();
    expect(screen.getByText("Friday")).toBeInTheDocument();
    expect(screen.getByText(/丙午年 七月初九/u)).toBeInTheDocument();

    expect(screen.getByLabelText("已完成2项，共5项")).toHaveTextContent("2 / 5");
    expect(screen.getByRole("progressbar", { name: "计划进度 40%" })).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("当前进行到第 3 项：例题讲解")).toBeInTheDocument();
    expect(screen.getByText("总时长 60 分钟")).toBeInTheDocument();
    expect(screen.getByText("已用 18 分钟")).toBeInTheDocument();
    expect(screen.getByText("预计还需 42 分钟")).toBeInTheDocument();
  });

  it("renders the five-step sequence without turning the plan into a card wall or mastery score", () => {
    renderPlanDetail();

    const sequence = screen.getByRole("list", { name: "学习计划五项任务" });
    const rows = within(sequence).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("阅读课时目标"),
      expect.stringContaining("知识导入"),
      expect.stringContaining("例题讲解"),
      expect.stringContaining("随堂练习与订正"),
      expect.stringContaining("归纳总结"),
    ]);
    expect(within(sequence).getByText("例题讲解").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(sequence).getByText("随堂练习与订正").closest("li")).toHaveTextContent("待开始");
    expect(screen.queryByText(/掌握度\s*\d+%|推荐置信度|排行榜|积分|证据已保存|已更新掌握度/u)).not.toBeInTheDocument();
  });

  it("keeps completion criteria and service boundaries visible", () => {
    renderPlanDetail();

    const criteria = screen.getByRole("heading", { level: 2, name: "完成标准" }).closest("section");
    if (criteria === null) {
      throw new Error("Completion criteria section missing");
    }
    expect(criteria).toHaveTextContent("五项任务完成2 / 5");
    expect(criteria).toHaveTextContent("五道练习已提交0 / 5");
    expect(criteria).toHaveTextContent("错误题订正练习后确认");
    expect(criteria).toHaveTextContent("三条个人归纳0 / 3");
    expect(criteria).toHaveTextContent("学习证据待服务确认");
    expect(screen.getAllByText("LEARNING_PLAN_DETAIL_SERVICE_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/生产环境不得回退到演示计划详情/u).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/计划、任务与学习证据仅在授权家庭范围内使用/u).length).toBeGreaterThanOrEqual(1);
  });

  it("opens the current task through the existing /student/learn internal example view and blocks duplicate submits", () => {
    vi.useFakeTimers();
    const locations: string[] = [];
    renderPlanDetail({ onLocationChange: (value) => { locations.push(value); } });

    const topCta = document.querySelector('[data-od-id="plan-detail-continue"]');
    const bottomCta = document.querySelector('[data-od-id="plan-detail-continue-bottom"]');
    const railCta = document.querySelector('[data-od-id="plan-detail-rail-continue"]');
    if (!(topCta instanceof HTMLButtonElement) || !(bottomCta instanceof HTMLButtonElement) || !(railCta instanceof HTMLButtonElement)) {
      throw new Error("Expected duplicate continue CTAs are missing");
    }

    fireEvent.click(topCta);
    fireEvent.click(bottomCta);
    expect(topCta).toBeDisabled();
    expect(bottomCta).toBeDisabled();
    expect(railCta).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(180);
    });
    const latest = locations[locations.length - 1] ?? "";
    const [, query = ""] = latest.split("?");
    const params = new URLSearchParams(query);
    expect(latest.startsWith("/student/learn?")).toBe(true);
    expect(params.get("view")).toBe("example");
    expect(params.get("subject")).toBe("MATH");
    expect(params.get("courseId")).toBe(demoLearningPlanDetailDocument.courseId);
    expect(params.get("lessonId")).toBe(demoLearningPlanDetailDocument.lessonId);
    expect(params.get("planId")).toBe(demoLearningPlanDetailDocument.planId);
    vi.useRealTimers();
  });

  it("returns to the plan list and Today without modifying local plan facts", () => {
    const onReturnToList = vi.fn();
    const onReturnToday = vi.fn();
    renderPlanDetail({ onReturnToday, onReturnToList });

    fireEvent.click(screen.getByRole("button", { name: "返回计划列表" }));
    fireEvent.click(screen.getByRole("button", { name: "返回今日学习" }));

    expect(onReturnToList).toHaveBeenCalledTimes(1);
    expect(onReturnToday).toHaveBeenCalledTimes(1);
    expect(demoLearningPlanDetailDocument.completedItems).toBe(2);
    expect(demoLearningPlanDetailDocument.serviceState).toBe("LEARNING_PLAN_DETAIL_SERVICE_UNAVAILABLE");
  });
});
