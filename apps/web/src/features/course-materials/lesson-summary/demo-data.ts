import type { LessonSummaryDocument } from "./types";

export const demoLessonSummary: LessonSummaryDocument = {
  source: "DEVELOPMENT_FIXTURE",
  courseId: "demo-course-math-7-autumn",
  lessonId: "fixture-lesson-summary-math-21-2",
  subjectCode: "MATH",
  subjectLabel: "数学",
  lessonLabel: "21.2 二次函数的图像",
  title: "归纳总结",
  subtitle: "整理顺序，留下可复习的方法",
  date: "2026-08-22",
  weekdayChinese: "星期六",
  weekdayEnglish: "Saturday",
  estimatedMinutes: 5,
  steps: [
    { id: "INTRO", label: "知识导入", state: "COMPLETED" },
    { id: "EXAMPLE", label: "例题讲解", state: "COMPLETED" },
    { id: "PRACTICE", label: "随堂练习", state: "COMPLETED" },
    { id: "SUMMARY", label: "归纳总结", state: "CURRENT" },
  ],
  methodTitle: "判断二次函数图像的固定顺序",
  methodSummary: "先看开口，再找轴与顶点，随后描点，最后用对称性和交点核对。",
  methodSteps: [
    { id: "OPENING", number: 1, title: "看开口", description: "观察二次项系数 a 的正负" },
    { id: "AXIS_VERTEX", number: 2, title: "找轴与顶点", description: "从顶点式或一般式确定位置" },
    { id: "PLOT", number: 3, title: "描点成图", description: "选择对称的 x 值，计算并描点" },
    { id: "VERIFY", number: 4, title: "核对特征", description: "检查对称、顶点和与坐标轴的交点" },
  ],
  expressionComparisonTitle: "两种表达式怎么看",
  expressionNote: "公式帮助定位图像，最终仍要结合计算与图像核对。",
  expressionGuides: [
    { id: "GENERAL", label: "一般式", formula: "y = ax² + bx + c", explanation: "先判断 a，再确定对称轴和顶点。" },
    { id: "VERTEX", label: "顶点式", formula: "y = a(x − h)² + k", explanation: "对称轴 x = h，顶点为 (h,k)。" },
  ],
  summaryPrompts: [
    { id: "openingSummary", label: "判断开口方向时，我先看", placeholder: "写下你的判断方法", maxLength: 40, multiline: false },
    { id: "axisVertexSummary", label: "确定对称轴与顶点时，我会", placeholder: "写下你的步骤", maxLength: 80, multiline: true },
    { id: "plottingCheckSummary", label: "描点后，我怎样检查图像", placeholder: "写下你的检查方法", maxLength: 80, multiline: true },
  ],
  practiceResult: {
    submittedQuestions: 5,
    recoveredAfterHint: 1,
    pendingReview: 1,
    masteryState: "UNCHANGED",
  },
  saveServiceState: "LESSON_SUMMARY_SAVE_UNAVAILABLE",
};
