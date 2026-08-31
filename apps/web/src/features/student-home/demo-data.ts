import { DailyPlanResponseSchema } from "@study/contracts";

import type { StudentHomeSnapshot } from "./types";

const dailyPlan = DailyPlanResponseSchema.parse({
  id: "a0000000-0000-4000-8000-000000000001",
  studentUserId: "a0000000-0000-4000-8000-000000000002",
  learningDay: "2026-08-21",
  totalMinutes: 145,
  tasks: [
    {
      id: "a0000000-0000-4000-8000-000000000011",
      sourceType: "CURRENT_UNIT",
      sourceId: "demo-unit-math-1",
      title: "二次函数的图像与性质",
      estimatedMinutes: 60,
      ordinal: 1,
      status: "PENDING",
    },
    {
      id: "a0000000-0000-4000-8000-000000000012",
      sourceType: "CURRENT_UNIT",
      sourceId: "demo-unit-chinese-1",
      title: "《桃花源记》阅读与赏析",
      estimatedMinutes: 45,
      ordinal: 2,
      status: "PENDING",
    },
    {
      id: "a0000000-0000-4000-8000-000000000013",
      sourceType: "CURRENT_UNIT",
      sourceId: "demo-unit-english-1",
      title: "Unit 6 Reading & Grammar",
      estimatedMinutes: 40,
      ordinal: 3,
      status: "PENDING",
    },
  ],
});

export const demoStudentHomeSnapshot: StudentHomeSnapshot = {
  source: "DEVELOPMENT_FIXTURE",
  dailyPlan,
  currentCourse: {
    subjectCode: "MATH",
    subjectLabel: "数学",
    textbookLabel: "人教版 · 初二下册",
    currentPosition: "第 21 章 · 二次函数的图像与性质",
    progressPercent: 25,
  },
};
