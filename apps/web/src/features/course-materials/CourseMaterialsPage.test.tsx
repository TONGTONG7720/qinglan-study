import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ReleaseScopeProvider } from "../../config/release-scope";
import { demoCourseCatalog } from "./demo-data";
import { CourseMaterialsView } from "./CourseMaterialsPage";
import type { CourseCatalog } from "./types";

describe("course materials page", () => {
  it("keeps the Beta catalog read-only and disables unlaunched course details", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING"]}>
        <ReleaseScopeProvider scope="READ_ONLY_BETA">
          <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
        </ReleaseScopeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("邀请制只读 Beta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "课程详情暂未开放" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "AI 辅导" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "错题复习" })).not.toBeInTheDocument();
  });

  it("renders the labelled development catalog and updates selected course state", async () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "课程与资料" })).toBeInTheDocument();
    expect(screen.getAllByText("开发演示数据").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /数学.*人教版/u })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /语文.*统编版/u }));

    expect(screen.getByRole("button", { name: /语文.*统编版/u })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText(/已选择语文/u)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("选择年级"), { target: { value: "7" } });
    expect(screen.getByText("当前筛选条件下没有课程")).toBeInTheDocument();
  });

  it("expands recent materials without removing the desktop page structure", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    const desktopRail = screen.getByRole("complementary", { name: "课程辅助信息" });
    fireEvent.click(within(desktopRail).getByRole("button", { name: "查看全部" }));

    expect(within(desktopRail).getByRole("button", { name: "收起" })).toBeInTheDocument();
    expect(within(desktopRail).getByText("英语 Unit 6 词汇表")).toBeInTheDocument();
  });

  it("opens the STU-006 subject detail from the learning hub and continues into STU-007 textbook detail", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /进入课程/u }));

    expect(screen.getByRole("heading", { level: 1, name: "数学 · 八年级下册" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "二次函数的图像与性质" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /21\.2 二次函数的图像/u })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("DEVELOPMENT_FIXTURE · 仅用于设计与前端 QA；正式学习证据必须由服务端接受。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看教材" }));

    expect(screen.getByRole("heading", { level: 1, name: "数学教材" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "数学 · 下册" })).toBeInTheDocument();
    expect(screen.getAllByText("第 16–22 章").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("P1–P64").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("P28–P46").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /第21章 二次函数的图像与性质.*P28–P46/u })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getAllByText("DEVELOPMENT_FIXTURE · 仅用于 STU-007 设计与前端 QA；正式目录、页码和确认状态必须由服务端返回。").length).toBeGreaterThanOrEqual(1);
  });

  it("routes textbook current chapter actions through STU-008 into the STU-009 knowledge point detail", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=textbook-detail"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "进入章节" }));

    expect(screen.getByRole("heading", { level: 1, name: "21.2 二次函数的图像" })).toBeInTheDocument();
    expect(screen.getByText("从坐标出发，看见函数的形状")).toBeInTheDocument();
    expect(screen.getAllByText("P32–P36").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /1 顶点式/u })).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("图像平移与位置")).toBeInTheDocument();
    expect(screen.getAllByText("DEVELOPMENT_FIXTURE · 仅用于 STU-008 设计与前端 QA；章节、知识点、顺序和状态必须由服务端返回。").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "开始本课学习" }));

    expect(screen.getByRole("heading", { level: 1, name: "从顶点式读取图像特征" })).toBeInTheDocument();
    expect(screen.getByText("一个式子，读出开口、对称轴与顶点")).toBeInTheDocument();
    expect(screen.getByText("y = a(x-h)² + k")).toBeInTheDocument();
    expect(screen.getByText("y = -2(x - 1)² + 3")).toBeInTheDocument();
    expect(screen.getByText("图像开口向下")).toBeInTheDocument();
    expect(screen.getByText("对称轴 x = 1")).toBeInTheDocument();
    expect(screen.getByText("顶点 (1,3)")).toBeInTheDocument();
    expect(screen.getAllByText("P32–P34").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("KNOWLEDGE_POINT_DETAIL_SERVICE_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);

    const primaryLearningButton = screen.getAllByRole("button", { name: /开始该知识点学习/u })[0];
    if (primaryLearningButton === undefined) {
      throw new Error("Missing STU-009 primary learning button");
    }
    fireEvent.click(primaryLearningButton);

    expect(screen.getByRole("heading", { level: 1, name: "练习中心" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "今日可练" })).toBeInTheDocument();
    expect(screen.getByText("二次函数图像特征 · 独立练习")).toBeInTheDocument();
    expect(screen.getByText("二次函数图像判断 · 错题恢复")).toBeInTheDocument();
    expect(screen.getByText(/正式推荐、错题恢复、attemptId/u)).toBeInTheDocument();
  });

  it("opens the STU-010 question hub from the knowledge point detail and continues into STU-011 text question composer", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=knowledge-point-detail&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "去提问" }));

    expect(screen.getByRole("heading", { level: 1, name: "提问中心" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "当前学习上下文" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "两种提问方式" })).toBeInTheDocument();
    expect(screen.getAllByText("从顶点式读取图像特征").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("P32–P34 · 已确认教材").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { level: 3, name: "文字提问" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "单题图片" })).toBeInTheDocument();
    expect(screen.getAllByText("QUESTION_HUB_SERVICE_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/正式上下文、预算、提问记录和 AI 可用状态必须由服务端返回/u)).toBeInTheDocument();

    const textQuestionButton = screen.getAllByRole("button", { name: /开始文字提问/u })[0];
    if (textQuestionButton === undefined) {
      throw new Error("Missing STU-010 text question button");
    }
    fireEvent.click(textQuestionButton);

    expect(screen.getByRole("heading", { level: 1, name: "文字提问" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "已确认的学习上下文" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "项必填内容" })).toBeInTheDocument();
    expect(screen.getAllByText("P32–P34").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0 / 500").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0 / 300").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/请完成问题描述、尝试步骤，并确认隐私后再提交/u)).toBeInTheDocument();
    expect(screen.getAllByText("TEXT_QUESTION_SERVICE_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);

    const descriptionField = screen.getByLabelText(/问题描述/u);
    const attemptField = screen.getByLabelText(/我已经尝试过什么/u);
    const submitButton = screen.getByRole("button", { name: "提交文字问题" });
    expect(submitButton).toBeDisabled();

    fireEvent.change(descriptionField, { target: { value: "我不明白 a < 0 时为什么图像开口向下。" } });
    fireEvent.change(attemptField, { target: { value: "我先看了 a，再找 h 和 k，但是和图像对应不上。" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /我已确认不填写姓名/u }));

    expect(screen.getAllByText("22 / 500").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("26 / 300").length).toBeGreaterThanOrEqual(1);
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    expect(screen.getByText(/文字提问服务未接入/u)).toBeInTheDocument();
    expect(screen.getByText(/不创建 TutorSession、预算扣减或学习证据/u)).toBeInTheDocument();
  });

  it("opens the STU-012 image question upload page and keeps upload as a service boundary", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=question-hub&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    const imageQuestionButton = screen.getAllByRole("button", { name: /上传单题图片/u })[0];
    if (imageQuestionButton === undefined) {
      throw new Error("Missing STU-010 image question button");
    }
    fireEvent.click(imageQuestionButton);

    expect(screen.getByRole("heading", { level: 1, name: "单题图片上传" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "已确认的学习上下文" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "1 张单题图片" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "选择一张清晰的单题图片" })).toBeInTheDocument();
    expect(screen.getAllByText("0 / 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/JPG、PNG、WebP\s*·\s*不超过 10 MB/u)).toBeInTheDocument();
    expect(screen.getAllByText("IMAGE_QUESTION_UPLOAD_SERVICE_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);

    const uploadButton = screen.getByRole("button", { name: "安全上传" });
    const cropButton = screen.getByRole("button", { name: "确认裁切范围" });
    expect(uploadButton).toBeDisabled();
    expect(cropButton).toBeDisabled();

    const validFile = new File(["image"], "vertex-question.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("选择单题图片文件"), { target: { files: [validFile] } });

    expect(screen.getAllByText(/vertex-question\.png/u).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1 / 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("已选 1 张").length).toBeGreaterThanOrEqual(1);
    expect(cropButton).not.toBeDisabled();
    expect(uploadButton).toBeDisabled();

    fireEvent.click(cropButton);

    expect(uploadButton).not.toBeDisabled();
    expect(screen.getAllByText("已确认").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(uploadButton);

    expect(screen.getByText(/图片上传服务未接入/u)).toBeInTheDocument();
    expect(screen.getByText(/当前不会创建 questionDraft、asset、OCR 结果或辅导会话/u)).toBeInTheDocument();
  });

  it("rejects invalid STU-012 image files without enabling upload", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=image-question-upload&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    const uploadButton = screen.getByRole("button", { name: "安全上传" });
    const invalidFile = new File(["not an image"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("选择单题图片文件"), { target: { files: [invalidFile] } });

    expect(screen.getByText("只支持 JPG、PNG 或 WebP 图片。")).toBeInTheDocument();
    expect(screen.getAllByText("0 / 1").length).toBeGreaterThanOrEqual(1);
    expect(uploadButton).toBeDisabled();
    expect(screen.queryByText(/notes\.txt/u)).not.toBeInTheDocument();
  });

  it("opens the STU-013 OCR confirmation page and requires correcting the low-confidence formula", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=ocr-confirmation&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form&draft=demo-question-draft-low-confidence"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "确认识别题面" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "已确认的学习上下文" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "原图" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "识别文本" })).toBeInTheDocument();
    expect(screen.getAllByText("62%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2 / 3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("OCR_CONFIRMATION_SERVICE_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);

    const formulaField = screen.getByLabelText("第 2 个 OCR 片段");
    const markFixedButton = screen.getByRole("button", { name: "标记已修正" });
    const primaryButton = screen.getByRole("button", { name: "确认题面并进入辅导" });
    expect(formulaField).toHaveValue("y = -2(x + 1)² + 3");
    expect(markFixedButton).toBeDisabled();
    expect(primaryButton).toBeDisabled();

    fireEvent.change(formulaField, { target: { value: "y = -2(x - 1)² + 3" } });
    expect(markFixedButton).not.toBeDisabled();
    fireEvent.click(markFixedButton);

    expect(screen.getAllByText("1 / 1 已确认").length).toBeGreaterThanOrEqual(1);
    expect(primaryButton).not.toBeDisabled();

    fireEvent.click(primaryButton);

    expect(screen.getByText(/OCR 确认服务未接入/u)).toBeInTheDocument();
    expect(screen.getByText(/当前不会创建 TutorSession、Question、预算扣减/u)).toBeInTheDocument();
  });

  it("opens the STU-014 hint-first tutor session without revealing the answer", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=hint-first-tutor-session&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form&draft=demo-question-draft-low-confidence&session=demo-tutor-session-hint-first"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "提示优先辅导" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "已确认题面" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "先判断开口方向" })).toBeInTheDocument();
    expect(screen.getByText(/观察顶点式中的 a = -2/u)).toBeInTheDocument();
    expect(screen.getAllByText("未解锁").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("0 / 200")).toBeInTheDocument();
    expect(screen.queryByText("开口向下")).not.toBeInTheDocument();
    expect(screen.queryByText("对称轴 x = 1")).not.toBeInTheDocument();
    expect(screen.queryByText("顶点 (1,3)")).not.toBeInTheDocument();

    const answerField = screen.getByLabelText("我的当前回答");
    const submitButton = screen.getByRole("button", { name: "提交当前回答" });
    expect(submitButton).toBeDisabled();

    fireEvent.change(answerField, { target: { value: "a = -2 小于 0，所以我先判断开口方向。" } });
    expect(screen.getByText("23 / 200")).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    expect(screen.getByText(/提示优先辅导服务未接入/u)).toBeInTheDocument();
    expect(screen.getByText(/当前不会创建真实 TutorSession 进度、AI 结果/u)).toBeInTheDocument();
    expect(screen.queryByText("开口向下")).not.toBeInTheDocument();
  });

  it("opens the STU-015 tutor result without treating prompted understanding as mastery", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=tutor-session-result&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form&draft=demo-question-draft-low-confidence&session=demo-tutor-session-hint-first"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "辅导结果" })).toBeInTheDocument();
    expect(screen.getByText("y = -2(x - 1)² + 3")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("个图像特征已核对")).toBeInTheDocument();
    expect(screen.getByText("开口方向")).toBeInTheDocument();
    expect(screen.getByText("提示后判断正确")).toBeInTheDocument();
    expect(screen.getByText("因为 a = -2 < 0，开口向下。")).toBeInTheDocument();
    expect(screen.getByText("x = 1")).toBeInTheDocument();
    expect(screen.getByText("(1, 3)")).toBeInTheDocument();
    expect(screen.getByText(/不计为独立作答证据，也不代表已经掌握/u)).toBeInTheDocument();

    const rail = screen.getByLabelText("辅导结果辅助信息");
    expect(within(rail).getByText("独立证据")).toBeInTheDocument();
    expect(within(rail).getByText("0")).toBeInTheDocument();
    expect(within(rail).getByText("掌握证据")).toBeInTheDocument();
    expect(within(rail).getByText("暂不更新")).toBeInTheDocument();
    expect(screen.queryByText(/TUTOR_RESULT_SERVICE_UNAVAILABLE/u)).not.toBeInTheDocument();
    expect(screen.queryByText("掌握证据已更新")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看完整解析" }));
    expect(screen.getByRole("heading", { level: 3, name: "完整解析" })).toBeInTheDocument();
    expect(screen.getByText(/这只是提示辅导过程记录/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "报告辅导问题" }));
    expect(screen.getByRole("dialog", { name: "报告辅导问题" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("补充说明"), { target: { value: "解析里想确认证据边界。" } });
    fireEvent.click(screen.getByRole("button", { name: "提交报告" }));
    expect(screen.getByText(/TUTOR_RESULT_REPORT_SERVICE_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.getByDisplayValue("解析里想确认证据边界。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始当前点独立练习" }));
    expect(screen.getByText(/CURRENT_POINT_PRACTICE_SERVICE_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.getByText(/当前不会创建练习会话、LearningEvidence/u)).toBeInTheDocument();
  });

  it("opens the STU-016 practice hub with filters, explanation, source privacy, and unavailable attempts", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=practice-hub&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form&target=demo-stu016-current-point-practice"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "练习中心" })).toBeInTheDocument();
    expect(screen.getByText("只练当前知识点与到期错题，不提前进入阶段测评")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("项练习已为你排好")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "全部 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("二次函数图像特征 · 独立练习")).toBeInTheDocument();
    expect(screen.getByText("二次函数图像判断 · 错题恢复")).toBeInTheDocument();
    expect(screen.getByText(/你刚完成提示式辅导，需要用同知识点新题形成独立作答证据/u)).toBeInTheDocument();
    expect(screen.getByText(/已到复习时间，需要重新独立作答确认是否恢复/u)).toBeInTheDocument();
    expect(screen.getByText("预计共 26 分钟；非 AI 练习不受辅导额度影响。")).toBeInTheDocument();

    const rail = screen.getByLabelText("练习中心辅助信息");
    expect(within(rail).getByText("独立证据")).toBeInTheDocument();
    expect(within(rail).getByText("0")).toBeInTheDocument();
    expect(within(rail).getByText("到期错题")).toBeInTheDocument();
    expect(within(rail).getByText("1")).toBeInTheDocument();
    expect(within(rail).getByText("一次结果不等于已经掌握")).toBeInTheDocument();
    expect(within(rail).getByText("PRACTICE_RECOMMENDATION_UNAVAILABLE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "当前知识点 1" }));
    expect(screen.getByRole("tab", { name: "当前知识点 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("二次函数图像特征 · 独立练习")).toBeInTheDocument();
    expect(screen.queryByText("二次函数图像判断 · 错题恢复")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看练习说明" }));
    expect(screen.getByRole("region", { name: "二次函数图像特征 · 独立练习练习说明" })).toBeInTheDocument();
    expect(screen.getByText(/题目范围：只生成与 21\.2 顶点式图像特征相关的新题/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始推荐练习" }));
    expect(screen.getByText(/当前点独立练习创建服务未接入/u)).toBeInTheDocument();
    expect(screen.getByText(/不会创建 attemptId、LearningEvidence/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "错题恢复 1" }));
    expect(screen.queryByText("二次函数图像特征 · 独立练习")).not.toBeInTheDocument();
    expect(screen.getByText("二次函数图像判断 · 错题恢复")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看错题来源" }));
    expect(screen.getByRole("region", { name: "二次函数图像判断 · 错题恢复错题来源" })).toBeInTheDocument();
    expect(screen.getByText(/范围：当前学生本人错题本/u)).toBeInTheDocument();
    expect(screen.getAllByText(/提交前不显示旧答案/u).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/旧答案为/u)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始恢复练习" }));
    expect(screen.getByText(/错题恢复练习创建服务未接入/u)).toBeInTheDocument();
    expect(screen.getByText(/不会读取旧答案、创建 RecoveryAttempt/u)).toBeInTheDocument();
  });

  it("does not show confirmed catalog pages while textbook verification is pending", () => {
    const mathCourse = demoCourseCatalog.courses.find((course) => course.subjectCode === "MATH");
    if (mathCourse?.textbookDetail === undefined) {
      throw new Error("Missing demo textbook detail fixture");
    }
    const pendingCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      courses: [
        {
          ...mathCourse,
          textbookDetail: {
            ...mathCourse.textbookDetail,
            status: "PENDING_VERIFICATION",
          },
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=textbook-detail"]}>
        <CourseMaterialsView catalog={pendingCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "数学教材" })).toBeInTheDocument();
    expect(screen.getByText("教材正在核验")).toBeInTheDocument();
    expect(screen.getByText(/候选识别结果不能当作已确认目录/u)).toBeInTheDocument();
    expect(screen.queryByText("P28–P46")).not.toBeInTheDocument();
  });

  it("routes current subject chapter actions to the STU-008 chapter detail", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=subject-detail"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /继续本章学习/u }));

    expect(screen.getByRole("heading", { level: 1, name: "21.2 二次函数的图像" })).toBeInTheDocument();
    expect(screen.getByText("4 个学习步骤")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "知识点顺序" })).toBeInTheDocument();
  });

  it("uses a safe subject boundary when the requested subject is outside the current grade scope", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=CHEMISTRY&view=subject-detail"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "学科范围不可用" })).toBeInTheDocument();
    expect(screen.getByText(/不泄露其他范围/u)).toBeInTheDocument();
  });

  it("does not invent a chapter catalog when API data lacks subject detail", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前单元由服务端返回",
          currentChapter: "当前单元由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      recentMaterials: [],
      materialTypeCounts: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=subject-detail"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "数学课程详情" })).toBeInTheDocument();
    expect(screen.getByText("学科详情服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/不会用前端 Fixture 替代真实服务端结果/u)).toBeInTheDocument();
  });

  it("does not invent a textbook catalog when API data lacks textbook detail", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前单元由服务端返回",
          currentChapter: "当前单元由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=textbook-detail"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "教材详情" })).toBeInTheDocument();
    expect(screen.getByText("教材详情服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补目录/u)).toBeInTheDocument();
  });

  it("does not invent chapter details when API data lacks chapter detail", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前单元由服务端返回",
          currentChapter: "当前单元由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=chapter-detail&chapter=api-chapter-21-2"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "章节详情" })).toBeInTheDocument();
    expect(screen.getByText("章节详情服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补知识点顺序/u)).toBeInTheDocument();
  });

  it("does not invent knowledge point details when API data lacks knowledge point detail", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=knowledge-point-detail&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "知识点详情" })).toBeInTheDocument();
    expect(screen.getByText("知识点详情服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/不会用开发 Fixture 补公式、例题、页码或证据/u)).toBeInTheDocument();
    expect(screen.queryByText("y = a(x-h)² + k")).not.toBeInTheDocument();
  });

  it("does not invent a question hub when API data lacks the STU-010 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=question-hub&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "提问中心" })).toBeInTheDocument();
    expect(screen.getByText("提问中心服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补上下文、预算、提问记录或 AI 可用状态/u)).toBeInTheDocument();
    expect(screen.queryByText("开始文字提问")).not.toBeInTheDocument();
    expect(screen.queryByText("QUESTION_HUB_SERVICE_UNAVAILABLE")).not.toBeInTheDocument();
  });

  it("does not invent a text question composer when API data lacks the STU-011 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=text-question-composer&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "文字提问" })).toBeInTheDocument();
    expect(screen.getByText("文字提问服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补问题草稿、预算或辅导会话/u)).toBeInTheDocument();
    expect(screen.queryByLabelText(/问题描述/u)).not.toBeInTheDocument();
    expect(screen.queryByText("TEXT_QUESTION_SERVICE_UNAVAILABLE")).not.toBeInTheDocument();
  });

  it("does not invent an image question upload page when API data lacks the STU-012 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=image-question-upload&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "单题图片上传" })).toBeInTheDocument();
    expect(screen.getByText("单题图片上传服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补图片草稿、上传资产或 OCR 结果/u)).toBeInTheDocument();
    expect(screen.queryByLabelText("选择单题图片文件")).not.toBeInTheDocument();
    expect(screen.queryByText("IMAGE_QUESTION_UPLOAD_SERVICE_UNAVAILABLE")).not.toBeInTheDocument();
  });

  it("does not invent an OCR confirmation page when API data lacks the STU-013 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=ocr-confirmation&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form&draft=api-question-draft"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "OCR 结果确认" })).toBeInTheDocument();
    expect(screen.getByText("OCR 结果确认服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补 questionDraft、asset、OCR 文本或辅导会话/u)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("y = -2(x + 1)² + 3")).not.toBeInTheDocument();
    expect(screen.queryByText("OCR_CONFIRMATION_SERVICE_UNAVAILABLE")).not.toBeInTheDocument();
  });

  it("does not invent a hint-first tutor session when API data lacks the STU-014 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=hint-first-tutor-session&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form&session=api-tutor-session"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "提示优先辅导" })).toBeInTheDocument();
    expect(screen.getByText("提示优先辅导服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补 tutorSessionId、提示步骤、AI 结果或证据/u)).toBeInTheDocument();
    expect(screen.queryByText(/观察顶点式中的 a = -2/u)).not.toBeInTheDocument();
    expect(screen.queryByText("TUTOR_SESSION_SERVICE_UNAVAILABLE")).not.toBeInTheDocument();
  });

  it("does not invent a tutor result when API data lacks the STU-015 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=tutor-session-result&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form&session=api-tutor-session"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "辅导结果" })).toBeInTheDocument();
    expect(screen.getByText("辅导结果服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补 tutorSessionId、学生结论、错题或掌握证据/u)).toBeInTheDocument();
    expect(screen.getByText(/TUTOR_RESULT_SERVICE_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("y = -2(x - 1)² + 3")).not.toBeInTheDocument();
    expect(screen.queryByText("因为 a = -2 < 0，开口向下。")).not.toBeInTheDocument();
  });

  it("does not invent a practice hub when API data lacks the STU-016 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=practice-hub&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form&target=api-practice-hub"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "练习中心" })).toBeInTheDocument();
    expect(screen.getByText("练习推荐服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/生产环境不会用开发 Fixture 补推荐、错题来源、attemptId 或掌握证据/u)).toBeInTheDocument();
    expect(screen.getByText(/PRACTICE_RECOMMENDATION_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("二次函数图像特征 · 独立练习")).not.toBeInTheDocument();
    expect(screen.queryByText("二次函数图像判断 · 错题恢复")).not.toBeInTheDocument();
  });

  it("renders the STU-017 practice attempt final question without pre-submit judging", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=practice-attempt&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form&target=demo-stu017-practice-attempt-final&attempt=demo-attempt-stu017-vertex-application"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "独立练习" })).toBeInTheDocument();
    expect(screen.getByText("请在无提示状态下完成；提交经确认后才形成练习证据")).toBeInTheDocument();
    expect(screen.getByText("草稿已保存 · 10:47")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "第 5 题 / 共 5 题" })).toBeInTheDocument();
    expect(screen.getByText("已作答 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "第 1 题，已保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "第 5 题，当前" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { level: 2, name: "抛物线拱门的高度与位置" })).toBeInTheDocument();
    expect(screen.getByText("数学 · 21.2 · 二次函数 y=a(x-h)²+k 的图像和性质")).toBeInTheDocument();
    expect(screen.getByText(/一座拱门的轮廓可近似表示为 y = -1\/2\(x - 2\)² \+ 4/u)).toBeInTheDocument();
    expect(screen.getByText("本题不提供提示，也不会在提交前判断对错。")).toBeInTheDocument();

    expect(screen.getByLabelText("顶点")).toHaveValue("(2, 4)");
    expect(screen.getByLabelText("对称轴")).toHaveValue("x = 2");
    expect(screen.getByLabelText("当 y = 2 时")).toHaveValue("x = 0 或 x = 4");
    expect(screen.getByLabelText("计算过程")).toHaveValue("令 -1/2(x-2)² +4=2，\n则 (x-2)²=4，\n所以 x = 0 或 x = 4。");
    expect(screen.getByText("48 / 300")).toBeInTheDocument();
    expect(screen.getByText("当前题已保存 · 尚未提交")).toBeInTheDocument();
    expect(screen.getByText("服务端草稿")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "练习作答辅助信息" });
    expect(within(rail).getByText("练习进度")).toBeInTheDocument();
    expect(within(rail).getByText("独立作答规则")).toBeInTheDocument();
    expect(within(rail).getByText("证据状态")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getByText("提交结果未知时")).toBeInTheDocument();
    expect(within(rail).getByText("只有服务端确认提交后，才可能形成一次有效练习证据。")).toBeInTheDocument();
    expect(screen.getByText(/正式 attemptId、题目、草稿、提交状态/u)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "提交结果未知" })).not.toBeInTheDocument();
    expect(screen.queryByText("回答正确")).not.toBeInTheDocument();
    expect(screen.queryByText("回答错误")).not.toBeInTheDocument();
    expect(screen.queryByText("掌握证据已更新")).not.toBeInTheDocument();
  });

  it("requires confirmation before STU-017 submit and keeps unknown submissions idempotent", async () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=practice-attempt&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form&target=demo-stu017-practice-attempt-final&attempt=demo-attempt-stu017-vertex-application"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("顶点"), { target: { value: "(2,4)" } });
    expect(screen.getByText("正在保存草稿")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交全部答案 →" }));

    const dialog = screen.getByRole("dialog", { name: "提交全部答案？" });
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByText(/提交后不可修改；将提交第 1–5 题当前答案/u)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "提交结果未知" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "确认提交" }));

    expect(await screen.findByRole("heading", { level: 2, name: "提交结果未知" })).toBeInTheDocument();
    expect(screen.getByText(/提交结果尚未确认；当前不会重复提交、创建第二个 attempt/u)).toBeInTheDocument();
    expect(screen.getByDisplayValue("(2,4)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交全部答案 →" })).toBeDisabled();
    expect(screen.queryByText("LearningEvidence 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("Mistake 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("Mastery 已更新")).not.toBeInTheDocument();
  });

  it("renders the STU-018 practice result from a confirmed server result without claiming mastery", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=practice-result&chapter=demo-chapter-21-2&knowledge=demo-kp-quadratic-vertex-form&target=demo-stu018-practice-result-wrong-item-created&attempt=demo-attempt-stu017-vertex-application"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "练习结果" })).toBeInTheDocument();
    expect(screen.getByText("本次结果已经确认；下面只说明证据、错因与下一步。")).toBeInTheDocument();
    expect(screen.getByText("提交已确认 · 10:49")).toBeInTheDocument();
    expect(screen.getByLabelText("1 题需要订正")).toBeInTheDocument();
    expect(screen.getByText("5题均已判定：4题正确，1题错误。")).toBeInTheDocument();
    expect(screen.getByText("本次独立作答已被记录；一次练习结果不等于已经掌握。")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "需要订正" })).toBeInTheDocument();
    expect(screen.getByText("第3题 · 对称轴判断")).toBeInTheDocument();
    expect(screen.getByText("已知 y = 2(x + 1)² - 3，这条抛物线的对称轴是什么？")).toBeInTheDocument();
    expect(screen.getByText("x = 1")).toBeInTheDocument();
    expect(screen.getByText("x = -1")).toBeInTheDocument();
    expect(screen.getByText("把 x + 1 = 0 错解为 x = 1。")).toBeInTheDocument();
    expect(screen.getByText("顶点式 y=a(x-h)²+k 的对称轴是 x=h；这里 x+1=x-(-1)，所以 h=-1。")).toBeInTheDocument();
    expect(screen.getByText("错题记录已创建 · 待订正")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "练习结果辅助信息" });
    expect(within(rail).getByText("提交记录")).toBeInTheDocument();
    expect(within(rail).getByText("证据状态")).toBeInTheDocument();
    expect(within(rail).getByText("错题状态")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getAllByText("PRACTICE_RESULT_UNKNOWN").length).toBeGreaterThanOrEqual(1);
    expect(within(rail).getAllByText(/不会因一次练习直接标记为已掌握/u).length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole("heading", { level: 2, name: "已确认正确" })).toBeInTheDocument();
    expect(screen.getByText("开口方向判断")).toBeInTheDocument();
    expect(screen.getByText("顶点坐标")).toBeInTheDocument();
    expect(screen.queryByText("判断 y = -2(x - 1)² + 3 的开口方向。")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开全部正确题" }));

    expect(screen.getByText("判断 y = -2(x - 1)² + 3 的开口方向。")).toBeInTheDocument();
    expect(screen.getByText("(-1, -3)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "继续下一项 →" }));

    expect(screen.getByText(/继续下一项需要服务端推荐目标/u)).toBeInTheDocument();
    expect(screen.queryByText("掌握证据已更新")).not.toBeInTheDocument();
    expect(screen.queryByText("LearningEvidence 已创建")).not.toBeInTheDocument();
    expect(screen.getByText(/正式 correctCount、wrongCount、judgedCount/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看错题详情 →" }));

    expect(screen.getByRole("heading", { level: 1, name: "错题详情" })).toBeInTheDocument();
    expect(screen.getByText("先看事实与错因，再开始一次新的独立订正。")).toBeInTheDocument();
    expect(screen.getByText("对称轴判断")).toBeInTheDocument();
    expect(screen.getByText(/正式 wrongItem、原题、原答、判定/u)).toBeInTheDocument();
  });

  it("does not invent a practice result when API data lacks the STU-018 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=practice-result&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form&target=api-practice-result&attempt=api-attempt"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "练习结果" })).toBeInTheDocument();
    expect(screen.getByText("练习结果服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-018 练习结果文档/u)).toBeInTheDocument();
    expect(screen.getByText(/PRACTICE_RESULT_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.queryByText("5题均已判定：4题正确，1题错误。")).not.toBeInTheDocument();
    expect(screen.queryByText("错题记录已创建 · 待订正")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-018/u)).not.toBeInTheDocument();
  });

  it("renders the STU-020 wrong item detail without creating correction or mastery evidence", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-item-detail&target=demo-stu020-wrong-item-detail-pending-correction&wrongItem=demo-wrong-item-stu018-axis-sign"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "错题详情" })).toBeInTheDocument();
    expect(screen.getByText("先看事实与错因，再开始一次新的独立订正。")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-08-22，星期六，待订正 · 创建于 10:49")).toBeInTheDocument();
    expect(screen.getByLabelText("原练习第 3 题")).toBeInTheDocument();
    expect(screen.getByText("对称轴判断")).toBeInTheDocument();
    expect(screen.getByText("数学 · 21.2 二次函数图像与性质")).toBeInTheDocument();
    expect(screen.getByText("已知 y = 2(x + 1)² - 3，这条抛物线的对称轴是什么？")).toBeInTheDocument();
    expect(screen.getByText("来源：独立练习 · 提交与判定均已确认")).toBeInTheDocument();
    expect(screen.getByText("我的原答")).toBeInTheDocument();
    expect(screen.getAllByText("x = 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("正确结论")).toBeInTheDocument();
    expect(screen.getAllByText("x = -1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("原作答已提交，不可修改；订正将创建新的作答记录。")).toBeInTheDocument();
    expect(screen.getByText("错误位置")).toBeInTheDocument();
    expect(screen.getByText("对称轴符号")).toBeInTheDocument();
    expect(screen.getByText("原作答过程")).toBeInTheDocument();
    expect(screen.getByText("由 x + 1 = 0 得到 x = 1")).toBeInTheDocument();
    expect(screen.getByText("关键差异")).toBeInTheDocument();
    expect(screen.getByText("x + 1 = x - (-1)")).toBeInTheDocument();
    expect(screen.getByText("需要改正")).toBeInTheDocument();
    expect(screen.getByText("先写成 x - h 的形式，再确认 h 的符号")).toBeInTheDocument();
    expect(screen.getByText("顶点式 y=a(x-h)²+k 的对称轴是 x=h；本题 h=-1。")).toBeInTheDocument();
    expect(screen.getByText("原作答")).toBeInTheDocument();
    expect(screen.getAllByText("已确认 · 10:49").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("独立订正")).toBeInTheDocument();
    expect(screen.getAllByText("尚未开始").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("到期复习")).toBeInTheDocument();
    expect(screen.getByText("订正通过后安排")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "错题详情辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-020 right rail");
    }
    expect(within(rail).getByText("当前状态")).toBeInTheDocument();
    expect(within(rail).getByText("证据可靠性")).toBeInTheDocument();
    expect(within(rail).getByText("来源信息")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getByText("仅当前学生本人可见完整原答")).toBeInTheDocument();
    expect(within(rail).getAllByText("WRONG_ITEM_DETAIL_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);

    const wrongBookLink = screen.getByRole("link", { name: "返回错题本" });
    expect(wrongBookLink).toHaveAttribute("href", expect.stringContaining("view=wrong-book"));
    expect(wrongBookLink).toHaveAttribute("href", expect.stringContaining("target=demo-stu019-wrong-book-list"));
    const practiceResultLink = screen.getByRole("link", { name: "查看原练习结果" });
    expect(practiceResultLink).toHaveAttribute("href", expect.stringContaining("view=practice-result"));
    expect(practiceResultLink).toHaveAttribute("href", expect.stringContaining("target=demo-stu018-practice-result-wrong-item-created"));

    fireEvent.click(within(rail).getByRole("button", { name: "查看提交记录" }));
    expect(screen.getByText(/提交记录是只读授权资源/u)).toBeInTheDocument();
    expect(screen.queryByText("LearningEvidence 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("Mistake 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("RecoveryAttempt 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("Mastery 已更新")).not.toBeInTheDocument();
    expect(screen.getByText(/正式 wrongItem、原题、原答、判定/u)).toBeInTheDocument();

    const correctionLink = screen.getByRole("link", { name: "开始订正" });
    expect(correctionLink).toHaveAttribute("href", expect.stringContaining("view=wrong-item-correction"));
    expect(correctionLink).toHaveAttribute("href", expect.stringContaining("target=demo-stu021-correction-flow-ready-to-submit"));
    fireEvent.click(correctionLink);

    expect(screen.getByRole("heading", { level: 1, name: "错题订正" })).toBeInTheDocument();
    expect(screen.getByText("重新写出答案并说明错因；订正通过后仍需到期复习。")).toBeInTheDocument();
    expect(screen.getByLabelText("我的订正答案")).toHaveValue("x = -1");
    expect(screen.queryByText(/STU-021 错题订正将按顺序实现/u)).not.toBeInTheDocument();
  });

  it("renders the STU-021 wrong item correction form and keeps submission evidence bounded", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-item-correction&target=demo-stu021-correction-flow-ready-to-submit&wrongItem=demo-wrong-item-stu018-axis-sign"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "错题订正" })).toBeInTheDocument();
    expect(screen.getByText("重新写出答案并说明错因；订正通过后仍需到期复习。")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-08-22，星期六，草稿已保存 · 10:56")).toBeInTheDocument();
    expect(screen.getByLabelText("重新作答")).toBeInTheDocument();
    expect(screen.getAllByText("说明错因").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("提交订正").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("已填写").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("尚未提交").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("对称轴判断").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("数学 · 21.2 二次函数图像与性质")).toBeInTheDocument();
    expect(screen.getByText("已知 y = 2(x + 1)² - 3，这条抛物线的对称轴是什么？")).toBeInTheDocument();
    expect(screen.getByText("本页默认收起原答案与正确结论，请重新完成。")).toBeInTheDocument();
    const originalRecordToggle = screen.getByText("查看原错误记录");
    expect(originalRecordToggle).toBeInTheDocument();
    const originalRecordDetails = originalRecordToggle.closest("details");
    expect(originalRecordDetails).not.toBeNull();
    expect(originalRecordDetails).not.toHaveAttribute("open");
    fireEvent.click(originalRecordToggle);
    expect(originalRecordDetails).toHaveAttribute("open");
    expect(screen.getByText("我的原答")).toBeInTheDocument();

    expect(screen.getByLabelText("我的订正答案")).toHaveValue("x = -1");
    expect(screen.getByLabelText("判断过程")).toHaveValue("x + 1 = x - (-1)，因此顶点式中的 h=-1，对称轴是 x=-1。");
    expect(screen.getByText(/\/ 300/u)).toBeInTheDocument();
    expect(screen.getByText("当前作答已保存 · 尚未提交")).toBeInTheDocument();

    expect(screen.getByText("这次错误主要发生在哪里？请选择最符合的一项。")).toBeInTheDocument();
    expect(screen.getByLabelText("对 x-h 中 h 的符号判断错误。")).toBeChecked();
    expect(screen.getByLabelText("忘记顶点式的对称轴规则。")).not.toBeChecked();
    expect(screen.getByLabelText("我的说明")).toHaveValue("我把 x+1 看成了 h=1，没有先改写成 x-(-1)。");
    expect(screen.getByText("错因说明用于订正记录，不会公开给其他学生。")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "错题订正辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-021 right rail");
    }
    expect(within(rail).getByText("订正进度")).toBeInTheDocument();
    expect(within(rail).getByText("证据状态")).toBeInTheDocument();
    expect(within(rail).getByText("订正规则")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getByText("订正证据")).toBeInTheDocument();
    expect(within(rail).getByText("0")).toBeInTheDocument();
    expect(within(rail).getByText("复习计划")).toBeInTheDocument();
    expect(within(rail).getByText("尚未生成")).toBeInTheDocument();
    expect(within(rail).getByText("恢复状态")).toBeInTheDocument();
    expect(within(rail).getByText("尚未成立")).toBeInTheDocument();
    expect(within(rail).getByText("不等于已经恢复")).toBeInTheDocument();
    expect(within(rail).getByText("CORRECTION_SUBMISSION_UNKNOWN")).toBeInTheDocument();

    const detailLink = screen.getByRole("link", { name: "返回错题详情" });
    expect(detailLink).toHaveAttribute("href", expect.stringContaining("view=wrong-item-detail"));
    expect(detailLink).toHaveAttribute("href", expect.stringContaining("target=demo-stu020-wrong-item-detail-pending-correction"));

    fireEvent.click(screen.getByRole("button", { name: /提交订正/u }));
    expect(screen.getByRole("dialog", { name: "确认提交订正" })).toBeInTheDocument();
    expect(screen.getByText("重新作答：x = -1")).toBeInTheDocument();
    expect(screen.getByText("提交结果以服务端确认为准，不能直接标记已恢复或已掌握。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));
    expect(screen.queryByRole("dialog", { name: "确认提交订正" })).not.toBeInTheDocument();
    expect(screen.getByText(/CORRECTION_SUBMISSION_UNKNOWN：提交结果未知时先查询原提交状态/u)).toBeInTheDocument();
    expect(within(rail).getByText("结果未知")).toBeInTheDocument();
    expect(within(rail).getByText("未知，待服务端查询")).toBeInTheDocument();
    expect(within(rail).getByText("未知时不生成新计划")).toBeInTheDocument();
    expect(screen.queryByText("LearningEvidence 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("RecoveryAttempt 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("Mastery 已更新")).not.toBeInTheDocument();
    expect(screen.getByText(/正式 wrongItemId、correctionId、草稿版本/u)).toBeInTheDocument();
  });

  it("opens the STU-022 due review attempt from a pending review wrong-book record", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-book&target=demo-stu019-wrong-book-list&wrongStatus=pending-review"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    const firstPendingReviewButton = screen.getAllByRole("button", { name: /打开详情/u })[0];
    if (firstPendingReviewButton === undefined) {
      throw new Error("Missing STU-022 pending review entry");
    }
    fireEvent.click(firstPendingReviewButton);

    expect(screen.getByRole("heading", { level: 1, name: "到期复习" })).toBeInTheDocument();
    expect(screen.getByText("不显示旧答案，用一条新题确认这次是否真正恢复。")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-08-29，星期六，已到期 · 草稿已保存 · 09:12")).toBeInTheDocument();
    expect(screen.getByText("订正已通过")).toBeInTheDocument();
    expect(screen.getByText("复习已到期")).toBeInTheDocument();
    expect(screen.getByText("独立作答中")).toBeInTheDocument();
    expect(screen.getByLabelText("复习题")).toBeInTheDocument();

    expect(screen.getByText("顶点式中的图像特征")).toBeInTheDocument();
    expect(screen.getByText("数学 · 21.2 二次函数图像与性质")).toBeInTheDocument();
    expect(screen.getByText("同知识点新变式 · 不重复原题数值")).toBeInTheDocument();
    expect(screen.getByText("已知 y = -3(x - 2)² + 5。请写出这条抛物线的开口方向、对称轴和顶点。")).toBeInTheDocument();
    expect(screen.getByText("原题、原答案、正确结论和订正内容均已隐藏。")).toBeInTheDocument();
    expect(screen.getByText("本题不提供提示，也不会在提交前判断对错。")).toBeInTheDocument();

    expect(screen.getByLabelText("开口方向")).toHaveValue("向下");
    expect(screen.getByLabelText("对称轴")).toHaveValue("x = 2");
    expect(screen.getByLabelText("顶点")).toHaveValue("(2, 5)");
    expect(screen.getByLabelText("判断过程")).toHaveValue("a = -3 < 0，所以开口向下；x - 2 表示 h = 2，因此对称轴是 x = 2，顶点是 (2, 5)。");
    expect(screen.getByText("当前复习答案已保存 · 尚未提交")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "到期复习辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-022 right rail");
    }
    expect(within(rail).getByText("到期门控")).toBeInTheDocument();
    expect(within(rail).getByText("旧答案保护")).toBeInTheDocument();
    expect(within(rail).getByText("原题答案")).toBeInTheDocument();
    expect(within(rail).getAllByText("已隐藏").length).toBeGreaterThanOrEqual(4);
    expect(within(rail).getByText("证据状态")).toBeInTheDocument();
    expect(within(rail).getByText("复习证据")).toBeInTheDocument();
    expect(within(rail).getByText("0")).toBeInTheDocument();
    expect(within(rail).queryByText("REVIEW_SUBMISSION_UNKNOWN")).not.toBeInTheDocument();
    expect(screen.queryByText("x = 1")).not.toBeInTheDocument();
    expect(screen.queryByText("x = -1")).not.toBeInTheDocument();
    expect(screen.queryByText("LearningEvidence 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("RecoveryAttempt 已创建")).not.toBeInTheDocument();
    expect(screen.queryByText("Mastery 已更新")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /提交复习答案/u }));
    expect(screen.getByRole("dialog", { name: "确认提交复习答案" })).toBeInTheDocument();
    expect(screen.getByText("提交前不会显示旧答案、订正答案或历史解析。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));
    expect(screen.queryByRole("dialog", { name: "确认提交复习答案" })).not.toBeInTheDocument();
    expect(screen.getByText(/REVIEW_SUBMISSION_UNKNOWN：提交结果未知时先查询原提交状态/u)).toBeInTheDocument();
    expect(within(rail).getByText("REVIEW_SUBMISSION_UNKNOWN")).toBeInTheDocument();
    expect(within(rail).getByText("结果未知，先查询原提交")).toBeInTheDocument();
    expect(screen.getByText(/正式 reviewId、到期资格、新变式题/u)).toBeInTheDocument();
  });

  it("renders the STU-023 review result without inventing permanent mastery", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=review-result&target=demo-stu023-review-result-recovered&wrongItem=demo-wrong-item-opening-direction-review&review=demo-review-stu022-vertex-features-due"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "复习结果" })).toBeInTheDocument();
    expect(screen.getByText("本次独立复习已经确认；下面说明恢复证据及其有限影响。")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-08-29，星期六，结果已确认 · 09:14")).toBeInTheDocument();
    expect(screen.getByLabelText("1 条错题已恢复")).toBeInTheDocument();
    expect(screen.getByText("本次复习已通过，作答与判断均由服务端确认。")).toBeInTheDocument();
    expect(screen.getByText("复习题已确认")).toBeInTheDocument();
    expect(screen.getByText("新增独立复习证据")).toBeInTheDocument();
    expect(screen.getByText("错题状态已更新")).toBeInTheDocument();
    expect(screen.getByText("恢复只针对这条错题；一次复习不会把整个知识点永久标记为掌握。")).toBeInTheDocument();

    expect(screen.getByText("顶点式中的图像特征")).toBeInTheDocument();
    expect(screen.getByText("y=-3(x-2)²+5")).toBeInTheDocument();
    expect(screen.getByText("写出开口方向、对称轴和顶点")).toBeInTheDocument();
    expect(screen.getByText("向下")).toBeInTheDocument();
    expect(screen.getByText("x=2")).toBeInTheDocument();
    expect(screen.getByText("(2,5)")).toBeInTheDocument();
    expect(screen.getAllByText("正确").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("a=-3<0，所以开口向下；h=2，故对称轴为x=2，顶点为(2,5)。")).toBeInTheDocument();
    expect(screen.getByText("同知识点新变式 · 提交前未下发旧答案与历史解析")).toBeInTheDocument();

    expect(screen.getByText("为什么可以标记本条已恢复")).toBeInTheDocument();
    expect(screen.getByText("2026-08-29 09:00 后作答。")).toBeInTheDocument();
    expect(screen.getByText("同知识点新变式，不重复原题数值。")).toBeInTheDocument();
    expect(screen.getByText("无提示，旧答案保护已启用。")).toBeInTheDocument();
    expect(screen.getByText("服务端已确认全部可判且正确。")).toBeInTheDocument();
    expect(screen.getByText("这些证据足以更新本条错题状态，但不足以单独证明长期掌握。")).toBeInTheDocument();

    expect(screen.getByText("原作答错误")).toBeInTheDocument();
    expect(screen.getByText("订正通过")).toBeInTheDocument();
    expect(screen.getByText("到期复习")).toBeInTheDocument();
    expect(screen.getByText("复习通过")).toBeInTheDocument();
    expect(screen.getByText("当前 · 已恢复")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "复习结果辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-023 right rail");
    }
    expect(within(rail).getByText("结果确认")).toBeInTheDocument();
    expect(within(rail).getByText("错题状态")).toBeInTheDocument();
    expect(within(rail).getByText("原状态")).toBeInTheDocument();
    expect(within(rail).getByText("待复习")).toBeInTheDocument();
    expect(within(rail).getByText("当前状态")).toBeInTheDocument();
    expect(within(rail).getByText("已恢复")).toBeInTheDocument();
    expect(within(rail).getByText("掌握证据影响")).toBeInTheDocument();
    expect(within(rail).getByText("不由本次单独决定")).toBeInTheDocument();
    expect(within(rail).queryByText("REVIEW_RESULT_UNKNOWN")).not.toBeInTheDocument();

    const evidenceLink = screen.getByRole("link", { name: /查看知识点证据/u });
    expect(evidenceLink).toHaveAttribute("href", expect.stringContaining("view=knowledge-point-target"));
    expect(evidenceLink).toHaveAttribute("href", expect.stringContaining("action=EVIDENCE"));
    expect(evidenceLink).toHaveAttribute("href", expect.stringContaining("knowledge=demo-kp-quadratic-vertex-form"));
    expect(screen.getByRole("link", { name: "返回错题本" })).toHaveAttribute("href", expect.stringContaining("view=wrong-book"));

    fireEvent.click(screen.getByRole("button", { name: "继续下一项" }));
    expect(screen.getByText("当前没有服务端推荐的下一项；正式服务接入前不会随机生成复习任务。")).toBeInTheDocument();
    expect(screen.queryByText("Mastery 已更新")).not.toBeInTheDocument();
    expect(screen.getByText(/正式 reviewId、复习结果、wrongItem 状态/u)).toBeInTheDocument();
  });

  it("renders the STU-024 exam list with manual facts, filters, and entry boundaries", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-list&target=demo-stu024-exam-list-manual-basic"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "考试记录" })).toBeInTheDocument();
    expect(screen.getByText("只记录本人确认的考试事实与失分项，不猜测缺失信息。")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-08-29，星期六，记录已更新 · 09:18")).toBeInTheDocument();
    expect(screen.getByLabelText("3 场考试")).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "全部 3" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "记录完整 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "待补录 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "分析处理中 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("全部科目")).toHaveValue("ALL_SUBJECTS");
    expect(screen.getByLabelText("考试排序")).toHaveValue("EXAM_DATE_DESC");

    expect(screen.getByRole("listitem", { name: /1，第21章 二次函数单元检测，数学 · 单元检测，2026-08-28，96 \/ 120/u })).toBeInTheDocument();
    expect(screen.getAllByText("本人确认量尺").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("失分项 3 条")).toBeInTheDocument();
    expect(screen.getByText("均已确认")).toBeInTheDocument();
    expect(screen.getByText("Unit 6 Reading & Grammar 小测")).toBeInTheDocument();
    expect(screen.getByText("失分项 2 / 3 已确认")).toBeInTheDocument();
    expect(screen.getByText("还需补录 1 条失分项")).toBeInTheDocument();
    expect(screen.getByText("《桃花源记》阅读检测")).toBeInTheDocument();
    expect(screen.getByText("分析正在生成")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "考试记录辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-024 right rail");
    }
    expect(within(rail).getByText("今日关注")).toBeInTheDocument();
    expect(within(rail).getByText("待补录")).toBeInTheDocument();
    expect(within(rail).getAllByText("1 场").length).toBeGreaterThanOrEqual(2);
    expect(within(rail).getByText("录入范围")).toBeInTheDocument();
    expect(within(rail).getByText("手工基础录入")).toBeInTheDocument();
    expect(within(rail).getByText("整卷图片辅助录入")).toBeInTheDocument();
    expect(within(rail).getByText("本版本未开放")).toBeInTheDocument();
    expect(within(rail).getByText("分析规则")).toBeInTheDocument();
    expect(within(rail).getByText("不提供排名或班级比较")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).queryByText("EXAM_LIST_UNAVAILABLE")).not.toBeInTheDocument();

    expect(screen.queryByText("班级均分")).not.toBeInTheDocument();
    expect(screen.queryByText("排名")).not.toBeInTheDocument();
    expect(screen.queryByText("百分位")).not.toBeInTheDocument();
    expect(screen.queryByText("OCR试卷导入")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "待补录 1" }));

    expect(screen.getByRole("tab", { name: "待补录 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Unit 6 Reading & Grammar 小测")).toBeInTheDocument();
    expect(screen.queryByText("第21章 二次函数单元检测")).not.toBeInTheDocument();
    expect(screen.queryByText("《桃花源记》阅读检测")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "全部 3" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "记录完整 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /继续补录/u }));
    expect(screen.getByRole("heading", { level: 1, name: "考试录入" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unit 6 Reading & Grammar 小测")).toBeInTheDocument();
    expect(screen.getByText(/差额 3 · 需继续校验/u)).toBeInTheDocument();
    expect(screen.queryByText("examId 已创建")).not.toBeInTheDocument();
  });

  it("opens the STU-025 exam entry ready-to-save state from the STU-024 new action", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-list&target=demo-stu024-exam-list-manual-basic"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /新建考试记录/u }));
    expect(screen.getByRole("heading", { level: 1, name: "考试录入" })).toBeInTheDocument();
    expect(screen.getByText("手工记录本人确认的考试事实与失分项，不补造缺失内容。")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-08-29，星期六，草稿已保存 · 09:24")).toBeInTheDocument();
    expect(screen.getAllByText("考试事实").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("3条已确认").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue("第21章 二次函数单元检测")).toBeInTheDocument();
    expect(screen.getByDisplayValue("数学")).toBeInTheDocument();
    expect(screen.getByDisplayValue("单元检测")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-08-28")).toBeInTheDocument();
    expect(screen.getByDisplayValue("第21章 二次函数")).toBeInTheDocument();
    expect(screen.getByDisplayValue("未填写 · 不作猜测")).toBeInTheDocument();
    expect(screen.getByDisplayValue("96")).toBeInTheDocument();
    expect(screen.getByDisplayValue("120")).toBeInTheDocument();
    expect(screen.getByText(/总失分 = 120 - 96 = 24/u)).toBeInTheDocument();
    expect(screen.getByDisplayValue("对称轴与顶点")).toBeInTheDocument();
    expect(screen.getByDisplayValue("符号判断错误")).toBeInTheDocument();
    expect(screen.getByDisplayValue("二次函数图像平移")).toBeInTheDocument();
    expect(screen.getByDisplayValue("坐标读取错误")).toBeInTheDocument();
    expect(screen.getByDisplayValue("二次函数实际应用")).toBeInTheDocument();
    expect(screen.getByDisplayValue("方程未完整列出")).toBeInTheDocument();
    expect(screen.getByText(/与总失分 24 一致 · 可以保存/u)).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "考试录入辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-025 right rail");
    }
    expect(within(rail).getByText("录入完整度")).toBeInTheDocument();
    expect(within(rail).getByText("分数校验")).toBeInTheDocument();
    expect(within(rail).getByText("校验一致")).toBeInTheDocument();
    expect(within(rail).getByText("当前范围")).toBeInTheDocument();
    expect(within(rail).getByText("不使用导入")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).queryByText("EXAM_SAVE_UNKNOWN")).not.toBeInTheDocument();

    expect(screen.queryByText("班级均分")).not.toBeInTheDocument();
    expect(screen.queryByText("排名")).not.toBeInTheDocument();
    expect(screen.queryByText("百分位")).not.toBeInTheDocument();
    expect(screen.queryByText("自动阅卷成功")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("第 1 条失分"), { target: { value: "7" } });
    expect(screen.getByText(/差额 1 · 需继续校验/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保存考试记录/u })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("第 1 条失分"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(screen.getByText(/与总失分 24 一致 · 可以保存/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /保存考试记录/u }));
    expect(screen.getByRole("dialog", { name: "确认保存考试记录" })).toBeInTheDocument();
    expect(screen.getByText(/不会上传整张试卷，也不会调用 OCR 或自动阅卷/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认保存" }));
    expect(screen.getAllByText(/EXAM_SAVE_UNKNOWN/u).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/当前不会重复创建考试、生成 examId、开始分析或写入云端笔记/u)).toBeInTheDocument();
    expect(screen.queryByText("examId 已创建")).not.toBeInTheDocument();
  });

  it("opens the STU-026 exam detail from a complete STU-024 record without creating exam routes", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-list&target=demo-stu024-exam-list-manual-basic"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    const openDetailButton = screen.getAllByRole("button", { name: /打开详情/u })[0];
    if (openDetailButton === undefined) {
      throw new Error("Missing STU-026 detail entry");
    }
    fireEvent.click(openDetailButton);

    expect(screen.getByRole("heading", { level: 1, name: "考试详情" })).toBeInTheDocument();
    expect(screen.getByText("展示本人确认的考试事实、失分项与可用分析。")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-08-29，星期六，详情已更新 · 09:30")).toBeInTheDocument();
    expect(screen.getByLabelText("96分，满分120分，本人确认量尺")).toBeInTheDocument();
    expect(screen.getByText("/120 · 本人确认量尺")).toBeInTheDocument();
    expect(screen.getByText("第21章 二次函数单元检测")).toBeInTheDocument();
    expect(screen.getByText("数学 · 单元检测")).toBeInTheDocument();
    expect(screen.getByText("2026-08-28")).toBeInTheDocument();
    expect(screen.getByText("第21章 二次函数")).toBeInTheDocument();
    expect(screen.getByText("未填写 · 不作猜测")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("总失分")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("已确认失分项")).toBeInTheDocument();
    expect(screen.getAllByText("完整").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("录入状态")).toBeInTheDocument();

    expect(screen.getByRole("listitem", { name: /题号 6，失分 8，对称轴与顶点，符号判断错误，已确认/u })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /题号 9，失分 10，二次函数图像平移，坐标读取错误，已确认/u })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /题号 12，失分 6，二次函数实际应用，方程未完整列出，已确认/u })).toBeInTheDocument();
    expect(screen.getByText("8 + 10 + 6 = 24")).toBeInTheDocument();
    expect(screen.getByText("与总失分 24 一致")).toBeInTheDocument();

    expect(screen.getByText("分析可查看")).toBeInTheDocument();
    expect(screen.getByText("依据：3条已确认失分项")).toBeInTheDocument();
    expect(screen.getByText("生成于 2026-08-29 09:29")).toBeInTheDocument();
    expect(screen.getByText("只分析已确认事实；教材未填写不会被自动补造。")).toBeInTheDocument();
    expect(screen.getByText("当前版本为手工基础记录，不包含整卷图片、OCR导入或自动阅卷。")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "考试详情辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-026 right rail");
    }
    expect(within(rail).getByText("记录状态")).toBeInTheDocument();
    expect(within(rail).getByText("已确认 · 09:26")).toBeInTheDocument();
    expect(within(rail).getByText("录入完整度")).toBeInTheDocument();
    expect(within(rail).getByText("满足分析基础")).toBeInTheDocument();
    expect(within(rail).getByText("分析状态")).toBeInTheDocument();
    expect(within(rail).getByText("下一页 STU-027")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).queryByText("EXAM_DETAIL_UNAVAILABLE")).not.toBeInTheDocument();

    expect(screen.queryByText("班级均分")).not.toBeInTheDocument();
    expect(screen.queryByText("排名")).not.toBeInTheDocument();
    expect(screen.queryByText("百分位")).not.toBeInTheDocument();
    expect(screen.queryByText("等级")).not.toBeInTheDocument();
    expect(screen.queryByText("自动阅卷成功")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /查看失分分析/u }));
    expect(screen.getByRole("heading", { level: 1, name: "考试分析" })).toBeInTheDocument();
    expect(screen.getByText("只依据已确认失分项给出可追溯归因与补救顺序。")).toBeInTheDocument();
    expect(screen.getByText("条可追溯归因")).toBeInTheDocument();
    expect(screen.queryByText("analysisId 已创建")).not.toBeInTheDocument();
  });

  it("renders STU-027 exam analysis with traceable attributions and routes into STU-028 remediation plan", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-analysis&target=demo-stu027-exam-analysis-math-unit-21&exam=demo-exam-stu024-math-unit-21&analysis=demo-analysis-stu027-math-unit-21"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "考试分析" })).toBeInTheDocument();
    expect(screen.getByText("2026-08-29")).toBeInTheDocument();
    expect(screen.getByText("分析已生成")).toBeInTheDocument();
    expect(screen.getByText("第21章 二次函数单元检测")).toBeInTheDocument();
    expect(screen.getAllByText("96 / 120").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("24").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3条失分项已确认")).toBeInTheDocument();

    expect(screen.getAllByText("图像平移与坐标读取").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/第9题/u)).toBeInTheDocument();
    expect(screen.getByText(/失分10/u)).toBeInTheDocument();
    expect(screen.getByText("坐标读取错误")).toBeInTheDocument();
    expect(screen.getAllByText("本人确认的失分项").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("事实已确认").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("对称轴与顶点符号").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/第6题/u)).toBeInTheDocument();
    expect(screen.getByText(/失分8/u)).toBeInTheDocument();
    expect(screen.getAllByText("实际应用列式完整性").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/第12题/u)).toBeInTheDocument();
    expect(screen.getByText(/失分6/u)).toBeInTheDocument();
    expect(screen.getByText("本分析覆盖已确认失分 24 / 24；没有未归因的已确认失分。")).toBeInTheDocument();
    expect(screen.getByText("教材未填写、原题全文未录入，因此分析不扩展到具体教材页码或未记录的题目细节。")).toBeInTheDocument();

    expect(screen.getAllByText("约20分钟").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("失分最多，并影响后续图像位置判断")).toBeInTheDocument();
    expect(screen.getByText("知识点回看 → 2道无提示练习")).toBeInTheDocument();
    expect(screen.getByText("约15分钟")).toBeInTheDocument();
    expect(screen.getByText("规则辨认 → 1道独立练习")).toBeInTheDocument();
    expect(screen.getByText("预计 55 分钟 · 顺序来自已确认失分与基础依赖")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "考试分析辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-027 right rail");
    }
    expect(within(rail).getByText("分析来源")).toBeInTheDocument();
    expect(within(rail).getByText("考试版本")).toBeInTheDocument();
    expect(within(rail).getByText("可靠性")).toBeInTheDocument();
    expect(within(rail).getByText("归因分组")).toBeInTheDocument();
    expect(within(rail).getByText("数据边界")).toBeInTheDocument();
    expect(within(rail).getByText("试卷图片")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).queryByText("EXAM_ANALYSIS_UNKNOWN")).not.toBeInTheDocument();

    expect(screen.queryByText("班级均分")).not.toBeInTheDocument();
    expect(screen.queryByText("排名")).not.toBeInTheDocument();
    expect(screen.queryByText("百分位")).not.toBeInTheDocument();
    expect(screen.queryByText("能力百分比")).not.toBeInTheDocument();
    expect(screen.queryByText("自动阅卷成功")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /查看失分项/u }));
    expect(screen.getByRole("heading", { level: 3, name: "当前分析来源链" })).toBeInTheDocument();
    expect(screen.getByText(/sourceLossItemId: demo-exam-detail-loss-q9/u)).toBeInTheDocument();
    expect(screen.getAllByText(/examVersion: exam-version-20260829-0926/u).length).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: /打开补救计划/u }));
    expect(screen.getByRole("heading", { level: 1, name: "补救计划" })).toBeInTheDocument();
    expect(screen.getByText("按已确认失分与基础依赖，逐项完成本次考试补救。")).toBeInTheDocument();
    expect(screen.getAllByText("当前任务").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("任务完成只记录补救进度；有效作答仍由对应学习页面与服务端确认。")).toBeInTheDocument();
    expect(screen.queryByText("planId 已创建")).not.toBeInTheDocument();
  });

  it("renders STU-028 remediation plan with partial progress, task contract, and completion boundaries", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=remediation-plan&target=demo-stu028-remediation-plan-partial&exam=demo-exam-stu024-math-unit-21&analysis=demo-analysis-stu027-math-unit-21&plan=demo-plan-stu028-math-unit-21"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "补救计划" })).toBeInTheDocument();
    expect(screen.getByText("2026-08-29")).toBeInTheDocument();
    expect(screen.getByText("计划进行中")).toBeInTheDocument();
    expect(screen.getByLabelText(/更新于 10:05/u)).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("20 分钟")).toBeInTheDocument();
    expect(screen.getByText("35 分钟")).toBeInTheDocument();
    expect(screen.getByText("55 分钟")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("对称轴与顶点符号").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("第6题 · 失分8 · 符号判断错误")).toBeInTheDocument();
    expect(screen.getByText("基础规则需要先稳定，再继续实际应用列式。")).toBeInTheDocument();
    expect(screen.getByText("规则辨认")).toBeInTheDocument();
    expect(screen.getByText("回看 x-h 中 h 的符号。")).toBeInTheDocument();
    expect(screen.getByText("独立练习")).toBeInTheDocument();
    expect(screen.getByText("完成1道无提示新题。")).toBeInTheDocument();
    expect(screen.getByText("尚未开始 · 完成事件为 0")).toBeInTheDocument();

    expect(screen.getByText("图像平移与坐标读取")).toBeInTheDocument();
    expect(screen.getByText("已完成 · 20分钟")).toBeInTheDocument();
    expect(screen.getByText("完成于 2026-08-29 10:02")).toBeInTheDocument();
    expect(screen.getByText("实际应用列式完整性")).toBeInTheDocument();
    expect(screen.getByText("完成基础规则任务后开放")).toBeInTheDocument();
    expect(screen.getAllByText("分析版本").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("24 / 24 已覆盖")).toBeInTheDocument();
    expect(screen.getByText("原始失分 + 基础依赖")).toBeInTheDocument();
    expect(screen.getByText("教材未填写、原题全文未录入；计划不会补造这些缺失内容。")).toBeInTheDocument();
    expect(screen.getByText("任务完成事件会回流今日学习；完成计划不等于知识点已经掌握。")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "补救计划辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-028 right rail");
    }
    expect(within(rail).getByText("计划状态")).toBeInTheDocument();
    expect(within(rail).getByText("当前任务")).toBeInTheDocument();
    expect(within(rail).getByText("2 / 3")).toBeInTheDocument();
    expect(within(rail).getByText("当前依据")).toBeInTheDocument();
    expect(within(rail).getByText("依据")).toBeInTheDocument();
    expect(within(rail).getByText("一致")).toBeInTheDocument();
    expect(within(rail).getByText("重算规则")).toBeInTheDocument();
    expect(within(rail).getByText("不会静默覆盖当前进度")).toBeInTheDocument();
    expect(within(rail).queryByText("REMEDIATION_PLAN_UNAVAILABLE")).not.toBeInTheDocument();

    expect(screen.queryByText("圆环进度")).not.toBeInTheDocument();
    expect(screen.queryByText("庆祝")).not.toBeInTheDocument();
    expect(screen.queryByText("MASTERED")).not.toBeInTheDocument();
    expect(screen.queryByText("排名")).not.toBeInTheDocument();
    expect(screen.queryByText("百分位")).not.toBeInTheDocument();
    expect(screen.queryByText("自动阅卷成功")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /查看任务说明/u }));
    expect(screen.getByRole("heading", { level: 3, name: "任务说明" })).toBeInTheDocument();
    expect(screen.getByText("demo-remediation-task-axis-sign")).toBeInTheDocument();
    expect(screen.getByText("PRACTICE_TASK")).toBeInTheDocument();
    expect(screen.getByText("route-token-demo-axis-sign-task")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /开始当前任务/u }));
    expect(screen.getByText(/TASK_START_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.getByText(/不会创建第二个 taskId/u)).toBeInTheDocument();
    expect(screen.queryByText("完成事件已写入")).not.toBeInTheDocument();
  });

  it("renders STU-029 mastery overview with categorical evidence and no score-like mastery claims", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=mastery-overview&target=demo-stu029-mastery-overview-categorical"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "掌握概览" })).toBeInTheDocument();
    expect(screen.getByText("2026-08-29")).toBeInTheDocument();
    expect(screen.getByText("证据已更新")).toBeInTheDocument();
    expect(screen.getByLabelText(/10:12/u)).toBeInTheDocument();
    expect(screen.getByText("数学 · 第21章")).toBeInTheDocument();
    expect(screen.getByText("个知识点有记录")).toBeInTheDocument();
    expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole("tab", { name: /全部 6/u })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /证据较充分 2/u })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /继续观察 3/u })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /证据不足 1/u })).toBeInTheDocument();
    expect(screen.getByText("近28天证据")).toBeInTheDocument();

    expect(screen.getByText("二次函数开口方向")).toBeInTheDocument();
    expect(screen.getByText("独立练习 2 · 到期复习 1 · 考试记录 1")).toBeInTheDocument();
    expect(screen.getByText("多次无提示作答方向一致")).toBeInTheDocument();
    expect(screen.getByText("对称轴与顶点")).toBeInTheDocument();
    expect(screen.getByText("近期已恢复，但仍有跨来源冲突证据")).toBeInTheDocument();
    expect(screen.getByText("二次函数图像平移")).toBeInTheDocument();
    expect(screen.getByText("已有补救事件，仍缺新的独立作答")).toBeInTheDocument();
    expect(screen.getByText("顶点式的图像特征")).toBeInTheDocument();
    expect(screen.getByText("不同新题的无提示结果一致")).toBeInTheDocument();
    expect(screen.getByText("二次函数实际应用列式")).toBeInTheDocument();
    expect(screen.getByText("尚无订正或后续独立作答")).toBeInTheDocument();
    expect(screen.getByText("函数图像综合判断")).toBeInTheDocument();
    expect(screen.getByText("结果有改善，仍需时间分散证据")).toBeInTheDocument();
    expect(screen.getByText("证据期：2026-08-01 ～ 2026-08-29")).toBeInTheDocument();
    expect(screen.getByText("当前分类是可解释的阶段判断；后续新证据可能改变结果。")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "掌握概览辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-029 right rail");
    }
    expect(within(rail).getByText("覆盖概况")).toBeInTheDocument();
    expect(within(rail).getByText("有记录知识点")).toBeInTheDocument();
    expect(within(rail).getByText("判断说明")).toBeInTheDocument();
    expect(within(rail).getByText("不使用同伴排名或虚假百分比")).toBeInTheDocument();
    expect(within(rail).getByText("证据来源")).toBeInTheDocument();
    expect(within(rail).getByText("提示式辅导")).toBeInTheDocument();
    expect(within(rail).getByText("不单独作为掌握依据")).toBeInTheDocument();
    expect(within(rail).queryByText("MASTERY_OVERVIEW_UNAVAILABLE")).not.toBeInTheDocument();

    expect(screen.queryByText("72%")).not.toBeInTheDocument();
    expect(screen.queryByText("掌握百分比")).not.toBeInTheDocument();
    expect(screen.queryByText("雷达图")).not.toBeInTheDocument();
    expect(screen.queryByText("能力分数")).not.toBeInTheDocument();
    expect(screen.queryByText("班级排名")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /证据不足 1/u }));
    expect(screen.getByRole("tab", { name: /证据不足 1/u })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("二次函数实际应用列式")).toBeInTheDocument();
    expect(screen.queryByText("二次函数开口方向")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /查看证据/u }));
    expect(screen.getByRole("heading", { level: 1, name: "知识点掌握详情" })).toBeInTheDocument();
    expect(screen.getByText("知识点掌握详情服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/MASTERY_DETAIL_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText(/STU-030 的下一页/u)).not.toBeInTheDocument();
  });

  it("renders STU-030 mastery detail with conflicted evidence, source previews, and service-owned target mappings", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=mastery-detail&target=demo-stu030-mastery-detail-axis-vertex-conflicted&knowledge=demo-kp-mastery-axis-vertex"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "对称轴与顶点" })).toBeInTheDocument();
    expect(screen.getByText("掌握证据 / 掌握概览 / 对称轴与顶点")).toBeInTheDocument();
    expect(screen.getByText("查看作答、订正、复习和考试证据如何支持当前判断")).toBeInTheDocument();
    expect(screen.getAllByText("2026-08-29").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("判断已更新")).toBeInTheDocument();
    expect(screen.getByLabelText(/10:14/u)).toBeInTheDocument();
    expect(screen.getByLabelText("4 条关键证据")).toBeInTheDocument();
    expect(screen.getAllByText("继续观察").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("近期结果有改善，但仍存在跨来源冲突，时间覆盖也较短。")).toBeInTheDocument();
    expect(screen.getAllByText("覆盖日期").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("支持或修复证据")).toBeInTheDocument();
    expect(screen.getByText("冲突证据")).toBeInTheDocument();
    expect(screen.getByText("当前判断不使用百分比；后续新的独立作答可能改变结果。")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "证据时间线" })).toBeInTheDocument();
    expect(screen.getByText("2026-08-21")).toBeInTheDocument();
    expect(screen.getAllByText("独立练习").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("无提示判断对称轴与顶点")).toBeInTheDocument();
    expect(screen.getByText("支持当前知识点")).toBeInTheDocument();
    expect(screen.getAllByText("2026-08-22").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/考试记录/u)).toBeInTheDocument();
    expect(screen.getByText("把 x + 1 = 0 错解为 x = 1")).toBeInTheDocument();
    expect(screen.getByText("形成跨来源冲突证据")).toBeInTheDocument();
    expect(screen.getByText(/错题订正/u)).toBeInTheDocument();
    expect(screen.getByText("改写为 x - (-1)，订正答案 x = -1")).toBeInTheDocument();
    expect(screen.getByText("修复证据：不单独等于稳定掌握")).toBeInTheDocument();
    expect(screen.getAllByText("2026-08-29").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("到期复习").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("同知识点新变式、无提示、旧答案已隐藏")).toBeInTheDocument();
    expect(screen.getByText("支持本条错题恢复与知识点证据增强")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "为什么仍需观察" })).toBeInTheDocument();
    expect(screen.getByText("独立练习/复习正确，但考试中出现过符号错误")).toBeInTheDocument();
    expect(screen.getByText("目前只覆盖3个日期")).toBeInTheDocument();
    expect(screen.getByText("订正通过说明已修复，不单独证明长期稳定")).toBeInTheDocument();
    expect(screen.getByText("建议在后续两个不同日期完成新的无提示题")).toBeInTheDocument();
    expect(screen.getByText("因此当前保留“继续观察”，不会被一次复习直接提升为稳定结论。")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "回到知识点，完成两道新的独立练习" })).toBeInTheDocument();
    expect(screen.getByText("约12分钟 · 不提供提示 · 分两次日期完成更有参考价值")).toBeInTheDocument();
    expect(screen.getByText("目标由服务端知识点映射返回；不会用标题猜路由。")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "知识点掌握详情辅助信息" });
    expect(within(rail).getByText("判断摘要")).toBeInTheDocument();
    expect(within(rail).getByText("证据期")).toBeInTheDocument();
    expect(within(rail).getByText("2026-08-21 ～ 2026-08-29")).toBeInTheDocument();
    expect(within(rail).getByText("证据组成")).toBeInTheDocument();
    expect(within(rail).getByText("提示式辅导")).toBeInTheDocument();
    expect(within(rail).getByText("不单独计入")).toBeInTheDocument();
    expect(within(rail).getByText("可靠性说明")).toBeInTheDocument();
    expect(within(rail).getByText("存在冲突，分类保持克制")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getByText("仅显示当前学生自己的证据")).toBeInTheDocument();
    expect(within(rail).queryByText("MASTERY_DETAIL_UNAVAILABLE")).not.toBeInTheDocument();

    const sourceButtons = screen.getAllByRole("button", { name: /查看来源/u });
    const examSourceButton = sourceButtons[1];
    if (examSourceButton === undefined) {
      throw new Error("Missing STU-030 exam source button");
    }
    fireEvent.click(examSourceButton);
    expect(screen.getByRole("region", { name: "考试记录来源详情" })).toBeInTheDocument();
    expect(screen.getAllByText("demo-source-exam-loss-axis-sign-20260822").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/考试失分不会因后续订正而被删除/u)).toBeInTheDocument();

    expect(screen.queryByText("72%")).not.toBeInTheDocument();
    expect(screen.queryByText("掌握百分比")).not.toBeInTheDocument();
    expect(screen.queryByText("雷达图")).not.toBeInTheDocument();
    expect(screen.queryByText("能力分数")).not.toBeInTheDocument();
    expect(screen.queryByText("班级排名")).not.toBeInTheDocument();
    expect(screen.queryByText("MASTERY_DETAIL_UNAVAILABLE")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "返回掌握概览" }));
    expect(screen.getByRole("heading", { level: 1, name: "掌握概览" })).toBeInTheDocument();
    expect(screen.getByText("数学 · 第21章")).toBeInTheDocument();
  });

  it("routes STU-030 related wrong-item action through the service mapping", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=mastery-detail&target=demo-stu030-mastery-detail-axis-vertex-conflicted&knowledge=demo-kp-mastery-axis-vertex"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    const relatedWrongItemLink = screen.getByRole("link", { name: "查看相关错题" });
    expect(relatedWrongItemLink).toHaveAttribute("href", expect.stringContaining("route-token-demo-stu030-axis-vertex-to-wrong-item"));
    fireEvent.click(relatedWrongItemLink);
    expect(screen.getByRole("heading", { level: 1, name: "错题详情" })).toBeInTheDocument();
    expect(screen.getByText("对称轴判断")).toBeInTheDocument();
    expect(screen.getByText("由 x + 1 = 0 得到 x = 1")).toBeInTheDocument();
  });

  it("routes STU-030 primary suggested action through the service mapping into STU-009", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=mastery-detail&target=demo-stu030-mastery-detail-axis-vertex-conflicted&knowledge=demo-kp-mastery-axis-vertex"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );
    const primaryLearningLink = screen.getByRole("link", { name: /回到知识点继续学习/u });
    expect(primaryLearningLink).toHaveAttribute("href", expect.stringContaining("route-token-demo-stu030-axis-vertex-to-stu009"));
    fireEvent.click(primaryLearningLink);
    expect(screen.getByRole("heading", { level: 1, name: "从顶点式读取图像特征" })).toBeInTheDocument();
    expect(screen.getByText("y = a(x-h)² + k")).toBeInTheDocument();
  });

  it("keeps STU-026 controlled correction behavior after STU-027 navigation is enabled", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-detail&target=demo-stu026-exam-detail-math-unit-21&exam=demo-exam-stu024-math-unit-21"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "更正记录" }));
    expect(screen.getByRole("heading", { level: 3, name: "受控更正记录" })).toBeInTheDocument();
    expect(screen.getByText(/expectedVersion: exam-version-20260829-0926/u)).toBeInTheDocument();
    expect(screen.getByText(/不会新增 \/student\/exams\/\{examId\}\/edit 路由/u)).toBeInTheDocument();
    expect(screen.getByDisplayValue("96")).toBeInTheDocument();
    expect(screen.getByDisplayValue("120")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存更正" }));
    expect(screen.getByText(/更正保存结果未知时必须查询原操作/u)).toBeInTheDocument();
    expect(screen.queryByText("教材状态已 confirmed")).not.toBeInTheDocument();
  });

  it("does not invent an exam analysis when API data lacks the STU-027 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-analysis&target=api-exam-analysis&exam=api-exam-1&analysis=api-analysis-1"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "考试分析" })).toBeInTheDocument();
    expect(screen.getByText("考试分析服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-027 考试分析文档/u)).toBeInTheDocument();
    expect(screen.getByText(/EXAM_ANALYSIS_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.queryByText("条可追溯归因")).not.toBeInTheDocument();
    expect(screen.queryByText("图像平移与坐标读取")).not.toBeInTheDocument();
    expect(screen.queryByText("补救顺序")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-027/u)).not.toBeInTheDocument();
  });

  it("does not invent a remediation plan when API data lacks the STU-028 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=remediation-plan&target=api-remediation-plan&exam=api-exam-1&analysis=api-analysis-1&plan=api-plan-1"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "补救计划" })).toBeInTheDocument();
    expect(screen.getByText("补救计划服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-028 补救计划文档/u)).toBeInTheDocument();
    expect(screen.getByText(/REMEDIATION_PLAN_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("当前任务")).not.toBeInTheDocument();
    expect(screen.queryByText("对称轴与顶点符号")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-028/u)).not.toBeInTheDocument();
  });

  it("does not invent a mastery overview when API data lacks the STU-029 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=mastery-overview&target=api-mastery-overview"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "掌握概览" })).toBeInTheDocument();
    expect(screen.getByText("掌握概览服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-029 掌握概览文档/u)).toBeInTheDocument();
    expect(screen.getByText(/MASTERY_OVERVIEW_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("二次函数开口方向")).not.toBeInTheDocument();
    expect(screen.queryByText("对称轴与顶点")).not.toBeInTheDocument();
    expect(screen.queryByText("多次无提示作答方向一致")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-029/u)).not.toBeInTheDocument();
  });

  it("does not invent a mastery detail when API data lacks the STU-030 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=mastery-detail&target=api-mastery-detail&knowledge=api-kp-axis-vertex"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "知识点掌握详情" })).toBeInTheDocument();
    expect(screen.getByText("知识点掌握详情服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-030 知识点掌握详情文档/u)).toBeInTheDocument();
    expect(screen.getByText(/MASTERY_DETAIL_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("对称轴与顶点")).not.toBeInTheDocument();
    expect(screen.queryByText("把 x + 1 = 0 错解为 x = 1")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-030/u)).not.toBeInTheDocument();
  });

  it("renders STU-031 student profile with self-service fields, controlled facts, and safe settings boundaries", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=student-profile&target=demo-stu031-student-profile-normal"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "学生个人资料" })).toBeInTheDocument();
    expect(screen.getAllByText("个人资料").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("核对本人正式资料，只修改允许自助设置的字段。")).toBeInTheDocument();
    expect(screen.getAllByText("2026-08-29").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("资料已加载")).toBeInTheDocument();
    expect(screen.getByLabelText("林，学生账号")).toBeInTheDocument();
    expect(screen.getByDisplayValue("清远")).toBeInTheDocument();
    expect(screen.getByDisplayValue("持之以恒，水滴石穿")).toBeInTheDocument();
    expect(screen.getByText("9 / 40")).toBeInTheDocument();
    expect(screen.getByText("当前修改尚未保存")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "正式受控资料" })).toBeInTheDocument();
    expect(screen.getAllByText("林清远").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("初二").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("学生").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("数学、语文、英语、历史")).toBeInTheDocument();
    expect(screen.getByText("正式年级、角色、学科和教材不能在此直接修改；信息不符时请发起纠错。")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "设置入口" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /教材设置/u })).toBeInTheDocument();
    expect(screen.getByText("数学教材待核验；其余按当前确认状态")).toBeInTheDocument();
    expect(screen.getByText("1项待处理")).toBeInTheDocument();
    expect(screen.getByText("工作日 19:00–21:00 · 周末 09:00–11:30")).toBeInTheDocument();
    expect(screen.getByText("1个家庭关系 · 私题图片与会话仅本人可见")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "学生个人资料辅助信息" });
    expect(within(rail).getByText("账号状态")).toBeInTheDocument();
    expect(within(rail).getByText("字段权限")).toBeInTheDocument();
    expect(within(rail).getByText("可自助修改")).toBeInTheDocument();
    expect(within(rail).getByText("2项")).toBeInTheDocument();
    expect(within(rail).getByText("配置状态")).toBeInTheDocument();
    expect(within(rail).getByText("教材")).toBeInTheDocument();
    expect(within(rail).getByText("1项待核验")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getByText("来自 /v1/auth/me")).toBeInTheDocument();
    expect(screen.queryByText("STUDENT_PROFILE_UNAVAILABLE")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/个人签名/u), { target: { value: "慢慢来，也会到达" } });
    expect(screen.getByText("8 / 40")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /保存个人资料/u }));
    expect(screen.getByText(/PROFILE_SAVE_RESULT_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.getByText(/仅包含 displayName 与 personalMotto/u)).toBeInTheDocument();
    expect(screen.queryByText("正式姓名已修改")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "报告资料错误" }));
    expect(screen.getByRole("heading", { level: 3, name: "资料纠错请求" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "提交纠错请求" }));
    expect(screen.getByText(/PROFILE_CORRECTION_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.getByText(/不重复提交/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /打开教材设置/u }));
    expect(screen.getByText(/STU-032 教材设置尚未接入当前生产路由/u)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /打开教材设置/u })).not.toBeInTheDocument();
    expect(screen.getByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-031/u)).toBeInTheDocument();
  });

  it("does not invent a student profile when API data lacks the STU-031 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=student-profile&target=api-profile"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "学生个人资料" })).toBeInTheDocument();
    expect(screen.getByText("学生个人资料服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-031 学生个人资料文档/u)).toBeInTheDocument();
    expect(screen.getByText(/STUDENT_PROFILE_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("林清远")).not.toBeInTheDocument();
    expect(screen.queryByText("持之以恒，水滴石穿")).not.toBeInTheDocument();
    expect(screen.queryByText("数学教材待核验")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-031/u)).not.toBeInTheDocument();
  });

  it("renders STU-032 textbook settings with mixed verification states and safe material actions", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=textbook-settings&target=demo-stu032-textbook-settings-mixed-status"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "教材设置" })).toBeInTheDocument();
    expect(screen.getByText("个人资料 / 教材设置")).toBeInTheDocument();
    expect(screen.getByText("查看各学科教材状态，提交真实封面与目录供管理员核验。")).toBeInTheDocument();
    expect(screen.getAllByText("2026-08-29").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("状态已更新")).toBeInTheDocument();
    expect(screen.getByLabelText("4个启用学科")).toBeInTheDocument();
    expect(screen.getByText("学生只能提交核验材料，不能自行把教材状态改为已确认。")).toBeInTheDocument();

    expect(screen.getByRole("row", { name: /数学.*等待核验.*人教版 · 八年级下册.*核验完成前仍按通用辅导处理/u })).toBeInTheDocument();
    expect(screen.getByText("数学八下-封面.jpg")).toBeInTheDocument();
    expect(screen.getByText("数学八下-目录.jpg")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /语文.*已确认.*确认于 2026-08-01.*目录与章节对齐可用/u })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /英语.*已确认.*Unit目录对齐可用/u })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /历史.*通用辅导.*尚未提交核验材料.*封面清晰照片/u })).toBeInTheDocument();
    expect(screen.getByText("已确认2 · 等待核验1 · 通用辅导1")).toBeInTheDocument();
    expect(screen.getByText("教材状态由管理员核验；已确认前不生成具体教材页码或目录。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "材料用途" })).toBeInTheDocument();
    expect(screen.getByText("识别书名、年级、上下册与出版社")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "教材设置辅助信息" });
    expect(within(rail).getByText("状态概况")).toBeInTheDocument();
    expect(within(rail).getByText("核验规则")).toBeInTheDocument();
    expect(within(rail).getByText("学生不能自行确认")).toBeInTheDocument();
    expect(within(rail).getByText("材料要求")).toBeInTheDocument();
    expect(within(rail).getByText("单个文件不超过 10 MB")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getByText("由服务端权限强制执行")).toBeInTheDocument();
    expect(screen.queryByText("TEXTBOOK_SETTINGS_UNAVAILABLE")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("/student/settings/textbooks");

    fireEvent.click(screen.getByRole("button", { name: "数学 查看已交材料" }));
    expect(screen.getByRole("heading", { level: 3, name: "数学 · 已交材料" })).toBeInTheDocument();
    expect(screen.getByText("查看材料前应由服务端重新鉴权；这里只展示文件元数据，不展示虚构缩略图。")).toBeInTheDocument();
    expect(screen.getByText(/1\.9 MB · image\/jpeg/u)).toBeInTheDocument();
    expect(screen.getByText(/2\.1 MB · image\/jpeg/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "历史 查看材料要求" }));
    expect(screen.getByRole("heading", { level: 3, name: "历史 · 材料要求" })).toBeInTheDocument();
    expect(screen.getAllByText("不需要上传整本教材").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "历史 提交核验材料" }));
    expect(screen.getByRole("heading", { level: 3, name: "历史 · 提交核验材料" })).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: /提交核验请求/u });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/封面照片/u), {
      target: { files: [new File(["cover"], "历史八下-封面.png", { type: "image/png" })] },
    });
    fireEvent.change(screen.getByLabelText(/目录页照片/u), {
      target: { files: [new File(["catalog"], "历史八下-目录.png", { type: "image/png" })] },
    });
    expect(screen.getByText("历史八下-封面.png")).toBeInTheDocument();
    expect(screen.getByText("历史八下-目录.png")).toBeInTheDocument();
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);
    expect(screen.getByText(/TEXTBOOK_VERIFICATION_OPERATION_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.getByText(/payload 不允许包含 status=CONFIRMED/u)).toBeInTheDocument();
    expect(screen.queryByText("教材已由学生确认")).not.toBeInTheDocument();
    expect(screen.getByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-032/u)).toBeInTheDocument();
  });

  it("renders STU-033 study time preferences with editable conflict-safe scheduling", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=study-time-preferences&target=demo-stu033-study-time-preferences-conflict"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "学习时间偏好" })).toBeInTheDocument();
    expect(screen.getByText("个人资料 / 学习时间偏好")).toBeInTheDocument();
    expect(screen.getByText("设置预计用时与提醒排序的偏好时段，不把在线时长当目标。")).toBeInTheDocument();
    expect(screen.getAllByText("2026-08-29").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("已自定义").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("2组偏好时段")).toBeInTheDocument();
    expect(screen.getAllByText("Asia/Shanghai").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("时间按中国标准时间展示")).toBeInTheDocument();

    expect(screen.getByText("工作日")).toBeInTheDocument();
    expect(screen.getByText("周一至周五")).toBeInTheDocument();
    expect(screen.getByLabelText("工作日开始时间")).toHaveValue("19:00");
    expect(screen.getByLabelText("工作日结束时间")).toHaveValue("21:00");
    expect(screen.getByText("周末")).toBeInTheDocument();
    expect(screen.getByText("周六、周日")).toBeInTheDocument();
    expect(screen.getByLabelText("周末开始时间")).toHaveValue("09:00");
    expect(screen.getByLabelText("周末结束时间")).toHaveValue("11:30");

    expect(screen.getByLabelText("单次学习建议")).toHaveValue("30");
    expect(screen.getByLabelText("提醒时间")).toHaveValue("10");
    expect(screen.getByLabelText("任务排序依据")).toHaveValue("DUE_FIRST_THEN_ESTIMATE");
    const dueCheckbox = screen.getByRole("checkbox", { name: "到期任务即使在偏好时段外仍显示" });
    expect(dueCheckbox).toBeChecked();
    expect(screen.getByText("这些设置只影响本人建议排序，不会隐藏任务或阻止学习。")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "今日安排冲突" })).toBeInTheDocument();
    expect(screen.getAllByText("10:30").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("11:30").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("60 分钟").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("90 分钟").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("30 分钟").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("系统会优先排列到期任务，其余任务保留在今日列表；不会要求你持续在线，也不会自动延长偏好时段。")).toBeInTheDocument();
    expect(screen.getByText("当前知识点练习")).toBeInTheDocument();
    expect(screen.getByText("到期错题复习")).toBeInTheDocument();
    expect(screen.getByText("其余约30分钟仍保留，稍后可继续")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "学习时间偏好辅助信息" });
    expect(within(rail).getByText("偏好状态")).toBeInTheDocument();
    expect(within(rail).getByText("设置用途")).toBeInTheDocument();
    expect(within(rail).getByText("不作为在线时长目标")).toBeInTheDocument();
    expect(within(rail).getByText("今日冲突")).toBeInTheDocument();
    expect(within(rail).getByText("仅调整排序、不隐藏任务")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getByText("由服务端权限强制执行")).toBeInTheDocument();
    expect(screen.queryByText("STUDY_TIME_SETTINGS_UNAVAILABLE")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("/student/settings/study-time");

    fireEvent.click(dueCheckbox);
    expect(screen.getByText("到期任务仍会显示；该开关不能作为隐藏任务、权限或完成证据边界。")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("周末结束时间"), { target: { value: "12:00" } });
    expect(screen.getAllByText("0 分钟").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("偏好窗口暂时能覆盖今日预计任务；到期任务仍保持优先。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /保存学习时间偏好/u }));
    expect(screen.getByText(/STUDY_TIME_SAVE_RESULT_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.getByText(/operationId/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "恢复上次保存" }));
    expect(screen.getByText(/再次点击“恢复上次保存”确认丢弃本页未保存修改/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认恢复上次保存" }));
    expect(screen.getByText("已恢复上次保存的偏好快照；当前只丢弃本页未保存修改，不写入服务端。")).toBeInTheDocument();
    expect(screen.getByLabelText("周末结束时间")).toHaveValue("11:30");
    expect(screen.getByRole("checkbox", { name: "到期任务即使在偏好时段外仍显示" })).toBeChecked();
    expect(screen.getByRole("link", { name: "返回个人资料" })).toHaveAttribute("href", expect.stringContaining("view=student-profile"));
    expect(screen.getByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-033/u)).toBeInTheDocument();
  });

  it("renders STU-034 family privacy with owned private assets and controlled deletion", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=family-privacy&target=demo-stu034-family-privacy-own-assets"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "家庭与隐私" })).toBeInTheDocument();
    expect(screen.getByText("个人资料 / 家庭与隐私")).toBeInTheDocument();
    expect(screen.getByText("了解家庭关系与私密内容边界，只管理本人数据。")).toBeInTheDocument();
    expect(screen.getAllByText("2026-08-29").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("隐私状态已更新").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("1个有效家庭关系")).toBeInTheDocument();
    expect(screen.getByText("已加入家庭 · 有效")).toBeInTheDocument();
    expect(screen.getByText("仅用于学习支持与聚合信息")).toBeInTheDocument();
    expect(screen.getByText("学生不能查看、添加、移除或管理其他家庭成员关系。")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "家庭可见范围" })).toBeInTheDocument();
    expect(screen.getByText("学习计划与完成汇总")).toBeInTheDocument();
    expect(screen.getByText("错题恢复状态")).toBeInTheDocument();
    expect(screen.getByText("掌握证据分类与覆盖期")).toBeInTheDocument();
    expect(screen.getByText("完整 AI 辅导会话原文")).toBeInTheDocument();
    expect(screen.getByText("私人题目原图")).toBeInTheDocument();
    expect(screen.getByText("家庭页面只使用聚合与最小必要信息；服务端逐对象重新校验关系。")).toBeInTheDocument();

    const assetTable = screen.getByRole("table", { name: "本人私密数据" });
    expect(within(assetTable).getByText("二次函数题图.jpg")).toBeInTheDocument();
    expect(within(assetTable).getByText("私人题图 · 1.7 MB")).toBeInTheDocument();
    expect(within(assetTable).getByText("2026-08-22 10:31")).toBeInTheDocument();
    expect(within(assetTable).getByText("OCR 与提示式辅导")).toBeInTheDocument();
    expect(within(assetTable).getByText("提示式辅导会话 · 2026-08-22")).toBeInTheDocument();
    expect(within(assetTable).getByText("会话记录")).toBeInTheDocument();
    expect(screen.getByText("私人题图 1 · 会话记录 1 · 处理中 0")).toBeInTheDocument();
    expect(screen.getByText("删除需要确认；提交后保留状态直到服务端确认，不会立即从列表假装消失。")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "家庭与隐私辅助信息" });
    expect(within(rail).getByText("关系状态")).toBeInTheDocument();
    expect(within(rail).getByText("无 · 关系只读")).toBeInTheDocument();
    expect(within(rail).getByText("私密数据")).toBeInTheDocument();
    expect(within(rail).getByText("仅本人可管理")).toBeInTheDocument();
    expect(within(rail).getByText("删除规则")).toBeInTheDocument();
    expect(within(rail).getByText("未知状态按原 operation 查询")).toBeInTheDocument();
    expect(within(rail).getByText("家庭隔离由服务端权限强制执行")).toBeInTheDocument();
    expect(screen.queryByText("FAMILY_PRIVACY_UNAVAILABLE")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("/student/settings/family-privacy");

    const questionImageDeleteButton = screen.getByRole("button", { name: "删除二次函数题图.jpg" });
    fireEvent.click(questionImageDeleteButton);
    expect(screen.getByRole("heading", { level: 3, name: "确认删除二次函数题图.jpg" })).toBeInTheDocument();
    expect(screen.getByText(/原始私人题图删除后不可恢复/u)).toBeInTheDocument();
    expect(screen.getByText(/assetId、expectedVersion/u)).toBeInTheDocument();
    expect(within(assetTable).getByText("二次函数题图.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认提交删除请求" }));
    expect(screen.getByText(/FAMILY_PRIVACY_DELETE_OPERATION_PENDING/u)).toBeInTheDocument();
    expect(screen.getByText("私人题图 1 · 会话记录 1 · 处理中 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除二次函数题图.jpg" })).toBeDisabled();
    expect(within(assetTable).getByText("二次函数题图.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查询原 operation" }));
    expect(screen.getByText(/FAMILY_PRIVACY_DELETE_RESULT_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.getByText(/不重复提交，也不立即移除资产/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "管理本人数据" }));
    expect(screen.getByRole("heading", { level: 3, name: "本人数据请求" })).toBeInTheDocument();
    expect(screen.getByText(/可能需要重新认证、二次确认、审计/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查询请求状态" }));
    expect(screen.getByText(/ACCOUNT_DATA_REQUEST_OPERATION_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回个人资料" })).toHaveAttribute("href", expect.stringContaining("view=student-profile"));
    expect(screen.getByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-034/u)).toBeInTheDocument();
  });

  it("does not invent study time preferences when API data lacks the STU-033 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=study-time-preferences&target=api-study-time"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "学习时间偏好" })).toBeInTheDocument();
    expect(screen.getByText("学习时间偏好服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-033 学习时间偏好文档/u)).toBeInTheDocument();
    expect(screen.getByText(/STUDY_TIME_SETTINGS_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("10:30")).not.toBeInTheDocument();
    expect(screen.queryByText("当前知识点练习")).not.toBeInTheDocument();
    expect(screen.queryByText("到期错题复习")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-033/u)).not.toBeInTheDocument();
  });

  it("does not invent family privacy when API data lacks the STU-034 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=family-privacy&target=api-family-privacy"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "家庭与隐私" })).toBeInTheDocument();
    expect(screen.getByText("家庭与隐私服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-034 家庭与隐私文档/u)).toBeInTheDocument();
    expect(screen.getByText(/FAMILY_PRIVACY_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("二次函数题图.jpg")).not.toBeInTheDocument();
    expect(screen.queryByText("提示式辅导会话 · 2026-08-22")).not.toBeInTheDocument();
    expect(screen.queryByText("已加入家庭 · 有效")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-034/u)).not.toBeInTheDocument();
  });

  it("does not invent textbook settings when API data lacks the STU-032 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=textbook-settings&target=api-textbook-settings"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "教材设置" })).toBeInTheDocument();
    expect(screen.getByText("教材设置服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-032 教材设置文档/u)).toBeInTheDocument();
    expect(screen.getByText(/TEXTBOOK_SETTINGS_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("数学八下-封面.jpg")).not.toBeInTheDocument();
    expect(screen.queryByText("数学八下-目录.jpg")).not.toBeInTheDocument();
    expect(screen.queryByText("已确认2 · 等待核验1 · 通用辅导1")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-032/u)).not.toBeInTheDocument();
  });

  it("does not invent an exam detail when API data lacks the STU-026 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-detail&target=api-exam-detail&exam=api-exam-1"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "考试详情" })).toBeInTheDocument();
    expect(screen.getByText("考试详情服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-026 考试详情文档/u)).toBeInTheDocument();
    expect(screen.getByText(/EXAM_DETAIL_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("第21章 二次函数单元检测")).not.toBeInTheDocument();
    expect(screen.queryByText("/120 · 本人确认量尺")).not.toBeInTheDocument();
    expect(screen.queryByText("符号判断错误")).not.toBeInTheDocument();
    expect(screen.queryByText("分析可查看")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-026/u)).not.toBeInTheDocument();
  });

  it("does not invent an exam entry when API data lacks the STU-025 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-entry&target=api-exam-entry"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "考试录入" })).toBeInTheDocument();
    expect(screen.getByText("考试录入服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-025 考试录入文档/u)).toBeInTheDocument();
    expect(screen.getByText(/EXAM_ENTRY_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("第21章 二次函数单元检测")).not.toBeInTheDocument();
    expect(screen.queryByText("96")).not.toBeInTheDocument();
    expect(screen.queryByText("对称轴与顶点")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-025/u)).not.toBeInTheDocument();
  });

  it("does not invent an exam list when API data lacks the STU-024 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=exam-list&target=api-exam-list"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "考试记录" })).toBeInTheDocument();
    expect(screen.getByText("考试记录服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-024 考试列表文档/u)).toBeInTheDocument();
    expect(screen.getByText(/EXAM_LIST_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("第21章 二次函数单元检测")).not.toBeInTheDocument();
    expect(screen.queryByText("96 / 120")).not.toBeInTheDocument();
    expect(screen.queryByText("Unit 6 Reading & Grammar 小测")).not.toBeInTheDocument();
    expect(screen.queryByText("demo-exam-stu024-math-unit-21")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-024/u)).not.toBeInTheDocument();
  });

  it("renders the STU-019 wrong book list from server-owned wrong item summaries", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-book&target=demo-stu019-wrong-book-list"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "错题本" })).toBeInTheDocument();
    expect(screen.getByText("按订正与复习状态整理本人错题，每条都保留证据来源。")).toBeInTheDocument();
    expect(screen.getByText("记录已更新 · 10:51")).toBeInTheDocument();
    expect(screen.getByLabelText("5 道错题")).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "全部 5" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "待订正 2" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "待复习 2" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "已恢复 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("科目")).toHaveValue("ALL_SUBJECTS");
    expect(screen.getByLabelText("排序")).toHaveValue("NEXT_ACTION");

    expect(screen.getByRole("listitem", { name: /1，对称轴判断，待订正/u })).toBeInTheDocument();
    expect(screen.getByText("把 x+1=0 错解为 x = 1")).toBeInTheDocument();
    expect(screen.getByText("独立练习 · 服务端结果已确认")).toBeInTheDocument();
    expect(screen.getByText("二次函数开口方向")).toBeInTheDocument();
    expect(screen.getByText("Unit 6 动词时态选择")).toBeInTheDocument();
    expect(screen.getByText("《桃花源记》文意判断")).toBeInTheDocument();
    expect(screen.getByText("明清时期的社会变化")).toBeInTheDocument();

    const rail = screen.getAllByRole("complementary", { name: "错题本辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-019 right rail");
    }
    expect(within(rail).getByText("今日处理")).toBeInTheDocument();
    expect(within(rail).getByText("新增待订正")).toBeInTheDocument();
    expect(within(rail).getByText("状态说明")).toBeInTheDocument();
    expect(within(rail).getByText("证据概况")).toBeInTheDocument();
    expect(within(rail).getByText("服务与隐私")).toBeInTheDocument();
    expect(within(rail).getAllByText("WRONG_BOOK_LIST_UNAVAILABLE").length).toBeGreaterThanOrEqual(1);

    const firstDetailButton = screen.getAllByRole("button", { name: /打开详情/u })[0];
    if (firstDetailButton === undefined) {
      throw new Error("Missing STU-019 detail button");
    }
    fireEvent.click(firstDetailButton);

    expect(screen.getByRole("heading", { level: 1, name: "错题详情" })).toBeInTheDocument();
    expect(screen.getByText("对称轴判断")).toBeInTheDocument();
    expect(screen.getByText("原作答已提交，不可修改；订正将创建新的作答记录。")).toBeInTheDocument();
    expect(screen.queryByText("Mastery 已更新")).not.toBeInTheDocument();
    expect(screen.getByText(/正式 wrongItem、原题、原答、判定/u)).toBeInTheDocument();
  });

  it("opens the first processable STU-020 detail from the STU-019 right rail action", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-book&target=demo-stu019-wrong-book-list"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    const rail = screen.getAllByRole("complementary", { name: "错题本辅助信息" })[0];
    if (rail === undefined) {
      throw new Error("Missing STU-019 right rail");
    }
    fireEvent.click(within(rail).getByRole("button", { name: /从第一条开始/u }));

    expect(screen.getByRole("heading", { level: 1, name: "错题详情" })).toBeInTheDocument();
    expect(screen.getByText("对称轴判断")).toBeInTheDocument();
    expect(screen.getAllByText("当前证据").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("足以开始订正").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("首条可处理 wrongItemId：demo-wrong-item-stu018-axis-sign")).not.toBeInTheDocument();
  });

  it("filters the STU-019 wrong book without deriving counts from the current page only", () => {
    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-book&target=demo-stu019-wrong-book-list"]}>
        <CourseMaterialsView catalog={demoCourseCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "待订正 2" }));

    expect(screen.getByRole("tab", { name: "待订正 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("对称轴判断")).toBeInTheDocument();
    expect(screen.getByText("Unit 6 动词时态选择")).toBeInTheDocument();
    expect(screen.queryByText("二次函数开口方向")).not.toBeInTheDocument();
    expect(screen.queryByText("明清时期的社会变化")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "全部 5" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "待复习 2" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "已恢复 1" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("科目"), { target: { value: "ENGLISH" } });

    expect(screen.getByText("Unit 6 动词时态选择")).toBeInTheDocument();
    expect(screen.queryByText("对称轴判断")).not.toBeInTheDocument();
    expect(screen.queryByText("当前筛选无结果")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("科目"), { target: { value: "HISTORY" } });

    expect(screen.getByText("当前筛选无结果")).toBeInTheDocument();
    expect(screen.getByText(/其他状态计数保持不变/u)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "待订正 2" })).toBeInTheDocument();
  });

  it("does not invent a wrong book when API data lacks the STU-019 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-book&target=api-wrong-book"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "错题本" })).toBeInTheDocument();
    expect(screen.getByText("错题本服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-019 错题本文档/u)).toBeInTheDocument();
    expect(screen.getByText(/WRONG_BOOK_LIST_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("对称轴判断")).not.toBeInTheDocument();
    expect(screen.queryByText("demo-wrong-item-stu018-axis-sign")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-019/u)).not.toBeInTheDocument();
  });

  it("does not invent a wrong item detail when API data lacks the STU-020 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-item-detail&target=api-wrong-item-detail&wrongItem=api-wrong-item"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "错题详情" })).toBeInTheDocument();
    expect(screen.getByText("错题详情服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-020 错题详情文档/u)).toBeInTheDocument();
    expect(screen.getByText(/WRONG_ITEM_DETAIL_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("已知 y = 2(x + 1)² - 3，这条抛物线的对称轴是什么？")).not.toBeInTheDocument();
    expect(screen.queryByText("我的原答")).not.toBeInTheDocument();
    expect(screen.queryByText("x = 1")).not.toBeInTheDocument();
    expect(screen.queryByText("x = -1")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-020/u)).not.toBeInTheDocument();
  });

  it("does not invent a wrong item correction when API data lacks the STU-021 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=wrong-item-correction&target=api-wrong-item-correction&wrongItem=api-wrong-item"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "错题订正" })).toBeInTheDocument();
    expect(screen.getByText("错题订正服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-021 错题订正文档/u)).toBeInTheDocument();
    expect(screen.getByText(/WRONG_ITEM_CORRECTION_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("x + 1 = x - (-1)，因此顶点式中的 h=-1，对称轴是 x=-1。")).not.toBeInTheDocument();
    expect(screen.queryByText("我把 x+1 看成了 h=1，没有先改写成 x-(-1)。")).not.toBeInTheDocument();
    expect(screen.queryByText("demo-correction-stu021-axis-sign-draft")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-021/u)).not.toBeInTheDocument();
  });

  it("does not invent a scheduled review attempt when API data lacks the STU-022 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=scheduled-review-attempt&target=api-review-attempt&wrongItem=api-wrong-item&review=api-review"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "到期复习" })).toBeInTheDocument();
    expect(screen.getByText("到期复习作答服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-022 到期复习作答文档/u)).toBeInTheDocument();
    expect(screen.getByText(/SCHEDULED_REVIEW_ATTEMPT_UNAVAILABLE/u)).toBeInTheDocument();
    expect(screen.queryByText("已知 y = -3(x - 2)² + 5。请写出这条抛物线的开口方向、对称轴和顶点。")).not.toBeInTheDocument();
    expect(screen.queryByText("向下")).not.toBeInTheDocument();
    expect(screen.queryByText("x = 2")).not.toBeInTheDocument();
    expect(screen.queryByText("(2, 5)")).not.toBeInTheDocument();
    expect(screen.queryByText("demo-review-stu022-vertex-features-due")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-022/u)).not.toBeInTheDocument();
  });

  it("does not invent a review result when API data lacks the STU-023 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=review-result&target=api-review-result&wrongItem=api-wrong-item&review=api-review"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "复习结果" })).toBeInTheDocument();
    expect(screen.getByText("复习结果服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-023 复习结果文档/u)).toBeInTheDocument();
    expect(screen.getByText(/REVIEW_RESULT_UNKNOWN/u)).toBeInTheDocument();
    expect(screen.queryByText("本次复习已通过，作答与判断均由服务端确认。")).not.toBeInTheDocument();
    expect(screen.queryByText("条错题已恢复")).not.toBeInTheDocument();
    expect(screen.queryByText("y=-3(x-2)²+5")).not.toBeInTheDocument();
    expect(screen.queryByText("向下")).not.toBeInTheDocument();
    expect(screen.queryByText("x=2")).not.toBeInTheDocument();
    expect(screen.queryByText("(2,5)")).not.toBeInTheDocument();
    expect(screen.queryByText("demo-review-stu022-vertex-features-due")).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-023/u)).not.toBeInTheDocument();
  });

  it("does not invent a practice attempt when API data lacks the STU-017 document", () => {
    const apiCatalog: CourseCatalog = {
      ...demoCourseCatalog,
      source: "API",
      courses: [
        {
          id: "api-course-math-8-spring",
          subjectCode: "MATH",
          subjectLabel: "数学",
          grade: 8,
          term: "SPRING",
          textbookStatus: "CONFIRMED",
          textbookLabel: "服务端教材",
          currentPosition: "当前知识点由服务端返回",
          currentChapter: "当前章节由服务端返回",
          progressLabel: "进度统计尚未接入",
          progressPercent: 0,
        },
      ],
      materialTypeCounts: [],
      recentMaterials: [],
    };

    render(
      <MemoryRouter initialEntries={["/student/learn?grade=8&term=SPRING&subject=MATH&view=practice-attempt&chapter=api-chapter-21-2&knowledge=api-kp-vertex-form&target=api-practice-attempt&attempt=api-attempt"]}>
        <CourseMaterialsView catalog={apiCatalog} currentUser={{ status: "anonymous" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "独立练习" })).toBeInTheDocument();
    expect(screen.getByText("练习作答服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByText(/当前课程上下文没有可用的 STU-017 练习作答文档/u)).toBeInTheDocument();
    expect(screen.queryByText("抛物线拱门的高度与位置")).not.toBeInTheDocument();
    expect(screen.queryByText(/一座拱门的轮廓可近似表示为/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/DEVELOPMENT_FIXTURE · 仅用于 STU-017/u)).not.toBeInTheDocument();
  });
});
