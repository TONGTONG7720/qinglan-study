import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CourseMaterialsView } from "../CourseMaterialsPage";
import { demoCourseCatalog } from "../demo-data";
import { PracticeServiceUnavailable } from "./PracticeView";

function renderPractice() {
  return render(
    <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=practice"]}>
      <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
    </MemoryRouter>,
  );
}

async function openPractice() {
  renderPractice();
  await screen.findByRole("heading", { level: 1, name: "随堂练习" });
}

function choice(id: "A" | "B" | "C" | "D") {
  return screen.getByRole("radio", { name: new RegExp(`^${id}\\.`, "u") });
}

async function enterQuestionTwoAfterDirectCorrect() {
  fireEvent.click(choice("B"));
  fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
  await screen.findByText("回答正确");
  fireEvent.click(screen.getByRole("button", { name: /下一题/u }));
}

async function enterQuestionTwoAfterRecovery() {
  fireEvent.click(choice("A"));
  fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
  await screen.findAllByText("需要再想一想");
  fireEvent.click(screen.getByRole("button", { name: "修改答案并重新提交" }));
  fireEvent.click(choice("B"));
  fireEvent.click(screen.getByRole("button", { name: "重新提交答案" }));
  await screen.findByText("判断已修正");
  fireEvent.click(screen.getByRole("button", { name: /进入第 2 题/u }));
}

function graphChoice(id: "A" | "B" | "C" | "D") {
  return screen.getByRole("radio", { name: new RegExp(`^${id}`, "u") });
}

async function enterQuestionThreeAfterRecovery() {
  await enterQuestionTwoAfterRecovery();
  fireEvent.change(screen.getByLabelText("最终答案"), { target: { value: "-7" } });
  fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
  await screen.findByText("计算正确");
  fireEvent.click(screen.getByRole("button", { name: /进入第 3 题/u }));
}

async function enterQuestionFourAfterRecovery() {
  await enterQuestionThreeAfterRecovery();
  fireEvent.click(graphChoice("A"));
  fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
  await screen.findByText("图像判断正确");
  fireEvent.click(screen.getByRole("button", { name: /进入第 4 题/u }));
}

