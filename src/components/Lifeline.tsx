import { useEffect, useState, type CSSProperties } from "react";
import type { Scale } from "../data/types";
import { formatValue } from "../utils/format";
import {
  assignLabelRows,
  computeLabelBox,
  getGapRangePercent,
  valueToPercent,
  type LabelAnchor,
} from "../utils/lifeline";

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
  showPlan?: boolean;
  animatePlan?: boolean;
  baselinePlanValue?: number;
  baselineLabel?: string;
  alwaysShowBaseline?: boolean;
  marks?: LifelineMark[];
  shadeGap?: boolean;
};

const ROW_HEIGHT_PX = 38;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getLabelStyleForBox(
  anchor: LabelAnchor,
  boxStartPct: number,
  boxEndPct: number
): CSSProperties {
  if (anchor === "start") {
    return { left: `${boxStartPct}%`, transform: "translateX(0)" };
  }
  if (anchor === "end") {
    return { left: `${boxEndPct}%`, transform: "translateX(-100%)" };
  }
  return {
    left: `${(boxStartPct + boxEndPct) / 2}%`,
    transform: "translateX(-50%)",
  };
}

export function Lifeline({
  scale,
  planValue,
  planLabel = "Your plan",
  showPlan = true,
  animatePlan = false,
  baselinePlanValue,
  baselineLabel = "Today",
  alwaysShowBaseline = false,
  marks = [],
  shadeGap = false,
}: LifelineProps) {
  const [planSettled, setPlanSettled] = useState(!animatePlan);

  useEffect(() => {
    if (!showPlan) {
      setPlanSettled(false);
      return;
    }
    if (!animatePlan || prefersReducedMotion()) {
      setPlanSettled(true);
      return;
    }

    setPlanSettled(false);
    let innerRaf = 0;
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => {
        setPlanSettled(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(outerRaf);
      if (innerRaf) {
        window.cancelAnimationFrame(innerRaf);
      }
    };
  }, [showPlan, animatePlan]);

  const planPct = valueToPercent(planValue, scale.min, scale.max);
  const planText = `${planLabel}: ${formatValue(planValue, scale.kind, "tick")}`;
  const planBox = computeLabelBox(planPct, planText);
  const planEntryPct = planPct < 20 ? 90 : 0;
  const displayedPlanPct = !animatePlan || planSettled ? planPct : planEntryPct;

  const showBaseline =
    baselinePlanValue !== undefined &&
    (alwaysShowBaseline || baselinePlanValue !== planValue);
  const baselinePct =
    baselinePlanValue !== undefined
      ? valueToPercent(baselinePlanValue, scale.min, scale.max)
      : 0;

  const gapRange =
    showPlan && shadeGap && marks.length > 0
      ? getGapRangePercent(
          marks.map((mark) => mark.value),
          planValue,
          scale.min,
          scale.max
        )
      : null;

  const minLabel = formatValue(scale.min, scale.kind, "tick");
  const maxLabel = formatValue(scale.max, scale.kind, "tick");

  const belowRawItems = [
    ...marks.map((mark) => ({
      id: mark.id,
      percent: valueToPercent(mark.value, scale.min, scale.max),
      label: `${mark.label}: ${formatValue(mark.value, scale.kind, "tick")}`,
      color: mark.color,
      isBaseline: false,
    })),
    ...(showBaseline && baselinePlanValue !== undefined
      ? [
          {
            id: "baseline",
            percent: baselinePct,
            label: `${baselineLabel}: ${formatValue(baselinePlanValue, scale.kind, "tick")}`,
            color: "var(--color-text-muted)",
            isBaseline: true,
          },
        ]
      : []),
  ];

  const laidOutBelow = assignLabelRows(
    belowRawItems.map((item) => ({
      id: item.id,
      percent: item.percent,
      label: item.label,
    }))
  );

  const belowItems = belowRawItems.map((raw, idx) => ({
    ...raw,
    ...laidOutBelow[idx],
  }));

  const maxRow =
    belowItems.length > 0 ? Math.max(...belowItems.map((item) => item.row)) : 0;
  const belowZoneHeight =
    belowItems.length > 0 ? (maxRow + 1) * ROW_HEIGHT_PX + 12 : 44;

  const ariaParts = [
    `Lifeline from ${minLabel} to ${maxLabel}.`,
    ...(showPlan ? [`${planText}.`] : []),
    ...(showBaseline && baselinePlanValue !== undefined
      ? [`${baselineLabel}: ${formatValue(baselinePlanValue, scale.kind, "tick")}.`]
      : []),
    ...marks.map(
      (mark) => `${mark.label}: ${formatValue(mark.value, scale.kind, "tick")}.`
    ),
  ];

  const planLabelPositionStyle =
    !animatePlan || planSettled
      ? getLabelStyleForBox(planBox.anchor, planBox.boxStartPct, planBox.boxEndPct)
      : { left: `${planEntryPct}%`, transform: "translateX(-50%)" };

  return (
    <div className="lifeline-wrap" role="group" aria-label={ariaParts.join(" ")}>
      <div className="lifeline-track-shell">
        {/* Above-axis zone for plan mark */}
        <div className="lifeline-above-zone">
          {showPlan && (
            <>
              <span
                className={`lifeline-plan-stem ${animatePlan ? "is-animated" : ""} ${
                  planSettled ? "is-settled" : "is-entering"
                }`}
                style={{ left: `${displayedPlanPct}%` }}
                aria-hidden="true"
              />
              <span
                className={`lifeline-mark-label lifeline-plan-label ${
                  animatePlan ? "is-animated" : ""
                } ${planSettled ? "is-settled" : "is-entering"}`}
                style={planLabelPositionStyle}
              >
                {planText}
              </span>
            </>
          )}
        </div>

        {/* Middle axis track */}
        <div className="lifeline-axis-row">
          <svg
            className="lifeline-axis-svg"
            viewBox="0 0 300 28"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {gapRange && (
              <rect
                className={`lifeline-gap-rect ${animatePlan ? "is-animated" : ""} ${
                  planSettled ? "is-settled" : "is-entering"
                }`}
                x={(gapRange.startPercent / 100) * 300}
                y={3}
                width={Math.max(
                  3,
                  ((gapRange.endPercent - gapRange.startPercent) / 100) * 300
                )}
                height={22}
                rx={4}
                fill="var(--color-gap)"
              />
            )}
            <line
              x1={0}
              y1={14}
              x2={300}
              y2={14}
              stroke="var(--color-text)"
              strokeWidth={6}
              strokeLinecap="round"
            />
            <line
              x1={0}
              y1={4}
              x2={0}
              y2={24}
              stroke="var(--color-text)"
              strokeWidth={3}
            />
            <line
              x1={300}
              y1={4}
              x2={300}
              y2={24}
              stroke="var(--color-text)"
              strokeWidth={3}
            />
          </svg>

          {showBaseline && baselinePlanValue !== undefined && (
            <span
              className="lifeline-dot lifeline-dot-baseline"
              style={{ left: `${baselinePct}%` }}
              aria-hidden="true"
            />
          )}

          {marks.map((mark) => {
            const pct = valueToPercent(mark.value, scale.min, scale.max);
            return (
              <span
                key={`dot-${mark.id}`}
                className="lifeline-dot"
                style={{ left: `${pct}%`, backgroundColor: mark.color }}
                aria-hidden="true"
              />
            );
          })}

          {showPlan && (
            <span
              className={`lifeline-diamond ${animatePlan ? "is-animated" : ""} ${
                planSettled ? "is-settled" : "is-entering"
              }`}
              style={{ left: `${displayedPlanPct}%` }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Scale min / max ticks */}
        <div className="lifeline-ticks-row" aria-hidden="true">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>

        {/* Below-axis zone for guess marks and baseline */}
        <div
          className="lifeline-below-zone"
          style={{ height: `${belowZoneHeight}px` }}
        >
          {belowItems.map((item) => {
            const topPx = item.row * ROW_HEIGHT_PX + 10;
            return (
              <div key={item.id} className="lifeline-below-item">
                <span
                  className={`lifeline-below-stem ${item.isBaseline ? "is-dashed" : ""}`}
                  style={{
                    left: `${item.percent}%`,
                    height: `${topPx}px`,
                    borderColor: item.color,
                  }}
                  aria-hidden="true"
                />
                <span
                  className={`lifeline-mark-label ${item.isBaseline ? "is-baseline" : ""}`}
                  style={{
                    top: `${topPx}px`,
                    ...getLabelStyleForBox(item.anchor, item.boxStartPct, item.boxEndPct),
                    color: item.color,
                  }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
