import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CourseMaterialsView } from "../CourseMaterialsPage";
import { demoCourseCatalog } from "../demo-data";
import { KnowledgeIntroServiceUnavailable } from "./KnowledgeIntroView";

function renderCourseMaterials() {
  return render(
    <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=knowledge-intro"]}>
      <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
    </MemoryRouter>,
  );
}

describe("knowledge introduction view", () => {
  it("opens as an internal course-materials state and returns to the overview", async () => {
    renderCourseMaterials();

    expect(await screen.findByRole("heading", { level: 1, name: "知识导入" })).toBeInTheDocument();
    expect(screen.getByText("Fixture 演示")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /函数 y = x² 的图像/u })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "记录本课笔记" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存笔记" })).toBeDisabled();
    expect(screen.getByText(/当前演示内容没有经过审核的教材证据/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "例题讲解，待开始" }));
    expect(await screen.findByText(/例题讲解尚未接入/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "返回课程详情" }));
    expect(await screen.findByRole("heading", { level: 1, name: "课程与资料" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /数学.*人教版/u })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows correct and incorrect answer feedback without pretending to call a backend", async () => {
    renderCourseMaterials();
    await screen.findByRole("heading", { level: 1, name: "知识导入" });

    const checkButton = screen.getByRole("button", { name: "检查答案" });
    expect(checkButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/B\..*y = x²/u));
    expect(checkButton).toBeEnabled();
    fireEvent.click(checkButton);
    expect(screen.getByRole("button", { name: "检查中…" })).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("回答正确")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/A\..*y = 2x \+ 1/u));
    fireEvent.click(screen.getByRole("button", { name: "检查答案" }));
    expect(await screen.findByText("再想一想")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("观察未知数 x 的最高次数");
  });

  it("keeps notes local and makes the unavailable save boundary visible", async () => {
    renderCourseMaterials();
    await screen.findByRole("heading", { level: 1, name: "知识导入" });

    const notes = screen.getByRole("textbox", { name: "记录本课笔记" });
    const noteText = "我发现图像关于 y 轴对称。";
    fireEvent.change(notes, { target: { value: noteText } });

    expect(notes).toHaveValue(noteText);
    expect(screen.getByText(/本机临时草稿/u)).toBeInTheDocument();
    expect(screen.getByText(`${String(noteText.length)} / 500`)).toBeInTheDocument();
    await waitFor(() => { expect(screen.getByRole("button", { name: "保存笔记" })).toBeDisabled(); });
  });

  it("renders an honest production-unavailable state for the deep link", () => {
    render(
      <MemoryRouter>
        <KnowledgeIntroServiceUnavailable
          currentUser={{ status: "anonymous" }}
          overviewUrl="/student/learn?subject=MATH"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "知识导入服务尚未接入" })).toBeInTheDocument();
    expect(screen.getByText(/不会用开发 Fixture 冒充生产内容/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回课程与资料" })).toHaveAttribute(
      "href",
      "/student/learn?subject=MATH",
    );
  });
});
