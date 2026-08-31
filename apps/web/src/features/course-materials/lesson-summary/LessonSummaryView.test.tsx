import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CourseMaterialsView } from "../CourseMaterialsPage";
import { demoCourseCatalog } from "../demo-data";
import { LessonSummaryServiceUnavailable } from "./LessonSummaryView";

async function renderSummary() {
  render(
    <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=summary"]}>
      <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: "归纳总结" });
}

describe("lesson summary view", () => {
  it("starts at step four with fixed method copy, formulas, empty fields, and disabled actions", async () => {
    await renderSummary();
    const stepper = screen.getByRole("navigation", { name: "学习步骤" });
    expect(within(stepper).getByText("归纳总结").closest("[aria-current='step']")).toBeInTheDocument();
    expect(screen.getByText("第 4 步 / 共 4 步")).toBeInTheDocument();
    expect(screen.queryByLabelText("题目导航")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "判断二次函数图像的固定顺序" })).toBeInTheDocument();
    expect(screen.getByText("y = ax² + bx + c")).toBeInTheDocument();
    expect(screen.getByText("y = a(x − h)² + k")).toBeInTheDocument();
    expect(screen.getByText("对称轴 x = h，顶点为 (h,k)。")).toBeInTheDocument();
    expect(screen.getByLabelText("判断开口方向时，我先看")).toHaveValue("");
    expect(screen.getByLabelText("确定对称轴与顶点时，我会")).toHaveValue("");
    expect(screen.getByLabelText("描点后，我怎样检查图像")).toHaveValue("");
    expect(screen.getByText("0 / 40")).toBeInTheDocument();
    expect(screen.getAllByText("0 / 80")).toHaveLength(2);
    expect(screen.getAllByText("未完成").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole("button", { name: "保存归纳并完成本课" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "检查我的归纳" })).toBeDisabled();
    expect(screen.getByText("请完成 3 条个人归纳")).toBeInTheDocument();
  });

  it("updates one checklist item, unlocks AI without autofill, and reverts when cleared", async () => {
    await renderSummary();
    const input = screen.getByLabelText("判断开口方向时，我先看");
    fireEvent.change(input, { target: { value: "我先观察系数的正负。" } });
    expect(screen.getByText("开口方向归纳").closest("li")).toHaveClass("is-complete");
    const aiButton = screen.getByRole("button", { name: "检查我的归纳" });
    expect(aiButton).toBeEnabled();
    fireEvent.click(aiButton);
    expect(screen.getByText(/TUTOR_SERVICE_UNAVAILABLE/u)).toBeInTheDocument();
    expect(input).toHaveValue("我先观察系数的正负。");
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("开口方向归纳").closest("li")).not.toHaveClass("is-complete");
    expect(aiButton).toBeDisabled();
  });

  it("unlocks after three prompts and keeps all values when save is unavailable", async () => {
    await renderSummary();
    const values = [
      ["判断开口方向时，我先看", "我先观察系数的正负。"],
      ["确定对称轴与顶点时，我会", "我会根据表达式确定对称轴和顶点。"],
      ["描点后，我怎样检查图像", "描点后检查对称性与坐标轴交点。"],
    ] as const;
    for (const [label, value] of values) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const complete = screen.getByRole("button", { name: "保存归纳并完成本课" });
    expect(complete).toBeEnabled();
    fireEvent.click(complete);
    expect(screen.getByRole("button", { name: "正在完成…" })).toBeDisabled();
    expect(await screen.findByText(/归纳保存服务尚未接入/u)).toBeInTheDocument();
    for (const [label, value] of values) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(screen.queryByText(/已保存到云端|已更新掌握度|学习证据已生成/u)).not.toBeInTheDocument();
  });

  it("preserves the in-memory draft while opening result and content dialogs", async () => {
    await renderSummary();
    const input = screen.getByLabelText("判断开口方向时，我先看");
    fireEvent.change(input, { target: { value: "我的当前归纳" } });
    fireEvent.click(screen.getByRole("button", { name: "返回练习结果" }));
    expect(screen.getByRole("dialog", { name: "练习结果 · 本次开发会话" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回归纳总结" }));
    expect(input).toHaveValue("我的当前归纳");
    fireEvent.click(screen.getByRole("button", { name: "查看本课内容" }));
    expect(screen.getByRole("dialog", { name: "本课内容索引" })).toBeInTheDocument();
    expect(input).toHaveValue("我的当前归纳");
  });

  it("warns before leaving an unsaved in-memory draft and does not write browser storage", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    await renderSummary();
    fireEvent.change(screen.getByLabelText("判断开口方向时，我先看"), { target: { value: "尚未保存的归纳" } });
    fireEvent.click(screen.getByRole("button", { name: "稍后继续" }));
    expect(screen.getByRole("dialog", { name: "稍后继续？" })).toHaveTextContent("离开或刷新后会丢失");
    expect(storageSpy).not.toHaveBeenCalled();
    storageSpy.mockRestore();
  });

  it("renders a production-safe unavailable surface without fixture copy", () => {
    render(<MemoryRouter><LessonSummaryServiceUnavailable currentUser={{ status: "anonymous" }} overviewUrl="/student/learn" /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "归纳保存服务尚未接入" })).toBeInTheDocument();
    expect(screen.queryByText("判断二次函数图像的固定顺序")).not.toBeInTheDocument();
    expect(screen.queryByText("5 / 5")).not.toBeInTheDocument();
  });
});
