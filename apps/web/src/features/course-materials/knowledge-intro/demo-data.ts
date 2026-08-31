import type { KnowledgeIntroDocument } from "./types";

export const demoKnowledgeIntro: KnowledgeIntroDocument = {
  source: "DEVELOPMENT_FIXTURE",
  courseId: "demo-course-math-7-autumn",
  subjectCode: "MATH",
  subjectLabel: "数学",
  title: "知识导入",
  subtitle: "回顾函数与平面直角坐标系",
  estimatedMinutes: 5,
  textbookLabel: "清朗示例版 · 七年级上册（虚构）",
  steps: [
    { id: "INTRO", label: "知识导入", state: "CURRENT" },
    { id: "EXAMPLE", label: "例题讲解", state: "UPCOMING" },
    { id: "PRACTICE", label: "随堂练习", state: "UPCOMING" },
    { id: "SUMMARY", label: "归纳总结", state: "UPCOMING" },
  ],
  priorKnowledge: [
    { term: "平面直角坐标系", explanation: "由横轴、纵轴和原点组成，用有序数对表示点的位置。" },
    { term: "函数图像", explanation: "把满足函数关系的点描在坐标系中，并按规律连接。" },
    { term: "描点步骤", explanation: "列表、描点、连线。" },
  ],
  processSteps: ["列表", "描点", "连线"],
  functionStudy: {
    formula: "y = x²",
    points: [
      { x: -2, y: 4 },
      { x: -1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
    ],
    explanation: "当 x 取相反数时，y 的值相同；图像关于 y 轴对称。",
  },
  check: {
    question: "下面哪一个解析式表示二次函数？",
    choices: [
      { id: "A", label: "y = 2x + 1" },
      { id: "B", label: "y = x²" },
      { id: "C", label: "y = 1/x" },
      { id: "D", label: "y = 3" },
    ],
    correctChoiceId: "B",
    correctFeedback: "回答正确。y = x² 的最高次数是 2，属于二次函数。",
    incorrectFeedback: "这不是二次函数。请观察未知数 x 的最高次数，再重新选择。",
    explanation: "二次函数的一般形式是 y = ax² + bx + c，其中 a 不等于 0。",
  },
  goals: ["回顾坐标系与函数图像", "理解描点法的基本过程", "观察 y = x² 的图像特征"],
  resources: [
    {
      id: "fixture-textbook-excerpt",
      title: "教材原文",
      metadata: "P32–P33 · 虚构页码",
      state: "FIXTURE_AVAILABLE",
      fixtureSummary: "这是一段用于验证交互和排版的 Fixture 摘要，不是生产教材内容。",
    },
    {
      id: "worked-example-resource",
      title: "例题讲义",
      metadata: "资料服务尚未接入",
      state: "SERVICE_UNAVAILABLE",
    },
  ],
};
