import { useEffect, useReducer, useRef } from "react";

import type {
  GraphPracticeQuestion,
  GraphPracticeSessionState,
  PracticeOptionId,
} from "./types";

type GraphPracticeAction =
  | { readonly type: "SELECT_OPTION"; readonly optionId: PracticeOptionId }
  | { readonly type: "SUBMIT_START" }
  | { readonly type: "SUBMIT_RESULT"; readonly correct: boolean }
  | { readonly type: "TOGGLE_REVIEW" }
  | { readonly type: "TOGGLE_HINT_ONE" }
  | { readonly type: "TOGGLE_HINT_TWO" };

const initialState: GraphPracticeSessionState = {
  selectedOptionId: null,
  submitPhase: "IDLE",
  attemptCount: 0,
  hadIncorrectAttempt: false,
  markedForReview: false,
  hintOneUsed: false,
  hintOneOpen: false,
  hintTwoOpen: false,
};

function reducer(state: GraphPracticeSessionState, action: GraphPracticeAction): GraphPracticeSessionState {
  switch (action.type) {
    case "SELECT_OPTION":
      if (state.submitPhase === "CHECKING" || state.submitPhase === "CORRECT") return state;
      return {
        ...state,
        selectedOptionId: action.optionId,
        submitPhase: "IDLE",
      };
    case "SUBMIT_START":
      return state.selectedOptionId === null || state.submitPhase === "CHECKING"
        ? state
        : { ...state, submitPhase: "CHECKING" };
    case "SUBMIT_RESULT":
      return {
        ...state,
        attemptCount: state.attemptCount + 1,
        hadIncorrectAttempt: state.hadIncorrectAttempt || !action.correct,
        hintTwoOpen: false,
        submitPhase: action.correct ? "CORRECT" : "INCORRECT_RETRYABLE",
      };
    case "TOGGLE_REVIEW":
      return { ...state, markedForReview: !state.markedForReview };
    case "TOGGLE_HINT_ONE":
      return { ...state, hintOneUsed: true, hintOneOpen: !state.hintOneOpen };
    case "TOGGLE_HINT_TWO":
      return state.hintOneUsed && state.hadIncorrectAttempt
        ? { ...state, hintTwoOpen: !state.hintTwoOpen }
        : state;
  }
}

export function useGraphPracticeSession(question: GraphPracticeQuestion) {
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
    state.selectedOptionId !== null &&
    state.submitPhase !== "CHECKING" &&
    state.submitPhase !== "CORRECT";

  function submit(): void {
    if (!submitEnabled) return;
    const selectedOptionId = state.selectedOptionId;
    dispatch({ type: "SUBMIT_START" });
    submitTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "SUBMIT_RESULT", correct: selectedOptionId === question.answerKey });
      submitTimeoutRef.current = null;
    }, 220);
  }

  return {
    state,
    submitEnabled,
    hintTwoUnlocked,
    hasUnsubmittedSelection:
      state.selectedOptionId !== null &&
      state.submitPhase !== "CHECKING" &&
      state.submitPhase !== "CORRECT",
    selectOption: (optionId: PracticeOptionId) => { dispatch({ type: "SELECT_OPTION", optionId }); },
    submit,
    toggleReview: () => { dispatch({ type: "TOGGLE_REVIEW" }); },
    useHintOne: () => { dispatch({ type: "TOGGLE_HINT_ONE" }); },
    toggleHintTwo: () => { dispatch({ type: "TOGGLE_HINT_TWO" }); },
  };
}
