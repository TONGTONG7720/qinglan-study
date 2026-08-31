import type { QuestionModeKind } from "../types";

const questionTargetCopy: Record<QuestionModeKind, { readonly title: string; readonly subtitle: string }> = {
  TEXT: {
    title: "文字提问",
    subtitle: "文字提问请从提问中心进入 STU-011 编写页；当前边界不会创建 TutorSession、提问记录或学习证据。",
  },
  IMAGE: {
    title: "单题图片上传",
    subtitle: "单题图片请从提问中心进入 STU-012 上传页；当前旧边界不会上传真实图片、执行 OCR 或创建辅导会话。",
  },
};

export function getQuestionTargetCopy(kind: QuestionModeKind): { readonly title: string; readonly subtitle: string } {
  return questionTargetCopy[kind];
}
