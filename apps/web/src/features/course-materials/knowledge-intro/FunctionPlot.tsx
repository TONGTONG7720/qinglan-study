import { useId, useMemo } from "react";

import type { FunctionPoint } from "./types";

export interface FunctionPlotProps {
  readonly formula: string;
  readonly points?: readonly FunctionPoint[];
  readonly config?: {
    readonly a: number;
    readonly h: number;
    readonly k: number;
    readonly xMin: number;
    readonly xMax: number;
    readonly yMin: number;
    readonly yMax: number;
  };
  readonly accessibleDescription?: string;
  readonly className?: string;
  readonly showCaption?: boolean;
}

const width = 360;
const height = 196;
const inset = { top: 16, right: 20, bottom: 30, left: 34 } as const;
const xMin = -2.4;
const xMax = 2.4;
const yMin = -0.6;
const yMax = 4.8;

interface PlotDomain {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

function projectX(value: number, domain: PlotDomain): number {
  return inset.left + ((value - domain.xMin) / (domain.xMax - domain.xMin)) * (width - inset.left - inset.right);
}

function projectY(value: number, domain: PlotDomain): number {
  return inset.top + ((domain.yMax - value) / (domain.yMax - domain.yMin)) * (height - inset.top - inset.bottom);
}

function parabolaPath(
  domain: PlotDomain,
  definition: { readonly a: number; readonly h: number; readonly k: number },
  sampleCount: number,
): string {
  const samples = Array.from(
    { length: sampleCount },
    (_, index) => domain.xMin + (index / (sampleCount - 1)) * (domain.xMax - domain.xMin),
  );
  return samples
    .map((x, index) => {
      const y = definition.a * (x - definition.h) ** 2 + definition.k;
      return `${index === 0 ? "M" : "L"} ${projectX(x, domain).toFixed(2)} ${projectY(y, domain).toFixed(2)}`;
    })
    .join(" ");
}

export function FunctionPlot({
  formula,
  points = [],
  config,
  accessibleDescription,
  className,
  showCaption = true,
}: FunctionPlotProps) {
  const id = useId().replaceAll(":", "");
  const { domain, path } = useMemo(() => {
    const nextDomain = config ?? { xMin, xMax, yMin, yMax };
    const nextDefinition = config ?? { a: 1, h: 0, k: 0 };
    return {
      domain: nextDomain,
      path: parabolaPath(nextDomain, nextDefinition, config === undefined ? 49 : 97),
    };
  }, [config]);
  const xTicks = config === undefined
    ? [-2, -1, 0, 1, 2]
    : Array.from({ length: 7 }, (_, index) => index - 3);
  const yTicks = config === undefined
    ? []
    : Array.from({ length: 8 }, (_, index) => index - 3).filter((tick) => tick !== 0);
  const description = accessibleDescription ??
    `函数 ${formula} 的图像是一条开口向上的抛物线，经过横坐标负二到二的五个描点。`;
  const titleId = `function-plot-title-${id}`;
  const descriptionId = `function-plot-description-${id}`;

  return (
    <figure className={["function-plot", className].filter(Boolean).join(" ")} data-od-id="knowledge-function-plot">
      {showCaption ? <figcaption>示例函数图像 · {formula}</figcaption> : null}
      <svg
        aria-labelledby={`${titleId} ${descriptionId}`}
        className="function-plot-svg"
        role="img"
        viewBox={`0 0 ${String(width)} ${String(height)}`}
      >
        <title id={titleId}>{formula} 的函数图像</title>
        <desc id={descriptionId}>{description}</desc>
        <line className="plot-axis" x1={projectX(domain.xMin, domain)} x2={projectX(domain.xMax, domain)} y1={projectY(0, domain)} y2={projectY(0, domain)} />
        <line className="plot-axis" x1={projectX(0, domain)} x2={projectX(0, domain)} y1={projectY(domain.yMin, domain)} y2={projectY(domain.yMax, domain)} />
        {xTicks.map((tick) => (
          <g key={tick}>
            <line
              className="plot-tick"
              x1={projectX(tick, domain)}
              x2={projectX(tick, domain)}
              y1={projectY(0, domain) - 3}
              y2={projectY(0, domain) + 3}
            />
            <text className="plot-label" textAnchor="middle" x={projectX(tick, domain)} y={projectY(0, domain) + 18}>
              {tick}
            </text>
          </g>
        ))}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="plot-tick"
              x1={projectX(0, domain) - 3}
              x2={projectX(0, domain) + 3}
              y1={projectY(tick, domain)}
              y2={projectY(tick, domain)}
            />
            <text className="plot-label" textAnchor="end" x={projectX(0, domain) - 8} y={projectY(tick, domain) + 4}>
              {tick}
            </text>
          </g>
        ))}
        {config === undefined ? null : (
          <line
            className="plot-symmetry-axis"
            x1={projectX(config.h, domain)}
            x2={projectX(config.h, domain)}
            y1={projectY(domain.yMin, domain)}
            y2={projectY(domain.yMax, domain)}
          />
        )}
        <path className="plot-curve" d={path} />
        {points.map((point) => (
          <circle
            className="plot-point"
            cx={projectX(point.x, domain)}
            cy={projectY(point.y, domain)}
            key={`${String(point.x)}-${String(point.y)}`}
            r="3.5"
          />
        ))}
        {config === undefined ? null : <>
          <circle className="plot-vertex" cx={projectX(config.h, domain)} cy={projectY(config.k, domain)} r="4" />
          <text className="plot-vertex-label" x={projectX(config.h, domain) + 8} y={projectY(config.k, domain) - 8}>
            ({config.h},{config.k})
          </text>
        </>}
        <text className="plot-axis-label" x={projectX(domain.xMax, domain) - 5} y={projectY(0, domain) - 8}>x</text>
        <text className="plot-axis-label" x={projectX(0, domain) + 8} y={projectY(domain.yMax, domain) + 12}>y</text>
      </svg>
    </figure>
  );
}

export function FunctionValueTable({ formula, points = [] }: FunctionPlotProps) {
  return (
    <div className="function-value-table" data-od-id="knowledge-function-table">
      <h3>函数值表 · {formula}</h3>
      <table>
        <caption className="sr-only">函数 {formula} 在横坐标负二到二时的函数值</caption>
        <tbody>
          <tr>
            <th scope="row">x</th>
            {points.map((point) => <td key={`x-${String(point.x)}`}>{point.x}</td>)}
          </tr>
          <tr>
            <th scope="row">y</th>
            {points.map((point) => <td key={`y-${String(point.x)}`}>{point.y}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