describe("practice question one", () => {
  it("starts unanswered without leaking the answer or enabling submission", async () => {
    await openPractice();

    expect(screen.getByText("第 3 步 / 共 4 步")).toBeInTheDocument();
    expect(screen.getByText("预计 15 分钟")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "知识导入，已完成" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "例题讲解，已完成" })).toBeEnabled();
    const stepper = screen.getByRole("navigation", { name: "学习步骤" });
    expect(within(stepper).getByText("随堂练习").closest("[aria-current='step']")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "归纳总结，待开始" })).toBeEnabled();

    for (const id of ["A", "B", "C", "D"] as const) expect(choice(id)).not.toBeChecked();
    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "上一题" })).toBeDisabled();
    expect(document.getElementById("practice-submit-helper")).toHaveTextContent("请选择一个答案");
    expect(screen.getByText("未使用")).toBeInTheDocument();
    expect(screen.getByText("未解锁")).toBeInTheDocument();
    expect(screen.getByText("提交后判定")).toBeInTheDocument();
    expect(screen.getByText("完成练习后可保存")).toBeInTheDocument();
    expect(screen.queryByText("回答正确")).not.toBeInTheDocument();
    expect(screen.queryByText("本题回答错误")).not.toBeInTheDocument();
    expect(document.querySelector("[data-correct], [data-answer-key]")).toBeNull();
  });

  it("allows changing A to B before submit and only evaluates after submit", async () => {
    await openPractice();
    const submit = screen.getByRole("button", { name: "提交答案" });

    fireEvent.click(choice("A"));
    expect(choice("A")).toBeChecked();
    expect(submit).toBeEnabled();
    expect(screen.queryByText("本题回答错误")).not.toBeInTheDocument();

    fireEvent.click(choice("B"));
    expect(choice("A")).not.toBeChecked();
    expect(choice("B")).toBeChecked();
    expect(screen.queryByText("回答正确")).not.toBeInTheDocument();

    fireEvent.click(submit);
    expect(screen.getByRole("button", { name: "检查中…" })).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("回答正确")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /下一题/u })).toBeEnabled();
    expect(screen.getByText("本题不是错题")).toBeInTheDocument();
    expect(screen.getByText("等待服务端接受有效证据")).toBeInTheDocument();
  });

  it.each(["A", "C", "D"] as const)("marks %s retryable without revealing the correct option after the first submit", async (id) => {
    await openPractice();
    fireEvent.click(choice(id));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));

    expect((await screen.findAllByText("需要再想一想")).length).toBeGreaterThan(0);
    expect(choice(id).closest("label")).toHaveClass("is-retryable-incorrect");
    expect(choice("B").closest("label")).not.toHaveClass("is-revealed-correct");
    expect(choice("B").closest("label")).not.toHaveClass("is-submitted-correct");
    expect(screen.queryByText(/正确选项|正确答案/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/二次项系数 -2 小于 0/u)).not.toBeInTheDocument();
    expect(screen.getByText("需要重试")).toBeInTheDocument();
    expect(screen.getByText("待完成")).toBeInTheDocument();
    expect(screen.getByText("重试完成后可保存")).toBeInTheDocument();
    expect(screen.getByText("未更新")).toBeInTheDocument();
    expect(screen.queryByText("已加入错题本")).not.toBeInTheDocument();
    expect(screen.queryByText("已更新掌握度")).not.toBeInTheDocument();
  });

  it("keeps hint two locked after the first incorrect submit", async () => {
    await openPractice();
    const hintTwo = screen.getByRole("button", { name: "尚未解锁" });
    expect(hintTwo).toBeDisabled();

    const [hintOneButton] = screen.getAllByRole("button", { name: "查看提示 1" });
    if (hintOneButton === undefined) throw new Error("Expected a hint one button");
    fireEvent.click(hintOneButton);
    expect(screen.getAllByText(/先观察二次项系数的正负/u).length).toBeGreaterThan(0);
    expect(hintTwo).toBeDisabled();

    fireEvent.click(choice("A"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findAllByText("需要再想一想");

    expect(screen.getByRole("button", { name: "尚未解锁" })).toBeDisabled();
    expect(screen.getByText(/首次错误只使用提示 1/u)).toBeInTheDocument();
    expect(screen.queryByText(/y = a\(x-h\)² \+ k/u)).not.toBeInTheDocument();
  });

  it("records A to hint one to B as a local recovery without fabricating persistence", async () => {
    await openPractice();
    fireEvent.click(choice("A"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findAllByText("需要再想一想");

    fireEvent.click(screen.getByRole("button", { name: "修改答案并重新提交" }));
    expect(choice("A")).toBeChecked();
    expect(choice("A").closest("label")).toHaveClass("is-selected");
    expect(choice("A").closest("label")).not.toHaveClass("is-retryable-incorrect");

    fireEvent.click(choice("B"));
    expect(choice("A")).not.toBeChecked();
    expect(choice("B")).toBeChecked();
    expect(choice("B").closest("label")).toHaveClass("is-selected");
    expect(screen.queryByText("回答正确")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新提交答案" }));
    expect(screen.getByRole("button", { name: "提交中…" })).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("判断已修正")).toBeInTheDocument();
    expect(choice("A").closest("label")).toHaveClass("is-previous-incorrect");
    expect(choice("B").closest("label")).toHaveClass("is-recovered-correct");
    expect(screen.getByText("上次选择")).toBeInTheDocument();
    expect(screen.getByText("判断正确", { selector: ".practice-choice-recovered-status" })).toBeInTheDocument();
    expect(screen.getByText("恢复过程 · 本次会话")).toBeInTheDocument();
    expect(screen.getByText("本地已完成")).toBeInTheDocument();
    expect(screen.getByText("待提交")).toBeInTheDocument();
    expect(screen.getByText("待有效证据确认")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存恢复过程" })).toBeDisabled();
    expect(screen.queryByText("已更新掌握度")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /进入第 2 题/u }));
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(40);
    expect(screen.getByRole("button", { name: "第 1 题，已修正" })).toHaveClass("is-recovered");
  });

  it("toggles the session-only review mark and confirms exit with an unsent answer", async () => {
    await openPractice();
    const review = screen.getByRole("button", { name: "标记稍后检查" });
    fireEvent.click(review);
    expect(screen.getByRole("button", { name: "已标记稍后检查" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/尚未持久化/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "已标记稍后检查" }));
    expect(screen.getByRole("button", { name: "标记稍后检查" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(choice("A"));
    fireEvent.click(screen.getByRole("button", { name: /退出练习/u }));
    const dialog = screen.getByRole("dialog", { name: "退出当前练习？" });
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByRole("button", { name: "继续作答" })).toBeInTheDocument();
  });

  it("enters question two at 40 percent while preserving the first answer state", async () => {
    await openPractice();
    await enterQuestionTwoAfterDirectCorrect();

    expect(screen.getAllByText("第 2 题 / 共 5 题").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(40);
    expect(screen.getByRole("button", { name: "第 1 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 2 题，当前题" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "上一题" })).toBeEnabled();
    expect(screen.getByText("独立计算，准确表达")).toBeInTheDocument();
    expect(screen.getByLabelText("计算过程（可选）")).toHaveValue("");
    expect(screen.getByLabelText("最终答案")).toHaveValue("");
    expect(screen.getByText("0 / 300")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
    expect(screen.getAllByText("请输入答案").length).toBeGreaterThanOrEqual(1);
  });

  it("shows an honest production-unavailable deep-link state", () => {
    render(
      <MemoryRouter>
        <PracticeServiceUnavailable currentUser={{ status: "anonymous" }} overviewUrl="/student/learn?subject=MATH" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "随堂练习服务尚未接入" })).toBeInTheDocument();
    expect(screen.getByText(/不会下载开发题目、答案/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回课程与资料" })).toHaveAttribute("href", "/student/learn?subject=MATH");
  });
});

describe("practice question two numeric input", () => {
  it("keeps intermediate and invalid formats non-submittable, then accepts a strict negative number", async () => {
    await openPractice();
    await enterQuestionTwoAfterDirectCorrect();
    const answer = screen.getByLabelText("最终答案");

    fireEvent.change(answer, { target: { value: "-" } });
    expect(answer).toHaveValue("-");
    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
    expect(screen.getAllByText("请完成数值输入").length).toBeGreaterThanOrEqual(1);

    fireEvent.change(answer, { target: { value: "y=-7" } });
    expect(answer).toHaveValue("y=-7");
    expect(answer).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
    expect(screen.getAllByText(/格式错误：仅填写一个有限数值/u).length).toBeGreaterThanOrEqual(1);

    fireEvent.change(answer, { target: { value: "-7" } });
    expect(answer).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: "提交答案" })).toBeEnabled();
    expect(screen.queryByText("计算正确")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    expect(screen.getByRole("button", { name: "检查中…" })).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("计算正确")).toBeInTheDocument();
    expect(screen.getByText("-8 + 1 = -7。")).toBeInTheDocument();
    expect(screen.getByText("待提交")).toBeInTheDocument();
    expect(screen.getByText("待有效证据确认")).toBeInTheDocument();
    expect(screen.queryByText("证据已接受")).not.toBeInTheDocument();
    expect(screen.queryByText("已更新掌握度")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /进入第 3 题/u }));
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(60);
    expect(screen.getByRole("button", { name: "第 2 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 3 题，当前题" })).toHaveAttribute("aria-current", "step");
  });

  it("accepts -7.0 as mathematically equivalent", async () => {
    await openPractice();
    await enterQuestionTwoAfterDirectCorrect();
    fireEvent.change(screen.getByLabelText("最终答案"), { target: { value: " -7.0 " } });
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    expect(await screen.findByText("计算正确")).toBeInTheDocument();
  });

  it("treats a different valid number as retryable without revealing the answer", async () => {
    await openPractice();
    await enterQuestionTwoAfterDirectCorrect();
    const answer = screen.getByLabelText("最终答案");
    fireEvent.change(answer, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));

    expect(await screen.findByText("再检查一次")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "第 2 题，当前题，需要重试" })).toHaveClass("is-needs-retry");
    expect(screen.queryByText("-8 + 1 = -7。")).not.toBeInTheDocument();
    expect(screen.getByText("待服务确认")).toBeInTheDocument();
    expect(screen.getByText("重试完成后可提交")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "尚未解锁" })).toBeDisabled();

    const hintOneButtons = screen.getAllByRole("button", { name: "查看提示 1" });
    const hintOneButton = hintOneButtons[0];
    if (hintOneButton === undefined) throw new Error("Expected Q2 hint one button");
    fireEvent.click(hintOneButton);
    expect(screen.getAllByText(/先计算 2²，再将结果乘以 -2/u).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "查看提示 2" })).toBeEnabled();
  });

  it("blocks calculation text beyond 300 characters and explains the limit", async () => {
    await openPractice();
    await enterQuestionTwoAfterDirectCorrect();
    const calculation = screen.getByLabelText("计算过程（可选）");
    const atLimit = "算".repeat(300);
    fireEvent.change(calculation, { target: { value: atLimit } });
    expect(calculation).toHaveValue(atLimit);
    expect(screen.getByText("300 / 300")).toBeInTheDocument();
    expect(screen.getByText("已达到 300 字上限。")).toBeInTheDocument();

    fireEvent.change(calculation, { target: { value: `${atLimit}多` } });
    expect(calculation).toHaveValue(atLimit);
    expect(screen.getByText("计算过程最多 300 个字符；超出内容未写入。")).toBeInTheDocument();
  });

  it("returns to the recovered first question without losing either session", async () => {
    await openPractice();
    await enterQuestionTwoAfterRecovery();
    fireEvent.change(screen.getByLabelText("计算过程（可选）"), { target: { value: "先代入 x = 2" } });
    fireEvent.change(screen.getByLabelText("最终答案"), { target: { value: "-" } });

    fireEvent.click(screen.getByRole("button", { name: "上一题" }));
    expect(screen.getByText("判断已修正")).toBeInTheDocument();
    expect(choice("A").closest("label")).toHaveClass("is-previous-incorrect");
    expect(choice("B").closest("label")).toHaveClass("is-recovered-correct");

    fireEvent.click(screen.getByRole("button", { name: /进入第 2 题/u }));
    expect(screen.getByLabelText("计算过程（可选）")).toHaveValue("先代入 x = 2");
    expect(screen.getByLabelText("最终答案")).toHaveValue("-");
    expect(screen.getByRole("button", { name: "第 1 题，已修正" })).toHaveClass("is-recovered");
  });
});

