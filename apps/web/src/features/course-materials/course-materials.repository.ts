import {
  StudentTextbookContextResponseSchema,
  availableSubjectsForGrade,
} from "@study/contracts";
import type { StudentTextbookContextResponse, SubjectCode as ContractSubjectCode } from "@study/contracts";
import { loadCourseCatalogDemo } from "#course-catalog-demo-provider";

import { requestJson } from "../../api/http-client";
import type { CourseCatalog, CourseCatalogResult, CourseSummary, SubjectCode, Term } from "./types";

export interface CourseMaterialsRepository {
  loadCatalog(studentUserId?: string, signal?: AbortSignal): Promise<CourseCatalogResult>;
}

export interface CourseMaterialsRepositoryOptions {
  readonly demoEnabled: boolean;
  readonly demoDelayMs?: number;
  readonly request?: (path: string, signal?: AbortSignal) => Promise<unknown>;
}

const subjectLabels: Readonly<Record<SubjectCode, string>> = {
  CHINESE: "语文",
  MATH: "数学",
  ENGLISH: "英语",
  MORALITY: "道德与法治",
  HISTORY: "历史",
  PHYSICS: "物理",
  CHEMISTRY: "化学",
};

function termFromContext(context: StudentTextbookContextResponse): Term {
  if (context.mode === "TEXTBOOK_ALIGNED" && /下|春/u.test(context.textbook.volume)) {
    return "SPRING";
  }
  return "AUTUMN";
}

function courseFromContext(context: StudentTextbookContextResponse): CourseSummary {
  const subjectCode = context.subjectCode;
  if (context.mode === "TEXTBOOK_ALIGNED") {
    const currentPosition = context.currentUnit === null
      ? "当前单元尚未设置"
      : `第 ${String(context.currentUnit.ordinal)} 单元 · ${context.currentUnit.title}`;
    return {
      id: context.textbook.id,
      subjectCode,
      subjectLabel: subjectLabels[subjectCode],
      grade: context.grade,
      term: termFromContext(context),
      textbookStatus: "CONFIRMED",
      textbookLabel: `${context.textbook.publisher} · ${context.textbook.editionName} ${context.textbook.volume}`,
      currentPosition,
      currentChapter: currentPosition,
      progressLabel: "进度统计尚未接入",
      progressPercent: 0,
    };
  }
  return {
    id: `${context.studentUserId}:${context.subjectCode}`,
    subjectCode,
    subjectLabel: subjectLabels[subjectCode],
    grade: context.grade,
    term: "AUTUMN",
    textbookStatus: "GENERAL_GUIDANCE",
    textbookLabel: context.hasPendingSubmission ? "教材信息待审核" : "通用学习指引",
    currentPosition: "尚未确认教材与当前单元",
    currentChapter: "通用学习路径",
    progressLabel: "暂无后端进度数据",
    progressPercent: 0,
  };
}

function catalogFromContexts(contexts: readonly StudentTextbookContextResponse[]): CourseCatalog {
  const courses = contexts.map(courseFromContext);
  const aligned = contexts.find((context) => context.mode === "TEXTBOOK_ALIGNED");
  const first = contexts[0];
  if (first === undefined) {
    throw new Error("Course contexts cannot be empty");
  }
  return {
    source: "API",
    generatedAt: new Date().toISOString(),
    courses,
    recentMaterials: [],
    textbookMetadata: {
      publisher: aligned?.mode === "TEXTBOOK_ALIGNED" ? aligned.textbook.publisher : "教材尚未确认",
      gradeLabel: `${String(first.grade)}年级`,
      termLabel: courses[0]?.term === "SPRING" ? "下学期" : "上学期",
      materialTypesLabel: "资料聚合接口尚未开放",
    },
    materialTypeCounts: [
      { materialType: "TEXTBOOK", label: "教材", count: courses.filter((course) => course.textbookStatus === "CONFIRMED").length },
      { materialType: "LECTURE_NOTE", label: "课堂笔记", count: 0 },
      { materialType: "EXERCISE", label: "练习资料", count: 0 },
      { materialType: "OCR_EVIDENCE", label: "OCR 识别资料", count: 0 },
    ],
  };
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Request aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function createCourseMaterialsRepository(
  options: CourseMaterialsRepositoryOptions,
): CourseMaterialsRepository {
  const loadJson = options.request ?? requestJson;

  async function fixtureOrUnavailable(signal?: AbortSignal): Promise<CourseCatalogResult> {
    if (!options.demoEnabled) {
      return { status: "unavailable", reason: "COURSE_SERVICE_UNAVAILABLE" };
    }
    const catalog = loadCourseCatalogDemo();
    if (catalog === null) {
      return { status: "unavailable", reason: "COURSE_SERVICE_UNAVAILABLE" };
    }
    await wait(options.demoDelayMs ?? 320, signal);
    return { status: "ready", catalog };
  }

  return {
    async loadCatalog(studentUserId?: string, signal?: AbortSignal): Promise<CourseCatalogResult> {
      if (studentUserId === undefined) {
        if (!options.demoEnabled) {
          return { status: "unavailable", reason: "NOT_AUTHENTICATED" };
        }
        const catalog = loadCourseCatalogDemo();
        if (catalog === null) {
          return { status: "unavailable", reason: "NOT_AUTHENTICATED" };
        }
        await wait(options.demoDelayMs ?? 320, signal);
        return { status: "ready", catalog };
      }
      try {
        const math = StudentTextbookContextResponseSchema.parse(await loadJson(
          `/v1/students/${encodeURIComponent(studentUserId)}/textbook-contexts/MATH`,
          signal,
        ));
        const remainingSubjects = availableSubjectsForGrade(math.grade)
          .filter((subjectCode) => subjectCode !== "MATH");
        const remaining = await Promise.all(remainingSubjects.map(async (subjectCode: ContractSubjectCode) =>
          StudentTextbookContextResponseSchema.parse(await loadJson(
            `/v1/students/${encodeURIComponent(studentUserId)}/textbook-contexts/${subjectCode}`,
            signal,
          )),
        ));
        const contexts = availableSubjectsForGrade(math.grade).map((subjectCode) =>
          subjectCode === "MATH"
            ? math
            : remaining.find((context) => context.subjectCode === subjectCode),
        ).filter((context): context is StudentTextbookContextResponse => context !== undefined);
        return { status: "ready", catalog: catalogFromContexts(contexts) };
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        return fixtureOrUnavailable(signal);
      }
    },
  };
}

export const courseMaterialsRepository = createCourseMaterialsRepository({
  demoEnabled:
    (import.meta.env.DEV ||
      (import.meta.env.MODE === "qa" && import.meta.env.VITE_QA_DEMO_BUILD === "true")) &&
    import.meta.env.VITE_ENABLE_DEMO_COURSE_CATALOG === "true",
});
