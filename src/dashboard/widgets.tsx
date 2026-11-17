import type { ReactNode } from "react";
import { formatStat, formatValue, truthValue, type Probe } from "../data";
import { CountUp } from "./CountUp";
import { plainLabel, shortProbeLabel, type MoveItem, type PillarItem } from "./charts";

// Piezas pequeñas para los widgets del dashboard. Van en HTML y CSS, no en SVG con viewBox fijo:
// así el texto mantiene su tamaño y las barras llenan el ancho del widget, en móvil y en PC.
// Ninguna calcula cifras del plan: solo colocan en pantalla valores que ya vienen precalculados.

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

// ---- Pista "tú frente al plan" ----
export type GuessTrackProps = {
  min: number;
  max: number;
  you: number[]; // una respuesta, o una por persona en pareja
  plan: number;
  bad?: boolean;
  label: string;
};

export function GuessTrack({ min, max, you, plan, bad = false, label }: GuessTrackProps) {
  const span = max - min || 1;
  const pos = (v: number) => clamp01((v - min) / span) * 100;
  const planPos = pos(plan);
  // El tramo entre respuesta y plan solo se pinta con una persona; con dos se cruzarían.
  const single = you.length === 1 ? pos(you[0]) : null;

  return (
    <div className="dbx-track dbx-tip" role="img" aria-label={label} data-tip={label}>
      <span className="dbx-track-rail" />
      {single !== null && (
        <span
          className={`dbx-track-gap${bad ? " dbx-is-bad" : ""}`}
          style={{ left: `${Math.min(single, planPos)}%`, width: `${Math.abs(planPos - single)}%` }}
        />
      )}
      {you.map((v, i) => (
        <span
          key={i}
          className={`dbx-track-dot dbx-track-you${i > 0 ? " dbx-track-you-b" : ""}`}
          style={{ left: `${pos(v)}%` }}
        />
      ))}
      <span className={`dbx-track-dot dbx-track-plan${bad ? " dbx-is-bad" : ""}`} style={{ left: `${planPos}%` }} />
    </div>
  );
}

// ---- Barra fina de proporción, con marca de objetivo opcional ----
export type MiniBarProps = {
  ratio: number; // 0..1
  target?: number | null; // 0..1
  bad?: boolean;
  soft?: boolean;
  label: string;
};

export function MiniBar({ ratio, target, bad = false, soft = false, label }: MiniBarProps) {
  const pct = clamp01(ratio) * 100;
  return (
    <div className="dbx-minibar" role="img" aria-label={label}>
      {pct > 0 && (
        <span
          className={`dbx-minibar-fill${bad ? " dbx-is-bad" : ""}${soft ? " dbx-is-soft" : ""}`}
          style={{ width: `${pct}%` }}
        />
      )}
      {typeof target === "number" && (
        <span className="dbx-minibar-target" style={{ left: `${clamp01(target) * 100}%` }} />
      )}
    </div>
  );
}

// ---- Anillo de porcentaje con la cifra dentro ----
export type RingStatProps = {
  value: number; // 0..1
  bad?: boolean;
  label: string;
};

export function RingStat({ value, bad = false, label }: RingStatProps) {
  const filled = clamp01(value) * 100;
  const text = formatStat("pct", value);
  return (
    <div className="dbx-ringstat" role="img" aria-label={`${label}: ${text}`}>
      <svg className="dbx-ringstat-svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx={50} cy={50} r={42} className="dbx-ringstat-track" fill="none" />
        {filled > 0.1 && (
          <circle
            cx={50}
            cy={50}
            r={42}
            pathLength={100}
            strokeDasharray={`${filled.toFixed(2)} 100`}
            transform="rotate(-90 50 50)"
            className={`dbx-ringstat-fill${bad ? " dbx-is-bad" : ""}`}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className={`dbx-ringstat-num${bad ? " tone-bad" : ""}`}>{text}</span>
    </div>
  );
}

// ---- 12 casillas: meses que cubre el colchón (misma regla que antes: rojo por debajo de 4) ----
export function MonthGrid({ months }: { months: number }) {
  const filled = Math.min(12, Math.max(0, Math.round(months)));
  const bad = months < 4;
  return (
    <div
      className="dbx-months dbx-tip"
      data-tip={`${formatStat("months", months)} of expenses covered`}
      role="img"
      aria-label={`${formatStat("months", months)} of expenses covered (${filled} of 12 boxes filled)`}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className={`dbx-month${i < filled ? (bad ? " dbx-month-bad" : " dbx-month-on") : ""}`}
        />
      ))}
    </div>
  );
}

// ---- Filas de barras: nombre a la izquierda, cifra a la derecha y barra debajo ----
export type BarRow = {
  key: string;
  label: string;
  value: ReactNode;
  ratio: number; // 0..1
  target?: number | null; // 0..1
  bad?: boolean;
  soft?: boolean;
  // Con ratio 0, deja una muesca visible (por ejemplo, una cobertura de $0 que debería existir).
  notch?: boolean;
};

