// Página solo para desarrollo, se abre con /#charts.
import { useState } from "react";
import { FAMILIES, formatValue, truthValue } from "../data";
import { Rail } from "./Rail";
import { railExtras } from "./config";
import { LineChart, LineChartDemo, formatCompactUSD } from "./LineChart";
import "./charts.css";

const TONES = ["good", "bad", "neutral"] as const;
type Tone = (typeof TONES)[number];

export function ChartsLab() {
  const [forcedTone, setForcedTone] = useState<Tone | null>(null);

  return (
    <div className="app">
      <main className="content" style={{ margin: "0 auto" }}>
        <h1 style={{ marginTop: 8, marginBottom: 16 }}>Charts lab</h1>

        {FAMILIES.flatMap((family) =>
          family.probes
            .filter((p) => truthValue(p) !== null)
            .map((p) => {
              const truth = truthValue(p)!;
              return (
                <div key={`${family.id}-${p.id}`} className="card">
                  <p className="eyebrow">
                    {family.name} · {p.id}
                  </p>
                  <p className="question-sm" style={{ marginTop: 4, marginBottom: 8 }}>
                    {p.question}
                  </p>
                  <Rail
                    min={p.input.min}
                    max={p.input.max}
                    you={p.input.initial}
                    planNow={truth}
                    tone={forcedTone ?? p.tone}
                    format={(v) => formatValue(p.input, v)}
                    arrived={true}
                    {...railExtras(p)}
                  />
                </div>
              );
            })
        )}

        <LineChartDemo />

        {FAMILIES.flatMap((family) =>
          family.probes
            .filter((p) => p.id === "ahorros" && (p.truth.series?.length ?? 0) > 0)
            .map((p) => (
              <div key={`savings-${family.id}`} className="card">
                <p className="eyebrow">
                  {family.name} · {p.id}
                </p>
                <p className="question-sm" style={{ marginTop: 4, marginBottom: 8 }}>
                  {p.question}
                </p>
                <LineChart
                  points={p.truth.series!}
                  tone={forcedTone ?? p.tone}
                  formatX={(v) => `age ${v}`}
                  formatY={formatCompactUSD}
                  markers={[
                    { x: p.input.initial, label: "You" },
                    ...(p.truth.depletes && p.truth.age !== undefined
                      ? [{ x: p.truth.age, label: "Runs out" }]
                      : []),
                    ...(p.truth.endOfPlanAge !== undefined
                      ? [{ x: p.truth.endOfPlanAge, label: "End of plan" }]
                      : []),
                  ].filter((m) => m.x !== undefined && m.x !== null)}
                />
              </div>
            ))
        )}

        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Tone selector
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                className={`pill ${forcedTone === tone ? "pill-filled" : "pill-outline"}`}
                onClick={() => setForcedTone((cur) => (cur === tone ? null : tone))}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default ChartsLab;
