import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CourseMaterialsView } from "../CourseMaterialsPage";
import { demoCourseCatalog } from "../demo-data";
import { LessonCompleteServiceUnavailable } from "./LessonCompleteView";

async function renderComplete() {
  render(<MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=lesson-complete"]}><CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} /></MemoryRouter>);
  await screen.findByRole("heading", { level: 1, name: "本课完成" });
}

describe("lesson complete view", () => {
  it("shows four completed page steps without presenting 4/4 as a score", async () => {
    await renderComplete();
    const stepper = screen.getByRole("navigation", { name: "学习步骤" });
    for (const label of ["知识导入，已完成", "例题讲解，已完成", "随堂练习，已完成", "归纳总结，已完成"]) expect(within(stepper).getByRole("button", { name: label })).toBeDisabled();
    expect(screen.getByLabelText("四个页面步骤均已完成")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "本课页面流程已完成" })).toBeInTheDocument();
    expect(screen.getByText(/当前会话完成不等于云端保存/u)).toBeInTheDocument();
    const main = document.querySelector(".lesson-complete-main");
    if (!(main instanceof HTMLElement)) throw new Error("Lesson complete main missing");
    expect(within(main).queryByText(/满分|已掌握|正确率|100%/u)).not.toBeInTheDocument();
  });

  it("shows the three current-session summaries and their honest save boundary", async () => {
    await renderComplete();
    const review = document.querySelector(".personal-summary-review");
    if (!(review instanceof HTMLElement)) throw new Error("Personal summary review missing");
    expect(within(review).getByText("先看二次项系数 a 的正负，判断图像开口向上还是向下。")).toBeInTheDocument();
    expect(within(review).getByText("再从顶点式读出 h、k，或通过计算确定对称轴与顶点。")).toBeInTheDocument();
    expect(within(review).getByText("选择对称的 x 值描点，再检查顶点、对称性和交点是否一致。")).toBeInTheDocument();
    expect(screen.getAllByText("当前会话已完成")).toHaveLength(3);
    expect(screen.getByText(/以上归纳仅保留在当前演示会话/u)).toBeInTheDocument();
    expect(screen.getByText("云端保存").parentElement).toHaveTextContent("未接入");
    expect(screen.getByText("其他设备").parentElement).toHaveTextContent("不同步");
  });

  it("shows practice and review facts without inventing mastery or an official date", async () => {
    await renderComplete();
    expect(screen.getAllByText("5 / 5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("提示后修正").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("解释待评审").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("保持不变").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2–3 天后")).toBeInTheDocument();
    expect(screen.getAllByText("待服务确认").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/2026-08-2[5-9]|nextReviewAt/u)).not.toBeInTheDocument();
  });

  it("uses one primary action and blocks duplicate return clicks", async () => {
    await renderComplete();
    vi.useFakeTimers();
    expect(document.querySelectorAll(".lesson-complete-main .primary-button")).toHaveLength(1);
    const button = screen.getByRole("button", { name: "返回数学课程" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "正在返回…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "正在返回…" }));
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("keeps current-session summaries while editing and reviewing content", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    await renderComplete();
    fireEvent.click(screen.getByRole("button", { name: "返回编辑归纳" }));
    const editDialog = screen.getByRole("dialog", { name: "编辑当前会话归纳" });
    const first = within(editDialog).getAllByRole("textbox")[0];
    if (first === undefined) throw new Error("Editable summary field missing");
    fireEvent.change(first, { target: { value: "我修改后的当前会话归纳" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "关闭编辑当前会话归纳" }));
    const review = document.querySelector(".personal-summary-review");
    if (!(review instanceof HTMLElement)) throw new Error("Personal summary review missing");
    expect(within(review).getByText("我修改后的当前会话归纳")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "回看本课" }));
    expect(screen.getByRole("dialog", { name: "本课内容索引" })).toBeInTheDocument();
    expect(within(review).getByText("我修改后的当前会话归纳")).toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
    storageSpy.mockRestore();
  });

  it("opens the practice recap without changing completion state", async () => {
    await renderComplete();
    fireEvent.click(screen.getByRole("button", { name: "查看练习结果" }));
    const dialog = screen.getByRole("dialog", { name: "练习结果 · 当前会话" });
    expect(dialog).toHaveTextContent("5 / 5");
    expect(dialog).toHaveTextContent("不代表满分、全部正确或已掌握");
    expect(screen.getByRole("heading", { name: "本课页面流程已完成" })).toBeInTheDocument();
  });

  it("renders a production-safe unavailable surface without completion fixture", () => {
    render(<MemoryRouter><LessonCompleteServiceUnavailable currentUser={{ status: "anonymous" }} overviewUrl="/student/learn" /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "课时完成服务尚未接入" })).toBeInTheDocument();
    expect(screen.queryByText("本课页面流程已完成")).not.toBeInTheDocument();
    expect(screen.queryByText("2–3 天后")).not.toBeInTheDocument();
  });
});
