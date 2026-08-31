import { useEffect, useReducer, useRef } from "react";

import { parseNumericAnswer } from "./numeric-answer";
import type {
  DraftOcrState,
  StructuredApplicationCompletion,
  StructuredApplicationFieldId,
  StructuredApplicationPracticeQuestion,
  StructuredApplicationSessionState,
  StructuredApplicationValues,
} from "./types";

export type StructuredApplicationAction =
  | { readonly type: "SET_FIELD"; readonly field: StructuredApplicationFieldId; readonly value: string; readonly explanationMaxLength: number }
  | { readonly type: "FOCUS_FIELD"; readonly field: StructuredApplicationFieldId }
  | { readonly type: "BLUR_FIELD"; readonly field: StructuredApplicationFieldId }
  | { readonly type: "TOGGLE_REVIEW" }
  | { readonly type: "TOGGLE_HINT_ONE" }
  | { readonly type: "TOGGLE_HINT_TWO" }
  | { readonly type: "OCR_STATE"; readonly state: DraftOcrState; readonly fileName?: string }
  | { readonly type: "SUBMIT_START" }
  | { readonly type: "SUBMIT_UNAVAILABLE" };

const emptyErrors: Readonly<Record<StructuredApplicationFieldId, string | null>> = {
  vertexX: null,
  vertexY: null,
  interceptX1: null,
  interceptX2: null,
  width: null,
  explanation: null,
};

const emptyValues: StructuredApplicationValues = {
  vertexX: "",
  vertexY: "",
  interceptX1: "",
  interceptX2: "",
  width: "",
  explanation: "",
};

export const structuredApplicationInitialState: StructuredApplicationSessionState = {
  phase: "EDITING",
  values: emptyValues,
  touchedFields: [],
  focusedField: null,
  fieldErrors: emptyErrors,
  explanationLimitExceeded: false,
  markedForReview: false,
  hintOneUsed: false,
  hintOneOpen: false,
  hintTwoOpen: false,
  draftOcrState: "EMPTY",
  draftFileName: null,
  submitError: null,
};

function isFiniteNumericValue(value: string): boolean {
  return parseNumericAnswer(value) !== null;
}

export function deriveStructuredCompletion(
  values: StructuredApplicationValues,
  explanationMaxLength: number,
): StructuredApplicationCompletion {
  const interceptX1 = parseNumericAnswer(values.interceptX1);
  const interceptX2 = parseNumericAnswer(values.interceptX2);
  const explanationLength = values.explanation.trim().length;
  const vertexComplete = isFiniteNumericValue(values.vertexX) && isFiniteNumericValue(values.vertexY);
  const interceptsComplete = interceptX1 !== null && interceptX2 !== null && interceptX1 <= interceptX2;
  const width = parseNumericAnswer(values.width);
  const widthComplete = width !== null && width >= 0;
  const explanationComplete = explanationLength >= 1 && explanationLength <= explanationMaxLength;
  return {
    vertexComplete,
    interceptsComplete,
    widthComplete,
    explanationComplete,
    allComplete: vertexComplete && interceptsComplete && widthComplete && explanationComplete,
  };
}

function validationMessage(
  field: StructuredApplicationFieldId,
  values: StructuredApplicationValues,
): string | null {
  if (field === "explanation") {
    return values.explanation.trim().length === 0 ? "请填写判断依据" : null;
  }
  const value = values[field];
  if (parseNumericAnswer(value) === null) return value.trim().length === 0 ? "此项为必填" : "请输入有限数值";
  if (field === "width" && (parseNumericAnswer(value) ?? -1) < 0) return "宽度必须为非负数";
  if (field === "interceptX1" || field === "interceptX2") {
    const first = parseNumericAnswer(values.interceptX1);
    const second = parseNumericAnswer(values.interceptX2);
    if (first !== null && second !== null && first > second) return "请按从小到大填写";
  }
  return null;
}

function phaseFor(values: StructuredApplicationValues, explanationMaxLength: number): "EDITING" | "READY_TO_SUBMIT" {
  return deriveStructuredCompletion(values, explanationMaxLength).allComplete ? "READY_TO_SUBMIT" : "EDITING";
}

function addTouched(
  touchedFields: readonly StructuredApplicationFieldId[],
  field: StructuredApplicationFieldId,
): readonly StructuredApplicationFieldId[] {
  return touchedFields.includes(field) ? touchedFields : [...touchedFields, field];
}

