import { useEffect, useReducer, useRef } from "react";

import type {
  CoordinatePlotPracticeQuestion,
  CoordinatePlotSessionState,
  CoordinatePlotTool,
  PlotPoint,
} from "./types";

export type CoordinatePlotAction =
  | { readonly type: "SET_TOOL"; readonly tool: CoordinatePlotTool }
  | { readonly type: "ADD_POINT"; readonly x: number; readonly y: number; readonly requiredPointCount: number }
  | { readonly type: "SELECT_POINT"; readonly pointId: string | null }
  | { readonly type: "MOVE_POINT"; readonly pointId: string; readonly x: number; readonly y: number; readonly requiredPointCount: number }
  | { readonly type: "DELETE_POINT"; readonly pointId: string; readonly requiredPointCount: number }
  | { readonly type: "UNDO"; readonly requiredPointCount: number }
  | { readonly type: "REQUEST_CLEAR" }
  | { readonly type: "CANCEL_CLEAR" }
  | { readonly type: "CONFIRM_CLEAR" }
  | { readonly type: "CONNECT_CURVE"; readonly requiredPointCount: number }
  | { readonly type: "SUBMIT_START" }
  | { readonly type: "SUBMIT_UNAVAILABLE" }
  | { readonly type: "TOGGLE_REVIEW" }
  | { readonly type: "TOGGLE_HINT_ONE" }
  | { readonly type: "TOGGLE_HINT_TWO" };

interface CoordinatePlotInternalState extends CoordinatePlotSessionState {
  readonly nextPointSequence: number;
}

export const coordinatePlotInitialState: CoordinatePlotInternalState = {
  phase: "EDITING_POINTS",
  activeTool: "ADD",
  points: [],
  selectedPointId: null,
  curveConnected: false,
  undoStack: [],
  markedForReview: false,
  hintOneUsed: false,
  hintOneOpen: false,
  hintTwoOpen: false,
  clearConfirmationOpen: false,
  submitError: null,
  nextPointSequence: 1,
};

function phaseFor(points: readonly PlotPoint[], requiredPointCount: number): "EDITING_POINTS" | "CURVE_READY" {
  return points.length === requiredPointCount ? "CURVE_READY" : "EDITING_POINTS";
}

function withPointChange(
  state: CoordinatePlotInternalState,
  points: readonly PlotPoint[],
  requiredPointCount: number,
  selectedPointId: string | null,
): CoordinatePlotInternalState {
  return {
    ...state,
    phase: phaseFor(points, requiredPointCount),
    points,
    selectedPointId,
    curveConnected: false,
    undoStack: [...state.undoStack, state.points],
    submitError: null,
  };
}

export function coordinatePlotReducer(
  state: CoordinatePlotInternalState,
  action: CoordinatePlotAction,
): CoordinatePlotInternalState {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, activeTool: action.tool, selectedPointId: null };
    case "ADD_POINT": {
      if (state.activeTool !== "ADD" || state.points.length >= action.requiredPointCount) return state;
      if (state.points.some((point) => point.x === action.x && point.y === action.y)) return state;
      const point: PlotPoint = { id: `plot-point-${String(state.nextPointSequence)}`, x: action.x, y: action.y };
      return {
        ...withPointChange(state, [...state.points, point], action.requiredPointCount, point.id),
        nextPointSequence: state.nextPointSequence + 1,
      };
    }
    case "SELECT_POINT":
      return { ...state, selectedPointId: action.pointId };
    case "MOVE_POINT": {
      const point = state.points.find((candidate) => candidate.id === action.pointId);
      if (point === undefined || (point.x === action.x && point.y === action.y)) return state;
      if (state.points.some((candidate) => candidate.id !== action.pointId && candidate.x === action.x && candidate.y === action.y)) return state;
      const points = state.points.map((candidate) => candidate.id === action.pointId ? { ...candidate, x: action.x, y: action.y } : candidate);
      return withPointChange(state, points, action.requiredPointCount, action.pointId);
    }
    case "DELETE_POINT": {
      if (!state.points.some((point) => point.id === action.pointId)) return state;
      const points = state.points.filter((point) => point.id !== action.pointId);
      return withPointChange(state, points, action.requiredPointCount, null);
    }
    case "UNDO": {
      const previous = state.undoStack.at(-1);
      if (previous === undefined) return state;
      return {
        ...state,
        phase: phaseFor(previous, action.requiredPointCount),
        points: previous,
        selectedPointId: null,
        curveConnected: false,
        undoStack: state.undoStack.slice(0, -1),
        clearConfirmationOpen: false,
        submitError: null,
      };
    }
    case "REQUEST_CLEAR":
      return state.points.length === 0 ? state : { ...state, clearConfirmationOpen: true };
    case "CANCEL_CLEAR":
      return { ...state, clearConfirmationOpen: false };
    case "CONFIRM_CLEAR":
      return state.points.length === 0
        ? { ...state, clearConfirmationOpen: false }
        : {
            ...withPointChange(state, [], Number.POSITIVE_INFINITY, null),
            phase: "EDITING_POINTS",
            clearConfirmationOpen: false,
          };
    case "CONNECT_CURVE":
      return state.points.length === action.requiredPointCount && state.phase === "CURVE_READY"
        ? { ...state, phase: "CURVE_CONNECTED", curveConnected: true, selectedPointId: null }
        : state;
    case "SUBMIT_START":
      return state.curveConnected && state.phase === "CURVE_CONNECTED"
        ? { ...state, phase: "SUBMITTING", submitError: null }
        : state;
    case "SUBMIT_UNAVAILABLE":
      return state.phase === "SUBMITTING"
        ? { ...state, phase: "SERVICE_UNAVAILABLE", submitError: "作图提交服务尚未接入；你的本地点位与曲线已保留。" }
        : state;
    case "TOGGLE_REVIEW":
      return { ...state, markedForReview: !state.markedForReview };
    case "TOGGLE_HINT_ONE":
      return { ...state, hintOneUsed: true, hintOneOpen: !state.hintOneOpen };
    case "TOGGLE_HINT_TWO":
      return state.hintOneUsed ? { ...state, hintTwoOpen: !state.hintTwoOpen } : state;
  }
}

