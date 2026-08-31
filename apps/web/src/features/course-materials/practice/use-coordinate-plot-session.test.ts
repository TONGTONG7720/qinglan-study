import { describe, expect, it } from "vitest";

import { coordinatePlotInitialState, coordinatePlotReducer } from "./use-coordinate-plot-session";

function addPoint(state: typeof coordinatePlotInitialState, x: number, y: number) {
  return coordinatePlotReducer(state, { type: "ADD_POINT", x, y, requiredPointCount: 5 });
}

describe("coordinate plot reducer", () => {
  it("starts empty and blocks duplicate or sixth points", () => {
    let state = coordinatePlotInitialState;
    expect(state.phase).toBe("EDITING_POINTS");
    expect(state.points).toHaveLength(0);
    state = addPoint(state, -1, 0);
    state = addPoint(state, -1, 0);
    expect(state.points).toHaveLength(1);
    state = addPoint(state, 0, -3);
    state = addPoint(state, 1, -4);
    state = addPoint(state, 2, -3);
    state = addPoint(state, 3, 0);
    expect(state.phase).toBe("CURVE_READY");
    state = addPoint(state, 4, 1);
    expect(state.points).toHaveLength(5);
  });

  it("moves, deletes and undoes complete point states", () => {
    let state = addPoint(coordinatePlotInitialState, 0, 0);
    const point = state.points[0];
    if (point === undefined) throw new Error("Expected a point");
    state = coordinatePlotReducer(state, { type: "MOVE_POINT", pointId: point.id, x: 1, y: 1, requiredPointCount: 5 });
    expect(state.points[0]).toMatchObject({ x: 1, y: 1 });
    state = coordinatePlotReducer(state, { type: "DELETE_POINT", pointId: point.id, requiredPointCount: 5 });
    expect(state.points).toHaveLength(0);
    state = coordinatePlotReducer(state, { type: "UNDO", requiredPointCount: 5 });
    expect(state.points[0]).toMatchObject({ x: 1, y: 1 });
  });

  it("invalidates a connected curve after a point changes", () => {
    let state = coordinatePlotInitialState;
    for (const [x, y] of [[-1, 0], [0, -3], [1, -4], [2, -3], [3, 0]] as const) state = addPoint(state, x, y);
    state = coordinatePlotReducer(state, { type: "CONNECT_CURVE", requiredPointCount: 5 });
    expect(state.phase).toBe("CURVE_CONNECTED");
    expect(state.curveConnected).toBe(true);
    const point = state.points[0];
    if (point === undefined) throw new Error("Expected a point");
    state = coordinatePlotReducer(state, { type: "MOVE_POINT", pointId: point.id, x: -2, y: 0, requiredPointCount: 5 });
    expect(state.phase).toBe("CURVE_READY");
    expect(state.curveConnected).toBe(false);
  });

  it("clears with confirmation and makes the clear operation undoable", () => {
    let state = addPoint(coordinatePlotInitialState, 0, 0);
    state = coordinatePlotReducer(state, { type: "REQUEST_CLEAR" });
    expect(state.clearConfirmationOpen).toBe(true);
    state = coordinatePlotReducer(state, { type: "CONFIRM_CLEAR" });
    expect(state.points).toHaveLength(0);
    state = coordinatePlotReducer(state, { type: "UNDO", requiredPointCount: 5 });
    expect(state.points).toHaveLength(1);
  });

  it("blocks repeat submit and preserves the student curve when the service is unavailable", () => {
    let state = coordinatePlotInitialState;
    for (const [x, y] of [[-1, 0], [0, -3], [1, -4], [2, -3], [3, 0]] as const) state = addPoint(state, x, y);
    state = coordinatePlotReducer(state, { type: "CONNECT_CURVE", requiredPointCount: 5 });
    state = coordinatePlotReducer(state, { type: "SUBMIT_START" });
    const duplicate = coordinatePlotReducer(state, { type: "SUBMIT_START" });
    expect(duplicate).toEqual(state);
    state = coordinatePlotReducer(state, { type: "SUBMIT_UNAVAILABLE" });
    expect(state.phase).toBe("SERVICE_UNAVAILABLE");
    expect(state.points).toHaveLength(5);
    expect(state.curveConnected).toBe(true);
  });
});