describe("practice question three graph recognition", () => {
  it("starts at 60 percent with four neutral accessible graph choices and no answer leak", async () => {
    await openPractice();
    await enterQuestionThreeAfterRecovery();

    expect(screen.getByText("观察图像，辨析特征")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(60);
    expect(screen.getByRole("button", { name: "第 1 题，已修正" })).toHaveClass("is-recovered");
    expect(screen.getByRole("button", { name: "第 2 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 3 题，当前题" })).toHaveAttribute("aria-current", "step");

    for (const id of ["A", "B", "C", "D"] as const) {
      expect(graphChoice(id)).not.toBeChecked();
      expect(graphChoice(id).closest("label")).not.toHaveClass("is-correct", "is-incorrect", "is-selected");
    }
    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
    expect(document.getElementById("practice-submit-helper")).toHaveTextContent("请选择一幅图像");
    expect(screen.queryByText("图像判断正确")).not.toBeInTheDocument();
    expect(document.querySelector("[data-correct], [data-answer-key]")).toBeNull();
    expect(screen.getByRole("img", { name: /选项 A：一条开口向上的抛物线，对称轴为 x 等于 1，顶点位于 1、负 1/u })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /选项 B：一条开口向下的抛物线/u })).toBeInTheDocument();
  });

  it("allows switching graph choices without evaluating before submit", async () => {
    await openPractice();
    await enterQuestionThreeAfterRecovery();
    const submit = screen.getByRole("button", { name: "提交答案" });

    fireEvent.click(graphChoice("A"));
    expect(graphChoice("A")).toBeChecked();
    expect(graphChoice("A").closest("label")).toHaveClass("is-selected");
    expect(screen.queryByText("图像判断正确")).not.toBeInTheDocument();

    fireEvent.click(graphChoice("B"));
    expect(graphChoice("A")).not.toBeChecked();
    expect(graphChoice("B")).toBeChecked();
    expect(submit).toBeEnabled();
    expect(screen.queryByText("再看开口方向")).not.toBeInTheDocument();
  });

  it.each([
    ["B", "再看开口方向", "开口方向"],
    ["C", "再看水平平移", "对称轴"],
    ["D", "再看垂直平移", "顶点"],
  ] as const)("gives %s a distinct concept diagnosis without revealing A", async (id, title, concept) => {
    await openPractice();
    await enterQuestionThreeAfterRecovery();
    fireEvent.click(graphChoice(id));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(graphChoice(id).closest("label")).toHaveClass("is-incorrect");
    expect(graphChoice("A").closest("label")).not.toHaveClass("is-correct");
    expect(screen.getAllByText(concept).length).toBeGreaterThan(0);
    expect(screen.queryByText(/正确选项|应该选择|选项 A 正确/u)).not.toBeInTheDocument();
    expect(screen.getByText("需要重试")).toBeInTheDocument();
    expect(screen.getByText("重试完成后可提交")).toBeInTheDocument();
  });

  it("unlocks hint two only after hint one and an incorrect graph submission", async () => {
    await openPractice();
    await enterQuestionThreeAfterRecovery();
    expect(screen.getByRole("button", { name: "尚未解锁" })).toBeDisabled();

    const hintOneButtons = screen.getAllByRole("button", { name: "查看提示 1" });
    const hintOne = hintOneButtons[0];
    if (hintOne === undefined) throw new Error("Expected Q3 hint one button");
    fireEvent.click(hintOne);
    expect(screen.getAllByText(/y = a\(x-h\)² \+ k/u).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "尚未解锁" })).toBeDisabled();

    fireEvent.click(graphChoice("B"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findByText("再看开口方向");
    expect(screen.getByRole("button", { name: "查看提示 2" })).toBeEnabled();
    expect(screen.queryByText(/选 A/u)).not.toBeInTheDocument();
  });

  it("submits A as correct and advances to question four at 80 percent", async () => {
    await openPractice();
    await enterQuestionThreeAfterRecovery();
    fireEvent.click(graphChoice("A"));
    expect(screen.queryByText("图像判断正确")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));

    expect(screen.getByRole("button", { name: "检查中…" })).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("图像判断正确")).toBeInTheDocument();
    expect(graphChoice("A").closest("label")).toHaveClass("is-correct");
    expect(screen.getByText("本题不是错题")).toBeInTheDocument();
    expect(screen.getByText("待提交")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /进入第 4 题/u }));
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(80);
    expect(screen.getByRole("button", { name: "第 3 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 4 题，当前题" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { name: /根据函数 y = x² − 2x − 3/u })).toBeInTheDocument();
  });

  it("returns to the completed numeric question without losing Q1 recovery", async () => {
    await openPractice();
    await enterQuestionThreeAfterRecovery();
    fireEvent.click(screen.getByRole("button", { name: "上一题" }));

    expect(screen.getByText("计算正确")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(40);
    expect(screen.getByRole("button", { name: "第 1 题，已修正" })).toHaveClass("is-recovered");
    fireEvent.click(screen.getByRole("button", { name: /进入第 3 题/u }));
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(60);
  });
});

