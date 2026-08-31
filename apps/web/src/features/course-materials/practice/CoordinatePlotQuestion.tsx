import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import type { CoordinatePlotPracticeQuestion, PlotPoint } from "./types";
import type { useCoordinatePlotSession } from "./use-coordinate-plot-session";
import "./coordinate-plot.css";

const cellSize = 44;
const plotInset = { top: 24, right: 24, bottom: 44, left: 52 } as const;

interface Projector {
  readonly width: number;
  readonly height: number;
  readonly x: (value: number) => number;
  readonly y: (value: number) => number;
}

function createProjector(question: CoordinatePlotPracticeQuestion): Projector {
  const plotWidth = (question.axis.xMax - question.axis.xMin) * cellSize;
  const plotHeight = (question.axis.yMax - question.axis.yMin) * cellSize;
  return {
    width: plotInset.left + plotWidth + plotInset.right,
    height: plotInset.top + plotHeight + plotInset.bottom,
    x: (value) => plotInset.left + (value - question.axis.xMin) * cellSize,
    y: (value) => plotInset.top + (question.axis.yMax - value) * cellSize,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothPath(points: readonly PlotPoint[], projector: Projector): string {
  const ordered = [...points].sort((left, right) => left.x - right.x);
  const first = ordered[0];
  if (first === undefined) return "";
  if (ordered.length === 1) return `M ${String(projector.x(first.x))} ${String(projector.y(first.y))}`;
  const projected = ordered.map((point) => ({ x: projector.x(point.x), y: projector.y(point.y) }));
  let path = `M ${String(projected[0]?.x ?? 0)} ${String(projected[0]?.y ?? 0)}`;
  for (let index = 0; index < projected.length - 1; index += 1) {
    const current = projected[index];
    const next = projected[index + 1];
    if (current === undefined || next === undefined) continue;
    const previous = projected[index - 1] ?? current;
    const afterNext = projected[index + 2] ?? next;
    const controlOneX = current.x + (next.x - previous.x) / 6;
    const controlOneY = current.y + (next.y - previous.y) / 6;
    const controlTwoX = next.x - (afterNext.x - current.x) / 6;
    const controlTwoY = next.y - (afterNext.y - current.y) / 6;
    path += ` C ${controlOneX.toFixed(2)} ${controlOneY.toFixed(2)}, ${controlTwoX.toFixed(2)} ${controlTwoY.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
}

function ValueTable({ question }: { readonly question: CoordinatePlotPracticeQuestion }) {
  return (
    <div className="coordinate-value-table" data-od-id="practice-coordinate-value-table">
      <table>
        <caption className="sr-only">函数 {question.functionExpression} 的只读值表</caption>
        <tbody>
          <tr>
            <th scope="row">x</th>
            {question.valueTable.map((value) => <td key={`x-${String(value.x)}`}>{value.x}</td>)}
          </tr>
          <tr>
            <th scope="row">y</th>
            {question.valueTable.map((value) => <td key={`y-${String(value.x)}`}>{value.y}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface CoordinateGridProps {
  readonly question: CoordinatePlotPracticeQuestion;
  readonly session: ReturnType<typeof useCoordinatePlotSession>;
  readonly onAnnounce: (message: string) => void;
}

function CoordinateGrid({ question, session, onAnnounce }: CoordinateGridProps) {
  const projector = useMemo(() => createProjector(question), [question]);
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<number | null>(null);
  const [dragPoint, setDragPoint] = useState<PlotPoint | null>(null);
  const [keyboardCoordinate, setKeyboardCoordinate] = useState({ x: 0, y: 0 });
  const [keyboardCursorVisible, setKeyboardCursorVisible] = useState(false);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  function pointerCoordinate(event: ReactPointerEvent<SVGSVGElement>): { readonly x: number; readonly y: number } {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * projector.width;
    const localY = ((event.clientY - bounds.top) / bounds.height) * projector.height;
    const x = clamp(Math.round(question.axis.xMin + (localX - plotInset.left) / cellSize), question.axis.xMin, question.axis.xMax);
    const y = clamp(Math.round(question.axis.yMax - (localY - plotInset.top) / cellSize), question.axis.yMin, question.axis.yMax);
    return { x, y };
  }

  function handleGridPointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (event.target !== event.currentTarget && (event.target as Element).closest(".coordinate-point") !== null) return;
    if (session.state.activeTool !== "ADD" || !session.canAdd) return;
    const coordinate = pointerCoordinate(event);
    session.addPoint(coordinate.x, coordinate.y);
    onAnnounce(`已添加点 ${String(coordinate.x)}，${String(coordinate.y)}。`);
  }

  function handlePointPointerDown(event: ReactPointerEvent<SVGCircleElement>, point: PlotPoint): void {
    event.stopPropagation();
    session.selectPoint(point.id);
    if (session.state.activeTool === "DELETE") {
      session.deletePoint(point.id);
      onAnnounce(`已删除点 ${String(point.x)}，${String(point.y)}。`);
      return;
    }
    if (session.state.activeTool !== "MOVE") return;
    svgRef.current?.setPointerCapture(event.pointerId);
    setDragPoint(point);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (dragPoint === null || session.state.activeTool !== "MOVE") return;
    const coordinate = pointerCoordinate(event);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      setDragPoint({ ...dragPoint, x: coordinate.x, y: coordinate.y });
      frameRef.current = null;
    });
  }

  function finishDrag(event: ReactPointerEvent<SVGSVGElement>): void {
    if (dragPoint === null) return;
    if (svgRef.current?.hasPointerCapture(event.pointerId) === true) svgRef.current.releasePointerCapture(event.pointerId);
    session.movePoint(dragPoint.id, dragPoint.x, dragPoint.y);
    onAnnounce(`点已移动到 ${String(dragPoint.x)}，${String(dragPoint.y)}。`);
    setDragPoint(null);
  }

  function handleGridKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    const selected = session.state.points.find((point) => point.id === session.state.selectedPointId);
    const delta = event.key === "ArrowLeft" ? { x: -1, y: 0 }
      : event.key === "ArrowRight" ? { x: 1, y: 0 }
        : event.key === "ArrowUp" ? { x: 0, y: 1 }
          : event.key === "ArrowDown" ? { x: 0, y: -1 }
            : null;
    if (delta !== null) {
      event.preventDefault();
      if (session.state.activeTool === "MOVE" && selected !== undefined) {
        const x = clamp(selected.x + delta.x, question.axis.xMin, question.axis.xMax);
        const y = clamp(selected.y + delta.y, question.axis.yMin, question.axis.yMax);
        session.movePoint(selected.id, x, y);
        onAnnounce(`点已移动到 ${String(x)}，${String(y)}。`);
      } else {
        setKeyboardCursorVisible(true);
        setKeyboardCoordinate((coordinate) => ({
          x: clamp(coordinate.x + delta.x, question.axis.xMin, question.axis.xMax),
          y: clamp(coordinate.y + delta.y, question.axis.yMin, question.axis.yMax),
        }));
      }
      return;
    }
    if (event.key === "Enter" && session.state.activeTool === "ADD" && session.canAdd) {
      event.preventDefault();
      session.addPoint(keyboardCoordinate.x, keyboardCoordinate.y);
      onAnnounce(`已添加点 ${String(keyboardCoordinate.x)}，${String(keyboardCoordinate.y)}。`);
    } else if ((event.key === "Delete" || event.key === "Backspace") && selected !== undefined) {
      event.preventDefault();
      session.deletePoint(selected.id);
      onAnnounce(`已删除点 ${String(selected.x)}，${String(selected.y)}。`);
    } else if (event.key === "Escape") {
      session.selectPoint(null);
      setKeyboardCursorVisible(false);
    }
  }

  const xTicks = Array.from({ length: question.axis.xMax - question.axis.xMin + 1 }, (_, index) => question.axis.xMin + index);
  const yTicks = Array.from({ length: question.axis.yMax - question.axis.yMin + 1 }, (_, index) => question.axis.yMin + index);
  const visiblePoints = session.state.points.map((point) => dragPoint?.id === point.id ? dragPoint : point);
  const path = session.state.curveConnected ? smoothPath(visiblePoints, projector) : "";

  return (
    <div className="coordinate-grid-wrap">
      <svg
        aria-label={`空白直角坐标系，横轴从 ${String(question.axis.xMin)} 到 ${String(question.axis.xMax)}，纵轴从 ${String(question.axis.yMin)} 到 ${String(question.axis.yMax)}。当前已有 ${String(session.state.points.length)} 个学生点位。`}
        className={`coordinate-grid is-tool-${session.state.activeTool.toLowerCase()}`}
        data-od-id="practice-coordinate-grid"
        onKeyDown={handleGridKeyDown}
        onPointerDown={handleGridPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        ref={svgRef}
        role="application"
        tabIndex={0}
        viewBox={`0 0 ${String(projector.width)} ${String(projector.height)}`}
      >
        <defs>
          <marker id="coordinate-axis-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="5" refY="3" viewBox="0 0 6 6">
            <path className="coordinate-axis-arrow" d="M 0 0 L 6 3 L 0 6 Z" />
          </marker>
        </defs>
        {xTicks.map((tick) => <line className="coordinate-grid-line" key={`grid-x-${String(tick)}`} x1={projector.x(tick)} x2={projector.x(tick)} y1={projector.y(question.axis.yMin)} y2={projector.y(question.axis.yMax)} />)}
        {yTicks.map((tick) => <line className="coordinate-grid-line" key={`grid-y-${String(tick)}`} x1={projector.x(question.axis.xMin)} x2={projector.x(question.axis.xMax)} y1={projector.y(tick)} y2={projector.y(tick)} />)}
        <line className="coordinate-axis" markerEnd="url(#coordinate-axis-arrow)" x1={projector.x(question.axis.xMin)} x2={projector.x(question.axis.xMax) + 12} y1={projector.y(0)} y2={projector.y(0)} />
        <line className="coordinate-axis" markerEnd="url(#coordinate-axis-arrow)" x1={projector.x(0)} x2={projector.x(0)} y1={projector.y(question.axis.yMin)} y2={projector.y(question.axis.yMax) - 12} />
        {xTicks.filter((tick) => tick !== 0).map((tick) => <g key={`tick-x-${String(tick)}`}><line className="coordinate-tick" x1={projector.x(tick)} x2={projector.x(tick)} y1={projector.y(0) - 4} y2={projector.y(0) + 4} /><text className="coordinate-tick-label" textAnchor="middle" x={projector.x(tick)} y={projector.y(0) + 20}>{tick}</text></g>)}
        {yTicks.filter((tick) => tick !== 0).map((tick) => <g key={`tick-y-${String(tick)}`}><line className="coordinate-tick" x1={projector.x(0) - 4} x2={projector.x(0) + 4} y1={projector.y(tick)} y2={projector.y(tick)} /><text className="coordinate-tick-label" textAnchor="end" x={projector.x(0) - 10} y={projector.y(tick) + 4}>{tick}</text></g>)}
        <text className="coordinate-origin-label" x={projector.x(0) - 18} y={projector.y(0) + 20}>O</text>
        <text className="coordinate-axis-label" x={projector.x(question.axis.xMax) + 14} y={projector.y(0) + 18}>x</text>
        <text className="coordinate-axis-label" x={projector.x(0) - 18} y={projector.y(question.axis.yMax) - 8}>y</text>
        {path === "" ? null : <path className="coordinate-student-curve" d={path} />}
        {keyboardCursorVisible && session.state.activeTool === "ADD" ? <circle className="coordinate-keyboard-cursor" cx={projector.x(keyboardCoordinate.x)} cy={projector.y(keyboardCoordinate.y)} r="8" /> : null}
        {visiblePoints.map((point) => (
          <circle
            aria-label={`点 ${String(point.x)}，${String(point.y)}${point.id === session.state.selectedPointId ? "，已选中" : ""}`}
            className={`coordinate-point${point.id === session.state.selectedPointId ? " is-selected" : ""}`}
            cx={projector.x(point.x)}
            cy={projector.y(point.y)}
            key={point.id}
            onPointerDown={(event) => { handlePointPointerDown(event, point); }}
            r="6"
            role="button"
          />
        ))}
      </svg>
    </div>
  );
}

interface CoordinatePlotQuestionProps {
  readonly question: CoordinatePlotPracticeQuestion;
  readonly session: ReturnType<typeof useCoordinatePlotSession>;
}

export function CoordinatePlotQuestion({ question, session }: CoordinatePlotQuestionProps) {
  const [announcement, setAnnouncement] = useState("坐标网格为空，当前工具为添加点。");
  const [inputX, setInputX] = useState(0);
  const [inputY, setInputY] = useState(0);
  const selectedPoint = session.state.points.find((point) => point.id === session.state.selectedPointId);

  function addFromInputs(): void {
    const x = clamp(Math.round(inputX), question.axis.xMin, question.axis.xMax);
    const y = clamp(Math.round(inputY), question.axis.yMin, question.axis.yMax);
    session.addPoint(x, y);
    setAnnouncement(`已通过坐标输入添加点 ${String(x)}，${String(y)}。`);
  }

  return (
    <section className="practice-question coordinate-plot-question" data-od-id="practice-coordinate-plot-question" aria-labelledby="coordinate-plot-question-title">
      <h2 id="coordinate-plot-question-title">{question.stem}</h2>
      <p className="coordinate-plot-instruction">{question.instruction}</p>
      <ValueTable question={question} />
      <p className="coordinate-symmetry-note">成对检查：{question.symmetryNote}</p>

      <div className="coordinate-workspace">
        <aside className="coordinate-toolbar" aria-label="作图工具">
          <strong>已描点 {session.state.points.length} / {question.requiredPointCount}</strong>
          <div role="toolbar" aria-label="点位工具">
            <button aria-pressed={session.state.activeTool === "ADD"} className={session.state.activeTool === "ADD" ? "is-active" : ""} disabled={!session.canAdd} onClick={() => { session.setTool("ADD"); }} type="button">添加点</button>
            <button aria-pressed={session.state.activeTool === "MOVE"} className={session.state.activeTool === "MOVE" ? "is-active" : ""} disabled={!session.canMove} onClick={() => { session.setTool("MOVE"); }} type="button">移动点</button>
            <button aria-pressed={session.state.activeTool === "DELETE"} className={session.state.activeTool === "DELETE" ? "is-active" : ""} disabled={!session.canDelete} onClick={() => { session.setTool("DELETE"); }} type="button">删除点</button>
          </div>
          <div className="coordinate-history-actions">
            <button disabled={!session.canUndo} onClick={session.undo} type="button">撤销</button>
            <button aria-expanded={session.state.clearConfirmationOpen} disabled={!session.canClear} onClick={session.requestClear} type="button">清空</button>
            {session.state.clearConfirmationOpen ? (
              <div aria-label="清空全部点位？" className="coordinate-clear-popover" role="dialog">
                <p>清空全部点位？</p>
                <button onClick={session.cancelClear} type="button">取消</button>
                <button onClick={session.confirmClear} type="button">确认清空</button>
              </div>
            ) : null}
          </div>
          <button className="coordinate-connect-button" disabled={!session.canConnect} onClick={session.connectCurve} type="button">连接曲线</button>
          <p>在网格上单击添加；拖动可调整位置。</p>
          <output aria-live="polite">当前坐标：{selectedPoint === undefined ? "—" : `${String(selectedPoint.x)}, ${String(selectedPoint.y)}`}</output>
        </aside>

        <div className="coordinate-grid-column">
          <CoordinateGrid onAnnounce={setAnnouncement} question={question} session={session} />
          <details className="coordinate-accessible-alternative">
            <summary>键盘与坐标输入</summary>
            <form className="coordinate-input-alternative" onSubmit={(event) => { event.preventDefault(); addFromInputs(); }}>
              <fieldset>
                <legend>坐标输入替代方式</legend>
                <label>x<input max={question.axis.xMax} min={question.axis.xMin} onChange={(event) => { setInputX(Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : 0); }} step={question.snapStep} type="number" value={inputX} /></label>
                <label>y<input max={question.axis.yMax} min={question.axis.yMin} onChange={(event) => { setInputY(Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : 0); }} step={question.snapStep} type="number" value={inputY} /></label>
                <button disabled={!session.canAdd} type="submit">添加坐标点</button>
              </fieldset>
            </form>
            <div className="coordinate-point-list">
              <h3>已添加点位</h3>
              {session.state.points.length === 0 ? <p>尚未添加点位。</p> : (
                <ol>
                  {session.state.points.map((point) => (
                    <li key={point.id}>
                      <button aria-pressed={point.id === session.state.selectedPointId} onClick={() => { session.setTool("MOVE"); session.selectPoint(point.id); }} type="button">点（{point.x}, {point.y}）</button>
                      <button aria-label={`删除点 ${String(point.x)}，${String(point.y)}`} onClick={() => { session.deletePoint(point.id); }} type="button">删除</button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </details>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {session.state.submitError === null ? null : <div aria-live="assertive" className="coordinate-service-error" role="alert">{session.state.submitError}</div>}
    </section>
  );
}
