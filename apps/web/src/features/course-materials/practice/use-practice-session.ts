import { useEffect, useReducer, useRef } from "react";

import type {
  DraftOcrState,
  PracticeOptionId,
  PracticeSessionState,
  MultipleChoicePracticeQuestion,
} from "./types";

type PracticeSessionAction =
  | { readonly type: "SELECT_OPTION"; readonly optionId: PracticeOptionId }
  | { readonly type: "CHECK_START" }
  | { readonly type: "CHECK_RESULT"; readonly result: "CORRECT" | "INCORRECT_RETRYABLE" }
  | { readonly type: "START_RETRY" }
  | { readonly type: "RETRY_UNAVAILABLE" }
  | { readonly type: "RECOVERY_RESULT"; readonly correct: boolean; readonly optionId: PracticeOptionId }
  | { readonly type: "TOGGLE_REVIEW" }
  | { readonly type: "USE_HINT_ONE" }
  | { readonly type: "TOGGLE_HINT_TWO" }
  | { readonly type: "OCR_STATE"; readonly state: DraftOcrState; readonly fileName?: string }
  | { readonly type: "NEXT_QUESTION" }
  | { readonly type: "OPEN_QUESTION_THREE" }
  | { readonly type: "OPEN_QUESTION_FOUR" }
  | { readonly type: "PREVIOUS_QUESTION" };

const initialState: PracticeSessionState = {
  currentQuestionIndex: 0,
  selectedOptionId: null,
  submitPhase: "IDLE",
  attemptCount: 0,
  previousOptionIds: [],
  markedForReview: false,
  hintOneUsed: false,
  hintOneOpen: false,
  hintTwoOpen: false,
  draftOcrState: "EMPTY",
  draftFileName: null,
};

function reducer(state: PracticeSessionState, action: PracticeSessionAction): PracticeSessionState {
  switch (action.type) {
    case "SELECT_OPTION":
      if (
        state.currentQuestionIndex !== 0 ||
        !["IDLE", "RETRY_EDITING", "RETRY_UNAVAILABLE"].includes(state.submitPhase)
      ) return state;
      return {
        ...state,
        selectedOptionId: action.optionId,
        submitPhase: state.submitPhase === "RETRY_UNAVAILABLE" ? "RETRY_EDITING" : state.submitPhase,
      };
    case "CHECK_START":
      if (state.selectedOptionId === null) return state;
      if (state.submitPhase === "IDLE") return { ...state, submitPhase: "CHECKING" };
      if (state.submitPhase === "RETRY_EDITING" || state.submitPhase === "RETRY_UNAVAILABLE") {
        return { ...state, submitPhase: "RETRY_CHECKING" };
      }
      return state;
    case "CHECK_RESULT":
      if (state.submitPhase !== "CHECKING") return state;
      return {
        ...state,
        attemptCount: 1,
        previousOptionIds: action.result === "INCORRECT_RETRYABLE" && state.selectedOptionId !== null
          ? [state.selectedOptionId]
          : state.previousOptionIds,
        hintOneUsed: action.result === "INCORRECT_RETRYABLE" ? true : state.hintOneUsed,
        hintOneOpen: action.result === "INCORRECT_RETRYABLE" ? false : state.hintOneOpen,
        hintTwoOpen: false,
        submitPhase: action.result,
      };
    case "START_RETRY":
      return state.submitPhase === "INCORRECT_RETRYABLE"
        ? { ...state, submitPhase: "RETRY_EDITING" }
        : state;
    case "RETRY_UNAVAILABLE":
      return state.submitPhase === "RETRY_CHECKING"
        ? { ...state, submitPhase: "RETRY_UNAVAILABLE" }
        : state;
    case "RECOVERY_RESULT":
      if (state.submitPhase !== "RETRY_CHECKING") return state;
      return action.correct
        ? { ...state, submitPhase: "RECOVERED_CORRECT", attemptCount: state.attemptCount + 1, hintTwoOpen: false }
        : {
            ...state,
            submitPhase: "INCORRECT_RETRYABLE",
            attemptCount: state.attemptCount + 1,
            previousOptionIds: [...state.previousOptionIds, action.optionId],
            hintOneUsed: true,
            hintOneOpen: false,
            hintTwoOpen: false,
          };
    case "TOGGLE_REVIEW":
      return { ...state, markedForReview: !state.markedForReview };
    case "USE_HINT_ONE":
      return { ...state, hintOneUsed: true, hintOneOpen: !state.hintOneOpen };
    case "TOGGLE_HINT_TWO":
      return state;
    case "OCR_STATE":
      return {
        ...state,
        draftOcrState: action.state,
        draftFileName: action.fileName ?? state.draftFileName,
      };
    case "NEXT_QUESTION":
      if (state.submitPhase !== "CORRECT" && state.submitPhase !== "RECOVERED_CORRECT") return state;
      return { ...state, currentQuestionIndex: 1 };
    case "OPEN_QUESTION_THREE":
      return state.currentQuestionIndex === 1 ? { ...state, currentQuestionIndex: 2 } : state;
    case "OPEN_QUESTION_FOUR":
      return state.currentQuestionIndex === 2 ? { ...state, currentQuestionIndex: 3 } : state;
    case "PREVIOUS_QUESTION":
      return state.currentQuestionIndex === 0
        ? state
        : { ...state, currentQuestionIndex: state.currentQuestionIndex - 1 };
  }
}