describe("practice question four coordinate plotting", () => {
  it("starts at 80 percent with an empty native coordinate workspace", async () => {
    await openPractice();
    await enterQuestionFourAfterRecovery();

    expect(screen.getByText("描点成图，核对函数特征")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(80);
    expect(screen.getByRole("button", { name: "第 1 题，已修正" })).toHaveClass("is-recovered");
    expect(screen.getByRole("button", { name: "第 2 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 3 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 4 题，当前题" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { name: /根据函数 y = x² − 2x − 3/u })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /函数 y = x² − 2x − 3 的只读值表/u })).toBeInTheDocument();
    expect(screen.getByRole("application", { name: /坐标系.*当前已有 0 个学生点位/u })).toBeInTheDocument();
    expect(document.querySelectorAll(".coordinate-point")).toHaveLength(0);
    expect(document.querySelector(".coordinate-student-curve")).toBeNull();
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "清空" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "连接曲线" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "提交作图" })).toBeDisabled();
    expect(document.getElementById("practice-submit-helper")).toHaveTextContent("请先描出 5 个点并连接曲线");
    expect(document.querySelector("[data-answer-key], [data-correct], [data-answer-point]")).toBeNull();
  });

  it("adds snapped unique points, connects the student curve and preserves work on unavailable submit", async () => {
    await openPractice();
    await enterQuestionFourAfterRecovery();

    fireEvent.click(screen.getByText("键盘与坐标输入"));
    const xInput = screen.getByRole("spinbutton", { name: "x" });
    const yInput = screen.getByRole("spinbutton", { name: "y" });
    const add = screen.getByRole("button", { name: "添加坐标点" });
    const values = [[-1, 0], [0, -3], [1, -4], [2, -3], [3, 0]] as const;
    for (const [x, y] of values) {
      fireEvent.change(xInput, { target: { value: String(x) } });
      fireEvent.change(yInput, { target: { value: String(y) } });
      fireEvent.click(add);
    }
    expect(document.querySelectorAll(".coordinate-point")).toHaveLength(5);
    expect(screen.getByText("已描点 5 / 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "连接曲线" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "连接曲线" }));
    expect(document.querySelector(".coordinate-student-curve")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交作图" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "提交作图" }));
    expect(screen.getByRole("button", { name: "正在校验…" })).toBeDisabled();
    expect(await screen.findByText(/作图提交服务尚未接入/u)).toBeInTheDocument();
    expect(document.querySelectorAll(".coordinate-point")).toHaveLength(5);
    expect(document.querySelector(".coordinate-student-curve")).toBeInTheDocument();
    expect(screen.queryByText(/已保存学习证据|已更新掌握度/u)).not.toBeInTheDocument();
  });

  it("supports keyboard adding and a compact clear confirmation with undo recovery", async () => {
    await openPractice();
    await enterQuestionFourAfterRecovery();
    const grid = screen.getByRole("application", { name: /坐标系/u });
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(document.querySelectorAll(".coordinate-point")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "清空" }));
    const dialog = screen.getByRole("dialog", { name: "清空全部点位？" });
    fireEvent.click(within(dialog).getByRole("button", { name: "确认清空" }));
    expect(document.querySelectorAll(".coordinate-point")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(document.querySelectorAll(".coordinate-point")).toHaveLength(1);
  });
});

