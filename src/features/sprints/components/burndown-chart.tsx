"use client";

import { useId, useState } from "react";
import type { BurndownDayPoint } from "@/features/sprints/sprint-report-service";
import { cn } from "@/lib/cn";

export interface BurndownChartProps {
  points: BurndownDayPoint[];
  metric: "hours" | "issues";
}

export function BurndownChart({ points, metric }: BurndownChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradId = useId();

  if (!points || points.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-rule bg-panel/40 p-6 text-center">
        <p className="text-sm font-medium text-ink">No burndown data available.</p>
        <p className="mt-1 text-xs text-ink-soft">
          Ensure the sprint has configured start and end dates and contains tasks.
        </p>
      </div>
    );
  }

  // Dimensions
  const svgWidth = 800;
  const svgHeight = 340;
  const margin = { top: 25, right: 35, bottom: 45, left: 60 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  // Max value for Y scale
  const allValues: number[] = [];
  for (const p of points) {
    allValues.push(p.idealRemaining);
    if (p.actualRemaining !== null) allValues.push(p.actualRemaining);
    if (p.forecastRemaining !== null && p.forecastRemaining !== undefined) {
      allValues.push(p.forecastRemaining);
    }
  }
  const rawMax = Math.max(1, ...allValues);
  // Round up to nice number
  const yMax = metric === "hours" ? Math.ceil(rawMax / 5) * 5 || rawMax : Math.ceil(rawMax);

  const numTicks = 5;
  const yTicks = Array.from({ length: numTicks + 1 }, (_, i) => {
    const val = (yMax / numTicks) * i;
    return metric === "hours" ? Math.round(val * 10) / 10 : Math.round(val);
  });

  const getX = (index: number) => {
    if (points.length <= 1) return margin.left + innerWidth / 2;
    return margin.left + (index / (points.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return margin.top + (1 - val / yMax) * innerHeight;
  };

  // Build Ideal Path
  const idealPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.idealRemaining).toFixed(1)}`)
    .join(" ");

  // Build Actual Path (only for non-null points)
  const actualPoints = points
    .map((p, i) => ({ point: p, index: i }))
    .filter((item) => item.point.actualRemaining !== null);

  const actualPath = actualPoints
    .map((item, i) => `${i === 0 ? "M" : "L"} ${getX(item.index).toFixed(1)} ${getY(item.point.actualRemaining!).toFixed(1)}`)
    .join(" ");

  // Build Area Path under Actual line
  let actualAreaPath = "";
  if (actualPoints.length > 0) {
    const firstX = getX(actualPoints[0].index).toFixed(1);
    const lastX = getX(actualPoints[actualPoints.length - 1].index).toFixed(1);
    const bottomY = (margin.top + innerHeight).toFixed(1);
    actualAreaPath = `${actualPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }

  // Build Forecast Path
  const lastActual = actualPoints[actualPoints.length - 1];
  const forecastPoints = points
    .map((p, i) => ({ point: p, index: i }))
    .filter((item) => item.point.forecastRemaining !== null && item.point.forecastRemaining !== undefined);

  let forecastPath = "";
  if (lastActual && forecastPoints.length > 0) {
    forecastPath = `M ${getX(lastActual.index).toFixed(1)} ${getY(lastActual.point.actualRemaining!).toFixed(1)} ` +
      forecastPoints
        .map((item) => `L ${getX(item.index).toFixed(1)} ${getY(item.point.forecastRemaining!).toFixed(1)}`)
        .join(" ");
  }

  // Determine which X axis labels to show
  const step = points.length > 14 ? Math.ceil(points.length / 10) : 1;

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-ink-soft">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-0.5 w-4 border-b-2 border-dashed border-ink-faint" />
            <span className="text-ink-faint">Ideal</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-1 w-4 rounded-full bg-primary" />
            <span className="text-primary-ink">Actual Remaining</span>
          </span>
          {forecastPath ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="h-0.5 w-4 border-b-2 border-dotted border-purple-500" />
              <span className="text-purple-600 dark:text-purple-400">Forecast</span>
            </span>
          ) : null}
        </div>
        <span className="text-2xs text-ink-faint">
          Unit: {metric === "hours" ? "Hours (h)" : "Issues"}
        </span>
      </div>

      {/* SVG Container */}
      <div className="relative w-full overflow-hidden rounded-xl border border-rule bg-panel/60 p-2 shadow-2xs">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines & Y labels */}
          {yTicks.map((val, idx) => {
            const yPos = getY(val);
            return (
              <g key={`ytick-${val}-${idx}`} className="text-2xs text-ink-faint">
                <line
                  x1={margin.left}
                  y1={yPos}
                  x2={margin.left + innerWidth}
                  y2={yPos}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                  strokeDasharray="3 3"
                />
                <text
                  x={margin.left - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fill="currentColor"
                  className="font-mono text-[10px]"
                >
                  {val}
                  {metric === "hours" ? "h" : ""}
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {points.map((p, i) => {
            if (i % step !== 0 && i !== points.length - 1) return null;
            const xPos = getX(i);
            return (
              <text
                key={p.date}
                x={xPos}
                y={margin.top + innerHeight + 20}
                textAnchor="middle"
                fill="currentColor"
                className="text-[10px] text-ink-faint font-medium"
              >
                {p.label}
              </text>
            );
          })}

          {/* Ideal line */}
          {idealPath ? (
            <path
              d={idealPath}
              fill="none"
              stroke="currentColor"
              strokeDasharray="5 5"
              strokeWidth="2"
              className="text-ink-faint/60"
            />
          ) : null}

          {/* Actual Area */}
          {actualAreaPath ? <path d={actualAreaPath} fill={`url(#${gradId})`} /> : null}

          {/* Actual Line */}
          {actualPath ? (
            <path
              d={actualPath}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Forecast Line */}
          {forecastPath ? (
            <path
              d={forecastPath}
              fill="none"
              stroke="#a855f7"
              strokeDasharray="4 4"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ) : null}

          {/* Actual Points (Circles) */}
          {actualPoints.map(({ point: p, index: i }) => (
            <circle
              key={p.date}
              cx={getX(i)}
              cy={getY(p.actualRemaining!)}
              r={hoveredIndex === i ? 6 : 4}
              className={cn(
                "transition-all",
                hoveredIndex === i
                  ? "fill-primary stroke-panel stroke-2"
                  : "fill-panel stroke-primary stroke-2",
              )}
            />
          ))}

          {/* Vertical Guide Line on Hover */}
          {hoveredIndex !== null ? (
            <line
              x1={getX(hoveredIndex)}
              y1={margin.top}
              x2={getX(hoveredIndex)}
              y2={margin.top + innerHeight}
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-ink/40"
              strokeDasharray="2 2"
            />
          ) : null}

          {/* Invisible interactive hover rects */}
          {points.map((p, i) => {
            const colWidth = innerWidth / points.length;
            const xPos = getX(i) - colWidth / 2;
            return (
              <rect
                key={`hover-${p.date}`}
                x={xPos}
                y={margin.top}
                width={colWidth}
                height={innerHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && hoveredIndex !== null ? (
          <div
            className="pointer-events-none absolute z-20 flex flex-col gap-1 rounded-lg border border-rule bg-panel/95 p-2.5 shadow-lg backdrop-blur-md text-xs text-ink transition-all"
            style={{
              left: `${Math.min(
                Math.max(10, ((getX(hoveredIndex) / svgWidth) * 100)),
                75,
              )}%`,
              top: "16px",
            }}
          >
            <div className="font-semibold text-ink border-b border-rule/60 pb-1">
              {hoveredPoint.label} ({hoveredPoint.date})
            </div>
            <div className="flex items-center justify-between gap-4 text-ink-soft">
              <span>Ideal:</span>
              <span className="font-mono font-medium text-ink">
                {hoveredPoint.idealRemaining}
                {metric === "hours" ? "h" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-ink-soft">
              <span>Actual:</span>
              <span className="font-mono font-semibold text-primary-ink">
                {hoveredPoint.actualRemaining !== null
                  ? `${hoveredPoint.actualRemaining}${metric === "hours" ? "h" : ""}`
                  : "Future"}
              </span>
            </div>
            {hoveredPoint.completedInDay > 0 ? (
              <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                <span>Done in day:</span>
                <span className="font-mono font-medium">
                  +{hoveredPoint.completedInDay}
                  {metric === "hours" ? "h" : ""}
                </span>
              </div>
            ) : null}
            {hoveredPoint.scopeAddedInDay > 0 ? (
              <div className="flex items-center justify-between gap-4 text-amber-600 dark:text-amber-400">
                <span>Added scope:</span>
                <span className="font-mono font-medium">
                  +{hoveredPoint.scopeAddedInDay}
                  {metric === "hours" ? "h" : ""}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
