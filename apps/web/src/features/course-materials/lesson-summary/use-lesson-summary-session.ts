import { useEffect, useReducer, useRef } from "react";

import type {
  LessonSummaryCompletion,
  LessonSummaryDocument,
  LessonSummarySessionState,
  LessonSummaryValues,
  SummaryPromptId,
} from "./types";

export type LessonSummaryAction =
  | { readonly type: "SET_FIELD"; readonly field: SummaryPromptId; readonly value: string; readonly maxLength: number }
  | { readonly type: "FOCUS_FIELD"; readonly field: SummaryPromptId }
  | { readonly type: "BLUR_FIELD"; readonly field: SummaryPromptId; readonly maxLength: number }
  | { readonly type: "COMPLETE_START" }
  | { readonly type: "COMPLETE_UNAVAILABLE" }
  | { readonly type: "REQUEST_AI_CHECK" };

const emptyValues: LessonSummaryValues = {
  openingSummary: "",
  axisVertexSummary: "",
  plottingCheckSummary: "",
};

const emptyErrors: Readonly<Record<SummaryPromptId, string | null>> = {
  openingSummary: null,
  axisVertexSummary: null,
  plottingCheckSummary: null,
};

export const lessonSummaryInitialState: LessonSummarySessionState = {
  phase: "EDITING",
  values: emptyValues,
  touchedFields: [],
  fieldErrors: emptyErrors,
  focusedField: null,
  limitExceededField: null,
  aiCheckRequested: false,
  aiCheckState: "DISABLED_EMPTY",
  completionError: null,
};

function lengthIsComplete(value: string, maxLength: number): boolean {
  const length = value.trim().length;
  return length >= 1 && length <= maxLength;
}

export function deriveLessonSummaryCompletion(
  values: LessonSummaryValues,
  document: LessonSummaryDocument,
): LessonSummaryCompletion {
  const openingPrompt = document.summaryPrompts.find((prompt) => prompt.id === "openingSummary");
  const axisPrompt = document.summaryPrompts.find((prompt) => prompt.id === "axisVertexSummary");
  const plottingPrompt = document.summaryPrompts.find((prompt) => prompt.id === "plottingCheckSummary");
  if (openingPrompt === undefined || axisPrompt === undefined || plottingPrompt === undefined) {
    throw new Error("Lesson summary fixture must include all three prompts");
  }
  const openingComplete = lengthIsComplete(values.openingSummary, openingPrompt.maxLength);
  const axisVertexComplete = lengthIsComplete(values.axisVertexSummary, axisPrompt.maxLength);
  const plottingCheckComplete = lengthIsComplete(values.plottingCheckSummary, plottingPrompt.maxLength);
  const hasContent = [values.openingSummary, values.axisVertexSummary, values.plottingCheckSummary]
    .some((value) => value.trim().length > 0);
  return {
    openingComplete,
    axisVertexComplete,
    plottingCheckComplete,
    allComplete: openingComplete && axisVertexComplete && plottingCheckComplete,
    hasContent,
  };
}

function nextPhase(values: LessonSummaryValues, document: LessonSummaryDocument): "EDITING" | "READY_TO_COMPLETE" {
  return deriveLessonSummaryCompletion(values, document).allComplete ? "READY_TO_COMPLETE" : "EDITING";
}

function addTouched(fields: readonly SummaryPromptId[], field: SummaryPromptId): readonly SummaryPromptId[] {
  return fields.includes(field) ? fields : [...fields, field];
}

function validationMessage(value: string, maxLength: number): string | null {
  const length = value.trim().length;
  if (length === 0) return "此项为必填";
  if (length > maxLength) return `最多 ${String(maxLength)} 字`;
  return null;
}

export function createLessonSummaryReducer(document: LessonSummaryDocument) {
  return function lessonSummaryReducer(
    state: LessonSummarySessionState,
    action: LessonSummaryAction,
  ): LessonSummarySessionState {
    switch (action.type) {
      case "SET_FIELD": {
        if (state.phase === "COMPLETING") return state;
        if (action.value.length > action.maxLength) {
          return {
            ...state,
            limitExceededField: action.field,
            fieldErrors: { ...state.fieldErrors, [action.field]: `最多 ${String(action.maxLength)} 字；超出内容未写入` },
          };
        }
        const values = { ...state.values, [action.field]: action.value };
        const hasContent = [values.openingSummary, values.axisVertexSummary, values.plottingCheckSummary]
          .some((value) => value.trim().length > 0);
        return {
          ...state,
          values,
          phase: nextPhase(values, document),
          fieldErrors: {
            ...state.fieldErrors,
            [action.field]: state.touchedFields.includes(action.field)
              ? validationMessage(action.value, action.maxLength)
              : null,
          },
          limitExceededField: null,
          aiCheckState: hasContent ? "AVAILABLE" : "DISABLED_EMPTY",
          aiCheckRequested: false,
          completionError: null,
        };
      }
      case "FOCUS_FIELD":
        return { ...state, focusedField: action.field };
      case "BLUR_FIELD":
        return {
          ...state,
          focusedField: null,
          touchedFields: addTouched(state.touchedFields, action.field),
          fieldErrors: { ...state.fieldErrors, [action.field]: validationMessage(state.values[action.field], action.maxLength) },
        };
      case "COMPLETE_START":
        return state.phase === "READY_TO_COMPLETE"
          ? { ...state, phase: "COMPLETING", completionError: null }
          : state;
      case "COMPLETE_UNAVAILABLE":
        return state.phase === "COMPLETING"
          ? {
              ...state,
              phase: "COMPLETE_SERVICE_UNAVAILABLE",
              completionError: "归纳保存服务尚未接入；当前会话内容仍保留在本页。",
            }
          : state;
      case "REQUEST_AI_CHECK":
        return deriveLessonSummaryCompletion(state.values, document).hasContent
          ? { ...state, aiCheckRequested: true, aiCheckState: "TUTOR_SERVICE_UNAVAILABLE" }
          : state;
    }
  };
}

export function useLessonSummarySession(document: LessonSummaryDocument) {
  const reducer = createLessonSummaryReducer(document);
  const [state, dispatch] = useReducer(reducer, lessonSummaryInitialState);
  const completeTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (completeTimeoutRef.current !== null) window.clearTimeout(completeTimeoutRef.current);
  }, []);

  const completion = deriveLessonSummaryCompletion(state.values, document);
  const completeButtonEnabled = completion.allComplete && state.phase === "READY_TO_COMPLETE";

  function maxLengthFor(field: SummaryPromptId): number {
    const prompt = document.summaryPrompts.find((item) => item.id === field);
    if (prompt === undefined) throw new Error(`Missing lesson summary prompt: ${field}`);
    return prompt.maxLength;
  }

  function complete(): void {
    if (!completeButtonEnabled) return;
    dispatch({ type: "COMPLETE_START" });
    completeTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "COMPLETE_UNAVAILABLE" });
      completeTimeoutRef.current = null;
    }, 220);
  }

  return {
    state,
    completion,
    completeButtonEnabled,
    hasDraft: completion.hasContent,
    setField: (field: SummaryPromptId, value: string) => {
      dispatch({ type: "SET_FIELD", field, value, maxLength: maxLengthFor(field) });
    },
    focusField: (field: SummaryPromptId) => { dispatch({ type: "FOCUS_FIELD", field }); },
    blurField: (field: SummaryPromptId) => {
      dispatch({ type: "BLUR_FIELD", field, maxLength: maxLengthFor(field) });
    },
    requestAiCheck: () => { dispatch({ type: "REQUEST_AI_CHECK" }); },
    complete,
  };
}
