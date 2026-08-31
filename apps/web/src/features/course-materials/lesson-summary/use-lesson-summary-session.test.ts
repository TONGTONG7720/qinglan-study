import { describe, expect, it } from "vitest";

import { demoLessonSummary } from "./demo-data";
import {
  createLessonSummaryReducer,
  deriveLessonSummaryCompletion,
  lessonSummaryInitialState,
} from "./use-lesson-summary-session";
import type { LessonSummarySessionState, SummaryPromptId } from "./types";

const reducer = createLessonSummaryReducer(demoLessonSummary);

function setField(state: LessonSummarySessionState, field: SummaryPromptId, value: string, maxLength: number) {
  return reducer(state, { type: "SET_FIELD", field, value, maxLength });
}

function completeState() {
  let state = setField(lessonSummaryInitialState, "openingSummary", "我先观察系数的符号。", 40);
  state = setField(state, "axisVertexSummary", "我会根据表达式确定对称轴和顶点。", 80);
  return setField(state, "plottingCheckSummary", "描点后检查对称性与坐标轴交点。", 80);
}

describe("lesson summary session", () => {
  it("starts empty with three incomplete items and disabled AI", () => {
    expect(deriveLessonSummaryCompletion(lessonSummaryInitialState.values, demoLessonSummary)).toEqual({
      openingComplete: false,
      axisVertexComplete: false,
      plottingCheckComplete: false,
      allComplete: false,
      hasContent: false,
    });
    expect(lessonSummaryInitialState.phase).toBe("EDITING");
    expect(lessonSummaryInitialState.aiCheckState).toBe("DISABLED_EMPTY");
  });

  it("does not count whitespace as completed content", () => {
    const state = setField(lessonSummaryInitialState, "openingSummary", "   ", 40);
    expect(deriveLessonSummaryCompletion(state.values, demoLessonSummary).openingComplete).toBe(false);
  });

  it("blocks content over the prompt limit and keeps the accepted value", () => {
    const accepted = "方".repeat(40);
    let state = setField(lessonSummaryInitialState, "openingSummary", accepted, 40);
    state = setField(state, "openingSummary", `${accepted}法`, 40);
    expect(state.values.openingSummary).toBe(accepted);
    expect(state.fieldErrors.openingSummary).toContain("超出内容未写入");
  });

  it("derives READY_TO_COMPLETE only when all three prompts are complete", () => {
    const state = completeState();
    expect(state.phase).toBe("READY_TO_COMPLETE");
    expect(deriveLessonSummaryCompletion(state.values, demoLessonSummary).allComplete).toBe(true);
  });

  it("returns to EDITING when a completed prompt is cleared", () => {
    const state = setField(completeState(), "axisVertexSummary", "", 80);
    expect(state.phase).toBe("EDITING");
    expect(deriveLessonSummaryCompletion(state.values, demoLessonSummary).axisVertexComplete).toBe(false);
  });

  it("prevents duplicate completion and preserves draft on unavailable save", () => {
    const ready = completeState();
    const completing = reducer(ready, { type: "COMPLETE_START" });
    expect(completing.phase).toBe("COMPLETING");
    expect(reducer(completing, { type: "COMPLETE_START" })).toBe(completing);
    const unavailable = reducer(completing, { type: "COMPLETE_UNAVAILABLE" });
    expect(unavailable.phase).toBe("COMPLETE_SERVICE_UNAVAILABLE");
    expect(unavailable.values).toEqual(ready.values);
    expect(unavailable.completionError).toContain("当前会话内容仍保留");
  });

  it("unlocks AI after content exists but reports the tutor boundary", () => {
    let state = setField(lessonSummaryInitialState, "openingSummary", "我先自己尝试。", 40);
    expect(state.aiCheckState).toBe("AVAILABLE");
    state = reducer(state, { type: "REQUEST_AI_CHECK" });
    expect(state.aiCheckRequested).toBe(true);
    expect(state.aiCheckState).toBe("TUTOR_SERVICE_UNAVAILABLE");
    expect(state.values.openingSummary).toBe("我先自己尝试。");
  });
});
