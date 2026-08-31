import { describe, expect, it } from "vitest";

import {
  deriveStructuredCompletion,
  structuredApplicationInitialState,
  structuredApplicationReducer,
} from "./use-structured-application-session";
import type { StructuredApplicationFieldId, StructuredApplicationSessionState } from "./types";

function setField(
  state: StructuredApplicationSessionState,
  field: StructuredApplicationFieldId,
  value: string,
): StructuredApplicationSessionState {
  return structuredApplicationReducer(state, { type: "SET_FIELD", field, value, explanationMaxLength: 120 });
}

function completeState(): StructuredApplicationSessionState {
  let state = structuredApplicationInitialState;
  state = setField(state, "vertexX", "2");
  state = setField(state, "vertexY", "4");
  state = setField(state, "interceptX1", "0");
  state = setField(state, "interceptX2", "4");
  state = setField(state, "width", "4");
  return setField(state, "explanation", "先识别最高点，再比较两个地面交点之间的距离。");
}

describe("structured application session", () => {
  it("starts with empty fields, no completed checklist items, and disabled submission", () => {
    expect(Object.values(structuredApplicationInitialState.values).every((value) => value === "")).toBe(true);
    expect(deriveStructuredCompletion(structuredApplicationInitialState.values, 120)).toEqual({
      vertexComplete: false,
      interceptsComplete: false,
      widthComplete: false,
      explanationComplete: false,
      allComplete: false,
    });
    expect(structuredApplicationInitialState.phase).toBe("EDITING");
  });

  it("accepts finite integers, negative values, decimals, unicode minus, and trimmed values", () => {
    let state = setField(structuredApplicationInitialState, "vertexX", " −2.5 ");
    state = setField(state, "vertexY", "4");
    expect(deriveStructuredCompletion(state.values, 120).vertexComplete).toBe(true);
  });

  it("reports numeric format errors on blur without checking answer correctness", () => {
    let state = setField(structuredApplicationInitialState, "vertexX", "y=2");
    state = structuredApplicationReducer(state, { type: "BLUR_FIELD", field: "vertexX" });
    expect(state.fieldErrors.vertexX).toBe("请输入有限数值");

    state = setField(state, "vertexX", "99");
    state = structuredApplicationReducer(state, { type: "BLUR_FIELD", field: "vertexX" });
    expect(state.fieldErrors.vertexX).toBeNull();
  });

  it("requires intercepts to be entered from smaller to larger without revealing values", () => {
    let state = setField(structuredApplicationInitialState, "interceptX1", "8");
    state = setField(state, "interceptX2", "1");
    state = structuredApplicationReducer(state, { type: "BLUR_FIELD", field: "interceptX2" });
    expect(state.fieldErrors.interceptX2).toBe("请按从小到大填写");
    expect(deriveStructuredCompletion(state.values, 120).interceptsComplete).toBe(false);
  });

  it("rejects a negative width but does not compare it with the answer key", () => {
    let state = setField(structuredApplicationInitialState, "width", "-1");
    state = structuredApplicationReducer(state, { type: "BLUR_FIELD", field: "width" });
    expect(state.fieldErrors.width).toBe("宽度必须为非负数");

    state = setField(state, "width", "999");
    state = structuredApplicationReducer(state, { type: "BLUR_FIELD", field: "width" });
    expect(state.fieldErrors.width).toBeNull();
  });

  it("trims explanation completeness and blocks content over 120 characters with feedback", () => {
    let state = setField(structuredApplicationInitialState, "explanation", "   ");
    expect(deriveStructuredCompletion(state.values, 120).explanationComplete).toBe(false);

    const atLimit = "判".repeat(120);
    state = setField(state, "explanation", atLimit);
    expect(state.values.explanation).toHaveLength(120);
    expect(deriveStructuredCompletion(state.values, 120).explanationComplete).toBe(true);

    state = setField(state, "explanation", `${atLimit}断`);
    expect(state.values.explanation).toBe(atLimit);
    expect(state.fieldErrors.explanation).toContain("超出内容未写入");
  });

  it("derives READY_TO_SUBMIT only when all four requirements are complete", () => {
    const state = completeState();
    expect(state.phase).toBe("READY_TO_SUBMIT");
    expect(deriveStructuredCompletion(state.values, 120).allComplete).toBe(true);
  });

  it("returns to EDITING when one completed field is cleared", () => {
    const state = setField(completeState(), "width", "");
    expect(state.phase).toBe("EDITING");
    expect(deriveStructuredCompletion(state.values, 120).widthComplete).toBe(false);
  });

  it("prevents duplicate submit transitions and preserves all values on service unavailable", () => {
    const ready = completeState();
    const submitting = structuredApplicationReducer(ready, { type: "SUBMIT_START" });
    expect(submitting.phase).toBe("SUBMITTING");
    expect(structuredApplicationReducer(submitting, { type: "SUBMIT_START" })).toBe(submitting);

    const unavailable = structuredApplicationReducer(submitting, { type: "SUBMIT_UNAVAILABLE" });
    expect(unavailable.phase).toBe("SERVICE_UNAVAILABLE");
    expect(unavailable.values).toEqual(ready.values);
    expect(unavailable.submitError).toContain("全部输入仍保留");
  });

  it("keeps review and hints as local state without marking the response complete", () => {
    let state = structuredApplicationReducer(structuredApplicationInitialState, { type: "TOGGLE_REVIEW" });
    state = structuredApplicationReducer(state, { type: "TOGGLE_HINT_ONE" });
    state = structuredApplicationReducer(state, { type: "TOGGLE_HINT_TWO" });
    expect(state.markedForReview).toBe(true);
    expect(state.hintOneUsed).toBe(true);
    expect(state.hintTwoOpen).toBe(true);
    expect(deriveStructuredCompletion(state.values, 120).allComplete).toBe(false);
  });
});
