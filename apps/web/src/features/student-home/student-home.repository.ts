import {
  DailyPlanResponseSchema,
  StudentTextbookContextResponseSchema,
} from "@study/contracts";
import type { StudentTextbookContextResponse } from "@study/contracts";
import { loadStudentHomeDemo } from "#student-home-demo-provider";

import { HttpError, requestJson } from "../../api/http-client";
import type { HomeCourseSnapshot, StudentHomeResult } from "./types";

export interface StudentHomeRepository {
  loadToday(studentUserId?: string, signal?: AbortSignal): Promise<StudentHomeResult>;
}

export interface StudentHomeRepositoryOptions {
  readonly demoEnabled: boolean;
  readonly demoDelayMs?: number;
  readonly request?: (path: string, signal?: AbortSignal) => Promise<unknown>;
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

export function createStudentHomeRepository(options: StudentHomeRepositoryOptions): StudentHomeRepository {
  const loadJson = options.request ?? requestJson;

  async function fixtureOr(reason: Extract<StudentHomeResult, { status: "unavailable" }> ["reason"], signal?: AbortSignal): Promise<StudentHomeResult> {
    if (!options.demoEnabled) {
      return { status: "unavailable", reason };
    }
    const snapshot = loadStudentHomeDemo();
    if (snapshot === null) {
      return { status: "unavailable", reason };
    }
    await wait(options.demoDelayMs ?? 260, signal);
    return { status: "ready", snapshot };
  }

  function currentCourse(context: StudentTextbookContextResponse): HomeCourseSnapshot {
    if (context.mode === "TEXTBOOK_ALIGNED") {
      return {
        subjectCode: "MATH",
        subjectLabel: "数学",
        textbookLabel: `${context.textbook.publisher} · ${context.textbook.editionName} ${context.textbook.volume}`,
        currentPosition: context.currentUnit === null
          ? "当前单元尚未设置"
          : `第 ${String(context.currentUnit.ordinal)} 单元 · ${context.currentUnit.title}`,
        progressPercent: 0,
      };
    }
    return {
      subjectCode: "MATH",
      subjectLabel: "数学",
      textbookLabel: "通用学习指引",
      currentPosition: context.hasPendingSubmission ? "教材信息待审核" : "教材信息待提交",
      progressPercent: 0,
    };
  }

  return {
    async loadToday(studentUserId?: string, signal?: AbortSignal): Promise<StudentHomeResult> {
      if (studentUserId === undefined) {
        return fixtureOr("NOT_AUTHENTICATED", signal);
      }
      try {
        const [planPayload, contextPayload] = await Promise.all([
          loadJson(`/v1/students/${encodeURIComponent(studentUserId)}/daily-plans/today`, signal),
          loadJson(`/v1/students/${encodeURIComponent(studentUserId)}/textbook-contexts/MATH`, signal),
        ]);
        return {
          status: "ready",
          snapshot: {
            source: "API",
            dailyPlan: DailyPlanResponseSchema.parse(planPayload),
            currentCourse: currentCourse(StudentTextbookContextResponseSchema.parse(contextPayload)),
          },
        };
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        return fixtureOr(
          error instanceof HttpError && error.status === 404 ? "NO_DAILY_PLAN" : "DAILY_PLAN_SERVICE_UNAVAILABLE",
          signal,
        );
      }
    },
  };
}

export const studentHomeRepository = createStudentHomeRepository({
  demoEnabled:
    (import.meta.env.DEV ||
      (import.meta.env.MODE === "qa" && import.meta.env.VITE_QA_DEMO_BUILD === "true")) &&
    import.meta.env.VITE_ENABLE_DEMO_COURSE_CATALOG === "true",
});