export function usePracticeSession(question: MultipleChoicePracticeQuestion, initialQuestionIndex = 0) {
  const [state, dispatch] = useReducer(
    reducer,
    initialQuestionIndex,
    (questionIndex): PracticeSessionState => questionIndex === 4
      ? {
          ...initialState,
          currentQuestionIndex: 4,
          selectedOptionId: "B",
          submitPhase: "RECOVERED_CORRECT",
          attemptCount: 2,
          previousOptionIds: ["A"],
          hintOneUsed: true,
        }
      : initialState,
  );
  const submitTimeoutRef = useRef<number | null>(null);
  const ocrTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (submitTimeoutRef.current !== null) window.clearTimeout(submitTimeoutRef.current);
      if (ocrTimeoutRef.current !== null) window.clearTimeout(ocrTimeoutRef.current);
    },
    [],
  );

  const hintTwoUnlocked = false;
  const submitEnabled =
    state.selectedOptionId !== null &&
    ["IDLE", "RETRY_EDITING", "RETRY_UNAVAILABLE"].includes(state.submitPhase);
  const hasUnsubmittedSelection =
    state.selectedOptionId !== null &&
    ["IDLE", "RETRY_EDITING", "RETRY_UNAVAILABLE"].includes(state.submitPhase);

  function submit(): void {
    if (!submitEnabled) return;
    const selected = state.selectedOptionId;
    const retrying = state.submitPhase === "RETRY_EDITING" || state.submitPhase === "RETRY_UNAVAILABLE";
    dispatch({ type: "CHECK_START" });
    submitTimeoutRef.current = window.setTimeout(() => {
      if (retrying) {
        dispatch({ type: "RECOVERY_RESULT", correct: selected === question.answerKey, optionId: selected });
      } else {
        dispatch({
          type: "CHECK_RESULT",
          result: selected === question.answerKey ? "CORRECT" : "INCORRECT_RETRYABLE",
        });
      }
      submitTimeoutRef.current = null;
    }, 220);
  }

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

  return {
    state,
    submitEnabled,
    hintTwoUnlocked,
    hasUnsubmittedSelection,
    selectOption: (optionId: PracticeOptionId) => { dispatch({ type: "SELECT_OPTION", optionId }); },
    submit,
    startRetry: () => { dispatch({ type: "START_RETRY" }); },
    toggleReview: () => { dispatch({ type: "TOGGLE_REVIEW" }); },
    useHintOne: () => { dispatch({ type: "USE_HINT_ONE" }); },
    toggleHintTwo: () => { dispatch({ type: "TOGGLE_HINT_TWO" }); },
    uploadDraft,
    confirmDraft: () => { dispatch({ type: "OCR_STATE", state: "CONFIRMED" }); },
    nextQuestion: () => { dispatch({ type: "NEXT_QUESTION" }); },
    openQuestionThree: () => { dispatch({ type: "OPEN_QUESTION_THREE" }); },
    openQuestionFour: () => { dispatch({ type: "OPEN_QUESTION_FOUR" }); },
    previousQuestion: () => { dispatch({ type: "PREVIOUS_QUESTION" }); },
  };
}
