import type { CSSProperties } from "react";
import { formatValue, revealContext, truthValue, type Probe } from "../data";
import type { RevealProps } from "./types";
import "./visual.css";

const TONE_LABEL: Record<Probe["tone"], string> = {
  good: "Good news",
  bad: "Needs attention",
  neutral: "Fact",
};

function splitFormatted(formatted: string): { num: string; unit: string } {
  const m = formatted.match(/^(.*?)\s(\S.*)$/);
  return m ? { num: m[1], unit: m[2] } : { num: formatted, unit: "" };
}

function staggerStyle(index: number, totalAnimated: number, animate: boolean): CSSProperties | undefined {
  if (!animate || totalAnimated <= 0) return undefined;
  const maxStaggerSec = 0.85;
  const delay = totalAnimated === 1 ? 0 : (index / (totalAnimated - 1)) * maxStaggerSec;
  return { ["--stagger" as string]: `${delay.toFixed(3)}s` };
}

function Pictogram({
  probe,
  value,
  variant,
  animate,
}: {
  probe: Probe;
  value: number;
  variant: "you" | "plan";
  animate: boolean;
}) {
  const { input } = probe;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  switch (input.unit) {
    case "months": {
      const total = Math.max(1, Math.round(input.max));
      const filled = clamp(Math.round(value), 0, total);
      return (
        <div
          className="visual-grid-months"
          role="img"
          aria-label={`${filled} of ${total} months`}
        >
          {Array.from({ length: total }, (_, i) => {
            const on = i < filled;
            return (
              <span
                key={i}
                className={`visual-cell-month ${on ? "is-on" : ""}`}
                style={on ? staggerStyle(i, filled, animate) : undefined}
              />
            );
          })}
        </div>
      );
    }

    case "%": {
      const total = 100;
      const filled = clamp(Math.round(value), 0, total);
      return (
        <div
          className="visual-grid-pct"
          role="img"
          aria-label={`${filled} of 100 percent`}
        >
          {Array.from({ length: total }, (_, i) => {
            const on = i < filled;
            return (
              <span
                key={i}
                className={`visual-dot ${on ? "is-on" : ""}`}
                style={on ? staggerStyle(i, filled, animate) : undefined}
              />
            );
          })}
        </div>
      );
    }

    case "$": {
      const total = 10;
      const filled = input.max > 0 ? clamp(Math.round((value / input.max) * total), 0, total) : 0;
      const isCardPlan = variant === "plan" && probe.id === "tarjeta";
      const interestCount = isCardPlan ? total - filled : 0;
      const animatedTotal = isCardPlan ? total : filled;

      return (
        <div className="visual-coins-wrap">
          <div
            className="visual-grid-coins"
            role="img"
            aria-label={
              isCardPlan
                ? `${filled} of ${total} coins reduce debt, ${interestCount} go to interest`
                : `${filled} of ${total} coins`
            }
          >
            {Array.from({ length: total }, (_, i) => {
              const on = i < filled;
              const isInterest = isCardPlan && !on;
              const cls = on ? "is-on" : isInterest ? "is-interest" : "";
              return (
                <span
                  key={i}
                  className={`visual-coin ${cls}`}
                  style={on || isInterest ? staggerStyle(i, animatedTotal, animate) : undefined}
                >
                  $
                </span>
              );
            })}
          </div>
          {isCardPlan && interestCount > 0 && (
            <p className="visual-interest-note">
              <span className="visual-interest-swatch" aria-hidden="true" />
              <span>interest</span>
            </p>
          )}
        </div>
      );
    }

    case "years":
    case "years of salary": {
      const unitStep = input.max <= 10 ? 0.5 : 1;
      const total = Math.max(1, Math.round(input.max / unitStep));
      const filled = clamp(Math.round(value / unitStep), 0, total);
      const layoutClass = input.max <= 10 ? "is-compact" : "is-century";

      return (
        <div
          className={`visual-bar-blocks ${layoutClass}`}
          role="img"
          aria-label={`${formatValue(input, value)} of ${formatValue(input, input.max)}`}
        >
          {Array.from({ length: total }, (_, i) => {
            const on = i < filled;
            return (
              <span
                key={i}
                className={`visual-block ${on ? "is-on" : ""}`}
                style={on ? staggerStyle(i, filled, animate) : undefined}
              />
            );
          })}
        </div>
      );
    }
  }
}

function FormattedFigure({ probe, value }: { probe: Probe; value: number }) {
  const { num, unit } = splitFormatted(formatValue(probe.input, value));
  return (
    <div className="visual-figure">
      <span className="visual-figure-num">{num}</span>
      {unit && <span className="visual-figure-unit">{unit}</span>}
    </div>
  );
}

export function Visual(props: RevealProps) {
  const { probe, answer, animate } = props;
  const real = truthValue(probe);
  const context = revealContext(probe);
  const isBad = probe.tone === "bad";
  const isCard = probe.id === "tarjeta";
  const badgeClass =
    probe.tone === "bad" ? "badge-outline" : probe.tone === "good" ? "badge-solid" : "badge-soft";

  return (
    <section className="visual-reveal" aria-label={probe.question}>
      <header className="visual-header">
        <h2 className="visual-question">{probe.question}</h2>
        <span className={`badge badge-dot ${badgeClass}`}>{TONE_LABEL[probe.tone]}</span>
      </header>

      <div className="visual-card">
        {/* Fila 1: Tú */}
        <div className="visual-row visual-row-you">
          <div className="visual-row-head">
            <span className="visual-row-label">You</span>
          </div>
          <div className="visual-row-body">
            <div className="visual-picto-wrap">
              <Pictogram probe={probe} value={answer} variant="you" animate={false} />
            </div>
            <FormattedFigure probe={probe} value={answer} />
          </div>
        </div>

        {/* Fila 2: Tu plan */}
        <div
          className={`visual-row visual-row-plan ${isBad ? "is-bad" : ""} ${isCard ? "is-card" : ""} ${
            animate ? "visual-animate" : ""
          }`}
        >
          <div className="visual-row-head">
            <span className="visual-row-label">Your plan</span>
          </div>
          <div className="visual-row-body">
            <div className="visual-picto-wrap">
              {real === null ? (
                <p className="visual-infinite">Never run out</p>
              ) : (
                <Pictogram probe={probe} value={real} variant="plan" animate={animate} />
              )}
            </div>
            {real !== null && <FormattedFigure probe={probe} value={real} />}
          </div>
        </div>

        {context && <p className="visual-context">{context}</p>}
      </div>
    </section>
  );
}
