import type { Scale } from "../data/types";
import { formatValue } from "../utils/format";
import { getGapRangePercent, valueToPercent } from "../utils/lifeline";

export type LifelineMark = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type LifelineProps = {
  scale: Scale;
  planValue: number;
  planLabel?: string;
  baselinePlanValue?: number;
  marks?: LifelineMark[];
  shadeGap?: boolean;
};

const SVG_WIDTH = 360;
const X_MIN = 28;
const X_MAX = 332;
const Y_AXIS = 68;

function percentToX(percent: number): number {
  return X_MIN + (percent / 100) * (X_MAX - X_MIN);
}

function getTextAnchor(percent: number): "start" | "middle" | "end" {
  if (percent < 20) return "start";
  if (percent > 80) return "end";
  return "middle";
}

function getClampedLabelX(percent: number): number {
  const x = percentToX(percent);
  if (percent < 20) return Math.max(8, x - 4);
  if (percent > 80) return Math.min(SVG_WIDTH - 8, x + 4);
  return x;
}

export function Lifeline({
  scale,
  planValue,
  planLabel = "Your plan",
  baselinePlanValue,
  marks = [],
  shadeGap = false,
}: LifelineProps) {
  const planPct = valueToPercent(planValue, scale.min, scale.max);
  const planX = percentToX(planPct);
  const planText = `${planLabel}: ${formatValue(planValue, scale.kind, "tick")}`;

  const showBaseline =
    baselinePlanValue !== undefined && baselinePlanValue !== planValue;
  const baselinePct = showBaseline
    ? valueToPercent(baselinePlanValue, scale.min, scale.max)
    : 0;
  const baselineX = percentToX(baselinePct);

  const gapRange =
    shadeGap && marks.length > 0
      ? getGapRangePercent(
          marks.map((mark) => mark.value),
          planValue,
          scale.min,
          scale.max
        )
      : null;

  const minLabel = formatValue(scale.min, scale.kind, "tick");
  const maxLabel = formatValue(scale.max, scale.kind, "tick");

  let svgHeight = Y_AXIS + 34;
  if (marks.length > 0) {
    svgHeight = Y_AXIS + 54 + marks.length * 24;
  } else if (showBaseline) {
    svgHeight = Y_AXIS + 56;
  }

  const ariaParts = [
    `Lifeline from ${minLabel} to ${maxLabel}.`,
    `${planText}.`,
    ...marks.map(
      (mark) => `${mark.label}: ${formatValue(mark.value, scale.kind, "tick")}.`
    ),
  ];

  return (
    <div className="lifeline-wrap">
      <svg
        className="lifeline-svg"
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        role="img"
        aria-label={ariaParts.join(" ")}
      >
        <title>{ariaParts.join(" ")}</title>

        {/* Gap shading between furthest guess and plan */}
        {gapRange && (
          <rect
            x={percentToX(gapRange.startPercent)}
            y={Y_AXIS - 10}
            width={Math.max(2, percentToX(gapRange.endPercent) - percentToX(gapRange.startPercent))}
            height={20}
            rx={4}
            fill="var(--color-gap)"
          />
        )}

        {/* Main horizontal scale line */}
        <line
          x1={X_MIN}
          y1={Y_AXIS}
          x2={X_MAX}
          y2={Y_AXIS}
          stroke="var(--color-text)"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* End ticks */}
        <line
          x1={X_MIN}
          y1={Y_AXIS - 7}
          x2={X_MIN}
          y2={Y_AXIS + 7}
          stroke="var(--color-text)"
          strokeWidth={2}
        />
        <line
          x1={X_MAX}
          y1={Y_AXIS - 7}
          x2={X_MAX}
          y2={Y_AXIS + 7}
          stroke="var(--color-text)"
          strokeWidth={2}
        />

        <text
          x={X_MIN}
          y={Y_AXIS + 22}
          textAnchor="start"
          fontSize="12"
          fontWeight="600"
          fill="var(--color-text-muted)"
        >
          {minLabel}
        </text>
        <text
          x={X_MAX}
          y={Y_AXIS + 22}
          textAnchor="end"
          fontSize="12"
          fontWeight="600"
          fill="var(--color-text-muted)"
        >
          {maxLabel}
        </text>

        {/* Optional baseline mark below axis (used when score steps move plan mark) */}
        {showBaseline && baselinePlanValue !== undefined && (
          <g>
            <line
              x1={baselineX}
              y1={Y_AXIS}
              x2={baselineX}
              y2={Y_AXIS + 34}
              stroke="var(--color-text-muted)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <circle
              cx={baselineX}
              cy={Y_AXIS}
              r={5}
              fill="var(--color-surface)"
              stroke="var(--color-text-muted)"
              strokeWidth={2}
            />
            <text
              x={getClampedLabelX(baselinePct)}
              y={Y_AXIS + 48}
              textAnchor={getTextAnchor(baselinePct)}
              fontSize="12"
              fontWeight="600"
              fill="var(--color-text-muted)"
            >
              {`Start: ${formatValue(baselinePlanValue, scale.kind, "tick")}`}
            </text>
          </g>
        )}

        {/* Participant guess marks */}
        {marks.map((mark, index) => {
          const pct = valueToPercent(mark.value, scale.min, scale.max);
          const x = percentToX(pct);
          const yLabel = Y_AXIS + 46 + index * 24;
          const label = `${mark.label}: ${formatValue(mark.value, scale.kind, "tick")}`;

          return (
            <g key={mark.id}>
              <line
                x1={x}
                y1={Y_AXIS}
                x2={x}
                y2={yLabel - 14}
                stroke={mark.color}
                strokeWidth={2}
              />
              <circle
                cx={x}
                cy={Y_AXIS}
                r={7}
                fill={mark.color}
                stroke="#ffffff"
                strokeWidth={2}
              />
              <text
                x={getClampedLabelX(pct)}
                y={yLabel}
                textAnchor={getTextAnchor(pct)}
                fontSize="13"
                fontWeight="700"
                fill={mark.color}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Plan mark above axis */}
        <g>
          <line
            x1={planX}
            y1={34}
            x2={planX}
            y2={Y_AXIS}
            stroke="var(--color-plan)"
            strokeWidth={3}
          />
          <polygon
            points={`${planX},${Y_AXIS - 9} ${planX + 8},${Y_AXIS} ${planX},${Y_AXIS + 9} ${planX - 8},${Y_AXIS}`}
            fill="var(--color-plan)"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <text
            x={getClampedLabelX(planPct)}
            y={25}
            textAnchor={getTextAnchor(planPct)}
            fontSize="14"
            fontWeight="800"
            fill="var(--color-plan)"
          >
            {planText}
          </text>
        </g>
      </svg>
    </div>
  );
}
