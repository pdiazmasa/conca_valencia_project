import { formatValue, revealContext, truthValue, type Probe } from "../data";
import { Rail } from "../charts/Rail";
import { LineChart, formatCompactUSD } from "../charts/LineChart";
import { railExtras } from "../charts/config";
import { useTween } from "../charts/useTween";
import type { RevealProps } from "./types";

export const toneLabel = { good: "Good news", bad: "Needs attention", neutral: "Fact" } as const;

// Cifra grande con la unidad en pequeño, como en las tarjetas de estadística.
export function StatValue({ probe, v, className = "" }: { probe: Probe; v: number | null; className?: string }) {
  if (v === null) return <p className={`stat-value sm ${className}`}>Never run out</p>;
  const text = formatValue(probe.input, v);
  const m = text.match(/^(.*?)\s(\S.*)$/);
  return (
    <p className={`stat-value ${className}`}>
      {m ? m[1] : text}
      {m && <span className="stat-unit">{m[2]}</span>}
    </p>
  );
}

export function Dashboard({ probe, answer, animate }: RevealProps) {
  const real = truthValue(probe);
  const target = real ?? answer;
  // Si animate=false, muestra directamente el valor final sin interpolación.
  const tween = useTween(animate ? answer : target, target, animate ? undefined : { duration: 0, delay: 0 });
  const planNow = animate ? tween.v : target;
  const arrived = animate ? tween.done : true;
  const fmt = (v: number) => formatValue(probe.input, v);

  return (
    <div className="dashboard">
      <p className="question-sm">{probe.question}</p>

      <section className="hero">
        <div className="card-head">
          <p className="eyebrow">Your plan</p>
          <span
            className={`badge badge-dot ${
              probe.tone === "bad" ? "badge-outline" : probe.tone === "good" ? "badge-solid" : "badge-soft"
            }`}
          >
            {toneLabel[probe.tone]}
          </span>
        </div>
        <StatValue probe={probe} v={real === null ? null : planNow} className={`hero-value tone-${probe.tone}`} />
        <p className="hero-sub">You said {fmt(answer)}</p>
      </section>

      {probe.id === "ahorros" && probe.truth.series && probe.truth.series.length > 0 ? (
        <LineChart
          points={probe.truth.series}
          tone={probe.tone}
          formatX={(v) => `age ${v}`}
          formatY={formatCompactUSD}
          markers={[
            { x: answer, label: "You" },
            ...(probe.truth.depletes && probe.truth.age !== undefined
              ? [{ x: probe.truth.age, label: "Runs out" }]
              : []),
            ...(probe.truth.endOfPlanAge !== undefined
              ? [{ x: probe.truth.endOfPlanAge, label: "End of plan" }]
              : []),
          ].filter((m) => m.x !== undefined && m.x !== null)}
        />
      ) : (
        real !== null && (
          <Rail
            min={probe.input.min}
            max={probe.input.max}
            you={answer}
            planNow={planNow}
            tone={probe.tone}
            format={fmt}
            arrived={arrived}
            {...railExtras(probe)}
          />
        )
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <p className="context">{revealContext(probe)}</p>
      </div>
    </div>
  );
}