export function structuredApplicationReducer(
  state: StructuredApplicationSessionState,
  action: StructuredApplicationAction,
): StructuredApplicationSessionState {
  switch (action.type) {
    case "SET_FIELD": {
      if (state.phase === "SUBMITTING") return state;
      if (action.field === "explanation" && action.value.length > action.explanationMaxLength) {
        return {
          ...state,
          explanationLimitExceeded: true,
          fieldErrors: { ...state.fieldErrors, explanation: `最多 ${String(action.explanationMaxLength)} 字；超出内容未写入` },
        };
      }
      const values = { ...state.values, [action.field]: action.value };
      const nextError = state.touchedFields.includes(action.field) ? validationMessage(action.field, values) : null;
      return {
        ...state,
        values,
        phase: phaseFor(values, action.explanationMaxLength),
        fieldErrors: { ...state.fieldErrors, [action.field]: nextError },
        explanationLimitExceeded: action.field === "explanation" ? false : state.explanationLimitExceeded,
        submitError: null,
      };
    }
    case "FOCUS_FIELD":
      return { ...state, focusedField: action.field };
    case "BLUR_FIELD": {
      const fieldErrors = { ...state.fieldErrors, [action.field]: validationMessage(action.field, state.values) };
      if (action.field === "interceptX1" || action.field === "interceptX2") {
        const orderError = validationMessage("interceptX2", state.values);
        fieldErrors.interceptX2 = orderError;
      }
      return {
        ...state,
        focusedField: null,
        touchedFields: addTouched(state.touchedFields, action.field),
        fieldErrors,
      };
    }
    case "TOGGLE_REVIEW":
      return { ...state, markedForReview: !state.markedForReview };
    case "TOGGLE_HINT_ONE":
      return { ...state, hintOneUsed: true, hintOneOpen: !state.hintOneOpen };
    case "TOGGLE_HINT_TWO":
      return state.hintOneUsed ? { ...state, hintTwoOpen: !state.hintTwoOpen } : state;
    case "OCR_STATE":
      return { ...state, draftOcrState: action.state, draftFileName: action.fileName ?? state.draftFileName };
    case "SUBMIT_START":
      return state.phase === "READY_TO_SUBMIT" ? { ...state, phase: "SUBMITTING", submitError: null } : state;
    case "SUBMIT_UNAVAILABLE":
      return state.phase === "SUBMITTING"
        ? {
            ...state,
            phase: "SERVICE_UNAVAILABLE",
            submitError: "结构化作答提交服务尚未接入；全部输入仍保留在本页。",
          }
        : state;
  }
}

export function useStructuredApplicationSession(question: StructuredApplicationPracticeQuestion) {
  const [state, dispatch] = useReducer(structuredApplicationReducer, structuredApplicationInitialState);
  const submitTimeoutRef = useRef<number | null>(null);
  const ocrTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (submitTimeoutRef.current !== null) window.clearTimeout(submitTimeoutRef.current);
    if (ocrTimeoutRef.current !== null) window.clearTimeout(ocrTimeoutRef.current);
  }, []);

  const completion = deriveStructuredCompletion(state.values, question.explanationMaxLength);
  const submitEnabled = completion.allComplete && state.phase === "READY_TO_SUBMIT";
  const hasUnsubmittedWork = [
    state.values.vertexX,
    state.values.vertexY,
    state.values.interceptX1,
    state.values.interceptX2,
    state.values.width,
    state.values.explanation,
  ].some((value) => value.trim().length > 0);

  function uploadDraft(fileName: string): void {
    dispatch({ type: "OCR_STATE", state: "UPLOADING", fileName });
    ocrTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "OCR_STATE", state: "PROCESSING" });
      ocrTimeoutRef.current = window.setTimeout(() => {
        dispatch({ type: "OCR_STATE", state: "NEEDS_CONFIRMATION" });
        ocrTimeoutRef.current = null;
      }, 220);
    }, 180);
  }

  function submit(): void {
    if (!submitEnabled) return;
    dispatch({ type: "SUBMIT_START" });
    submitTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "SUBMIT_UNAVAILABLE" });
      submitTimeoutRef.current = null;
    }, 220);
  }

  return {
    state,
    completion,
    submitEnabled,
    hasUnsubmittedWork,
    setField: (field: StructuredApplicationFieldId, value: string) => {
      dispatch({ type: "SET_FIELD", field, value, explanationMaxLength: question.explanationMaxLength });
    },
    focusField: (field: StructuredApplicationFieldId) => { dispatch({ type: "FOCUS_FIELD", field }); },
    blurField: (field: StructuredApplicationFieldId) => { dispatch({ type: "BLUR_FIELD", field }); },
    toggleReview: () => { dispatch({ type: "TOGGLE_REVIEW" }); },
    useHintOne: () => { dispatch({ type: "TOGGLE_HINT_ONE" }); },
    toggleHintTwo: () => { dispatch({ type: "TOGGLE_HINT_TWO" }); },
    uploadDraft,
    confirmDraft: () => { dispatch({ type: "OCR_STATE", state: "CONFIRMED" }); },
    submit,
  };
}