export function useCoordinatePlotSession(question: CoordinatePlotPracticeQuestion) {
  const [state, dispatch] = useReducer(coordinatePlotReducer, coordinatePlotInitialState);
  const submitTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (submitTimeoutRef.current !== null) window.clearTimeout(submitTimeoutRef.current);
  }, []);

  const canAdd = state.points.length < question.requiredPointCount;
  const canMove = state.points.length > 0;
  const canDelete = state.points.length > 0;
  const canUndo = state.undoStack.length > 0;
  const canClear = state.points.length > 0;
  const canConnect = state.phase === "CURVE_READY" && state.points.length === question.requiredPointCount;
  const canSubmit = state.curveConnected && state.phase !== "SUBMITTING";

  function submit(): void {
    if (!canSubmit) return;
    dispatch({ type: "SUBMIT_START" });
    submitTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "SUBMIT_UNAVAILABLE" });
      submitTimeoutRef.current = null;
    }, 220);
  }

  return {
    state,
    canAdd,
    canMove,
    canDelete,
    canUndo,
    canClear,
    canConnect,
    canSubmit,
    hasUnsubmittedWork: state.points.length > 0,
    setTool: (tool: CoordinatePlotTool) => { dispatch({ type: "SET_TOOL", tool }); },
    addPoint: (x: number, y: number) => { dispatch({ type: "ADD_POINT", x, y, requiredPointCount: question.requiredPointCount }); },
    selectPoint: (pointId: string | null) => { dispatch({ type: "SELECT_POINT", pointId }); },
    movePoint: (pointId: string, x: number, y: number) => { dispatch({ type: "MOVE_POINT", pointId, x, y, requiredPointCount: question.requiredPointCount }); },
    deletePoint: (pointId: string) => { dispatch({ type: "DELETE_POINT", pointId, requiredPointCount: question.requiredPointCount }); },
    undo: () => { dispatch({ type: "UNDO", requiredPointCount: question.requiredPointCount }); },
    requestClear: () => { dispatch({ type: "REQUEST_CLEAR" }); },
    cancelClear: () => { dispatch({ type: "CANCEL_CLEAR" }); },
    confirmClear: () => { dispatch({ type: "CONFIRM_CLEAR" }); },
    connectCurve: () => { dispatch({ type: "CONNECT_CURVE", requiredPointCount: question.requiredPointCount }); },
    submit,
    toggleReview: () => { dispatch({ type: "TOGGLE_REVIEW" }); },
    useHintOne: () => { dispatch({ type: "TOGGLE_HINT_ONE" }); },
    toggleHintTwo: () => { dispatch({ type: "TOGGLE_HINT_TWO" }); },
  };
}
