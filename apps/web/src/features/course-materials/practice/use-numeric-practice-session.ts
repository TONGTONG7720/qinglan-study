import { useEffect, useReducer, useRef } from "react";

import { classifyNumericInput, isEquivalentNumericAnswer, parseNumericAnswer } from "./numeric-answer";
import type { NumericPracticeQuestion, NumericPracticeSessionState } from "./types";

type NumericPracticeAction =
  | { readonly type: "SET_CALCULATION"; readonly value: string; readonly limit: number }
  | { readonly type: "SET_ANSWER"; readonly value: string }
  | { readonly type: "COMPOSITION_START" }
  | { readonly type: "COMPOSITION_END"; readonly value: string }
  | { readonly type: "SUBMIT_START" }
  | { readonly type: "SUBMIT_RESULT"; readonly correct: boolean }
  | { readonly type: "TOGGLE_HINT_ONE" }
  | { readonly type: "TOGGLE_HINT_TWO" };

const initialState: NumericPracticeSessionState = {
  calculationDraft: "",
  calculationLimitExceeded: false,
  answerInput: "",
  normalizedAnswer: null,
  inputState: "EMPTY",
  submitPhase: "IDLE",
  attemptCount: 0,
  hadIncorrectAttempt: false,
  hintOneUsed: false,
  hintOneOpen: false,
  hintTwoOpen: false,
  isComposing: false,
};

function reducer(state: NumericPracticeSessionState, action: NumericPracticeAction): NumericPracticeSessionState {
  switch (action.type) {
    case "SET_CALCULATION":
      if (action.value.length > action.limit) return { ...state, calculationLimitExceeded: true };
      return { ...state, calculationDraft: action.value, calculationLimitExceeded: false };
    case "SET_ANSWER":
      return {
        ...state,
        answerInput: action.value,
        normalizedAnswer: state.isComposing ? null : parseNumericAnswer(action.value),
        inputState: state.isComposing ? "TYPING_INCOMPLETE" : classifyNumericInput(action.value),
        submitPhase: state.submitPhase === "INCORRECT_RETRYABLE" ? "IDLE" : state.submitPhase,
      };
    case "COMPOSITION_START":
      return { ...state, isComposing: true, inputState: "TYPING_INCOMPLETE", normalizedAnswer: null };
    case "COMPOSITION_END":
      return {
        ...state,
        isComposing: false,
        answerInput: action.value,
        inputState: classifyNumericInput(action.value),
        normalizedAnswer: parseNumericAnswer(action.value),
      };
    case "SUBMIT_START":
      return state.inputState === "VALID_READY" && state.submitPhase !== "CHECKING"
        ? { ...state, submitPhase: "CHECKING" }
        : state;
    case "SUBMIT_RESULT":
      return {
        ...state,
        attemptCount: state.attemptCount + 1,
        hadIncorrectAttempt: state.hadIncorrectAttempt || !action.correct,
        hintTwoOpen: false,
        submitPhase: action.correct ? "CORRECT" : "INCORRECT_RETRYABLE",
      };
    case "TOGGLE_HINT_ONE":
      return { ...state, hintOneUsed: true, hintOneOpen: !state.hintOneOpen };
    case "TOGGLE_HINT_TWO":
      return state.hintOneUsed && state.hadIncorrectAttempt
        ? { ...state, hintTwoOpen: !state.hintTwoOpen }
        : state;
  }
}

export function useNumericPracticeSession(question: NumericPracticeQuestion) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const submitTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (submitTimeoutRef.current !== null) window.clearTimeout(submitTimeoutRef.current);
    },
    [],
  );

  const hintTwoUnlocked = state.hintOneUsed && state.hadIncorrectAttempt;
  const submitEnabled =
    state.inputState === "VALID_READY" &&
    state.submitPhase !== "CHECKING" &&
    state.submitPhase !== "CORRECT" &&
    !state.isComposing;

  function submit(): void {
    if (!submitEnabled) return;
    const answerInput = state.answerInput;
    dispatch({ type: "SUBMIT_START" });
    submitTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "SUBMIT_RESULT", correct: isEquivalentNumericAnswer(answerInput, question.answerKey) });
      submitTimeoutRef.current = null;
    }, 220);
  }

  return {
    state,
    submitEnabled,
    hintTwoUnlocked,
    hasUnsubmittedInput:
      state.submitPhase !== "CORRECT" &&
      (state.answerInput.trim().length > 0 || state.calculationDraft.trim().length > 0),
    setCalculationDraft: (value: string) => {
      dispatch({ type: "SET_CALCULATION", value, limit: question.calculationCharacterLimit });
    },
    setAnswerInput: (value: string) => { dispatch({ type: "SET_ANSWER", value }); },
    startComposition: () => { dispatch({ type: "COMPOSITION_START" }); },
    endComposition: (value: string) => { dispatch({ type: "COMPOSITION_END", value }); },
    submit,
    useHintOne: () => { dispatch({ type: "TOGGLE_HINT_ONE" }); },
    toggleHintTwo: () => { dispatch({ type: "TOGGLE_HINT_TWO" }); },
  };
}