describe("practice question five structured application", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_QA_PRACTICE_QUESTION", "5");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("starts at 100 percent with Q5 current, all fields empty, and submission disabled", async () => {
    await openPractice();

    expect(screen.getByText("综合应用，说明判断依据")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "练习完成进度" })).toHaveValue(100);
    expect(screen.getByRole("button", { name: "第 1 题，已修正" })).toHaveClass("is-recovered");
    expect(screen.getByRole("button", { name: "第 2 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 3 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 4 题，已作答" })).toHaveClass("is-correct");
    expect(screen.getByRole("button", { name: "第 5 题，当前题" })).toHaveAttribute("aria-current", "step");
    expect(screen.getAllByText("未完成").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("0 / 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交本题并完成练习" })).toBeDisabled();
    expect(document.getElementById("practice-submit-helper")).toHaveTextContent("请完成 4 项必填内容");
    expect(document.querySelector("[data-answer-key], [data-correct]")) .toBeNull();
  });

  it("unlocks only after four derived requirements are complete and locks again when a field clears", async () => {
    await openPractice();
    const submit = screen.getByRole("button", { name: "提交本题并完成练习" });
    const vertexX = screen.getByRole("textbox", { name: "最高点横坐标 x" });
    fireEvent.change(vertexX, { target: { value: "9" } });
    fireEvent.change(screen.getByRole("textbox", { name: "最高点纵坐标 y" }), { target: { value: "8" } });
    fireEvent.change(screen.getByRole("textbox", { name: "第一个地面交点横坐标 x₁" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("textbox", { name: "第二个地面交点横坐标 x₂" }), { target: { value: "7" } });
    fireEvent.change(screen.getByRole("textbox", { name: "拱门宽度" }), { target: { value: "6" } });
    fireEvent.change(screen.getByRole("textbox", { name: "判断依据" }), { target: { value: "我先识别每个量的含义，再按顺序填写。" } });
    expect(submit).toBeEnabled();
    expect(document.getElementById("practice-submit-helper")).toHaveTextContent("4 项必填内容已完成");

    fireEvent.change(vertexX, { target: { value: "" } });
    expect(submit).toBeDisabled();
  });

  it("validates format and order without revealing correctness on blur", async () => {
    await openPractice();
    const first = screen.getByRole("textbox", { name: "第一个地面交点横坐标 x₁" });
    const second = screen.getByRole("textbox", { name: "第二个地面交点横坐标 x₂" });
    fireEvent.change(first, { target: { value: "8" } });
    fireEvent.change(second, { target: { value: "1" } });
    fireEvent.blur(second);
    expect(screen.getByText("请按从小到大填写")).toBeInTheDocument();
    expect(screen.queryByText(/正确答案|应为/u)).not.toBeInTheDocument();

    const width = screen.getByRole("textbox", { name: "拱门宽度" });
    fireEvent.change(width, { target: { value: "-1" } });
    fireEvent.blur(width);
    expect(screen.getByText("宽度必须为非负数")).toBeInTheDocument();
  });

  it("keeps every value after unavailable submission and does not claim persistence", async () => {
    await openPractice();
    const values = [
      ["最高点横坐标 x", "9"],
      ["最高点纵坐标 y", "8"],
      ["第一个地面交点横坐标 x₁", "1"],
      ["第二个地面交点横坐标 x₂", "7"],
      ["拱门宽度", "6"],
      ["判断依据", "我先识别每个量的含义，再按顺序填写。"],
    ] as const;
    for (const [name, value] of values) fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "提交本题并完成练习" }));
    expect(screen.getByRole("button", { name: "正在提交…" })).toBeDisabled();
    expect(await screen.findByText(/结构化作答提交服务尚未接入/u)).toBeInTheDocument();
    for (const [name, value] of values) expect(screen.getByRole("textbox", { name })).toHaveValue(value);
    expect(screen.queryByText(/证据已保存|掌握度已更新|提交成功/u)).not.toBeInTheDocument();
  });
});