export function BarRows({ rows, ariaLabel }: { rows: BarRow[]; ariaLabel: string }) {
  return (
    <ul className="dbx-rows" aria-label={ariaLabel}>
      {rows.map((r) => {
        const pct = clamp01(r.ratio) * 100;
        const showFill = pct > 0 || r.notch;
        return (
          <li key={r.key} className="dbx-row">
            <div className="dbx-row-head">
              <span className="dbx-row-label">{r.label}</span>
              <span className="dbx-row-value">{r.value}</span>
            </div>
            <div className="dbx-row-bar">
              {showFill && (
                <span
                  className={`dbx-row-fill${r.bad ? " dbx-is-bad" : ""}${r.soft ? " dbx-is-soft" : ""}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              {typeof r.target === "number" && (
                <span
                  className={`dbx-row-target${r.bad ? " dbx-is-bad" : ""}`}
                  style={{ left: `${clamp01(r.target) * 100}%` }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Nombres de los pasos del plan sin jerga del MCP (solo cambia el texto, no el dato).
export function plainMove(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("revolving")) return "Pay down your credit card";
  if (lower.includes("mortality")) return "Raise your life insurance";
  if (lower.includes("single-name") || lower.includes("concentration")) return "Rely less on one stock";
  if (lower.includes("growth") && lower.includes("glide") && lower.startsWith("reduce"))
    return "Take less risk as you age";
  if (lower.includes("growth") && lower.includes("glide")) return "Add more growth investments";
  if (lower.includes("withdrawal")) return "Withdraw less each year";
  return plainLabel(title);
}

// ---- "What moves your score" resumido: cada paso por separado, sin acumular ----
// Cada barra es lo que suma ESE paso desde la nota de hoy (scoreAfter - scoreBefore del plan).
export function MovesMini({ moves }: { moves: MoveItem[] }) {
  const deltas = moves.map((m) => m.scoreAfter - m.scoreBefore);
  const maxDelta = Math.max(1, ...deltas);
  return (
    <ol className="dbx-rows dbx-moves-mini" aria-label="Points each step adds on its own">
      {moves.slice(0, 3).map((m, i) => {
        const d = deltas[i];
        return (
          <li key={m.title} className="dbx-row dbx-tip" data-tip={`${plainMove(m.title)}: ${m.scoreBefore} → ${m.scoreAfter}`}>
            <div className="dbx-row-head">
              <span className="dbx-row-label">{plainMove(m.title)}</span>
              <span className={`dbx-row-value${d <= 0 ? " dbx-row-value-muted" : ""}`}>
                <CountUp value={d} signed />
              </span>
            </div>
            <div className="dbx-row-bar">
              {d > 0 && <span className="dbx-row-fill" style={{ width: `${(d / maxDelta) * 100}%` }} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---- Nota por área en barras (sustituye al radar dentro del widget: se lee mejor en pequeño) ----
function pillarShortName(name: string): string {
  if (name.includes("Liquidity")) return "Emergency cash";
  const lower = name.toLowerCase();
  if (lower.includes("saving")) return "Savings";
  if (lower.includes("debt")) return "Debt";
  if (lower.includes("invest")) return "Investments";
  if (lower.includes("insur") || lower.includes("protect")) return "Protection";
  return plainLabel(name);
}

export function PillarBars({ pillars }: { pillars: PillarItem[] }) {
  return (
    <ul className="dbx-pillars" aria-label="Score by area, out of 100">
      {pillars.map((p) => {
        const low = p.score < 40;
        return (
          <li key={p.name} className="dbx-pillar dbx-tip" data-tip={`${pillarShortName(p.name)}: ${p.score} out of 100`}>
            <span className="dbx-pillar-name">{pillarShortName(p.name)}</span>
            <span className="dbx-pillar-bar">
              {p.score > 0 && (
                <span
                  className={`dbx-pillar-fill${low ? " dbx-is-bad" : ""}`}
                  style={{ width: `${clamp01(p.score / 100) * 100}%` }}
                />
              )}
            </span>
            <span className={`dbx-pillar-score${low ? " tone-bad" : ""}`}><CountUp value={p.score} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---- Lista de la portada: cada pregunta con su pista "tú frente al plan" ----
export function GuessList({ probes, answers }: { probes: Probe[]; answers: Record<string, number> }) {
  return (
    <ul className="dbx-gl" aria-label="Your guesses compared with your plan">
      {probes.slice(0, 4).map((p) => {
        const plan = truthValue(p);
        const you = answers[p.id] ?? p.input.initial;
        const label = shortProbeLabel(p);
        return (
          <li key={p.id} className="dbx-gl-row">
            <span className="dbx-gl-name">{label}</span>
            {plan === null ? (
              <span className="dbx-gl-none">Lasts the full plan</span>
            ) : (
              <GuessTrack
                min={p.input.min}
                max={p.input.max}
                you={[you]}
                plan={plan}
                bad={p.tone === "bad"}
                label={`${label}: you said ${formatValue(p.input, you)}, your plan says ${formatValue(p.input, plan)}`}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
