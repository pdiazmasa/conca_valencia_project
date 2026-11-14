import { useState } from "react";
import { ANALYSIS, FAMILIES, SECTION_OF_PROBE, familyAge, formatValue, truthValue, type Family } from "./data";
import { FORMATS, FORMAT_ORDER, formatForAge, type FormatId } from "./formats";
import { DashboardPage } from "./formats/DashboardPage";
import type { AnalysisPage } from "./formats/types";
import { StatValue, toneLabel } from "./formats/Dashboard";

type Dir = "forward" | "back";
// age: edad (decide el formato) · ask: las preguntas de intuición · analysis: análisis completo · done: resumen y otros formatos
type Phase = "age" | "ask" | "analysis" | "done";
type State = {
  family: Family | null;
  age: number;
  format: FormatId;
  index: number;
  step: number;
  phase: Phase;
  answers: Record<string, number>;
  dir: Dir;
};

const initials = (name: string) =>
  name
    .split(/\s+(?:y|and|&)\s+|\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} disabled={disabled} aria-label="Back">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
        <path d="M8 2 2 8l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Progress({ total, current }: { total: number; current: number }) {
  return (
    <div className="progress" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i <= current ? "on" : ""} />
      ))}
    </div>
  );
}

function FamilyScreen({ onPick }: { onPick: (f: Family) => void }) {
  return (
    <main className="content">
      <h1>Who are you?</h1>
      <ul className="family-list card card-list">
        {FAMILIES.map((f) => (
          <li key={f.id}>
            <button type="button" className="family-row card-row" onClick={() => onPick(f)}>
              <span className="avatar">{initials(f.name)}</span>
              <span className="row-main">
                <span className="row-title" style={{ display: "block" }}>
                  {f.name}
                </span>
              </span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true" style={{ color: "var(--muted)" }}>
                <path d="m1 1 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function QuestionScreen({
  family,
  index,
  format,
  value,
  onChange,
  onNext,
}: {
  family: Family;
  index: number;
  format: FormatId;
  value: number;
  onChange: (v: number) => void;
  onNext: () => void;
}) {
  const isLast = index >= family.probes.length - 1;
  const probe = family.probes[index];
  const { input } = probe;
  const pct = ((value - input.min) / (input.max - input.min)) * 100;
  const framing = FORMATS[format].askFraming?.(family, probe);
  const Ask = FORMATS[format].Ask;

  return (
    <main className="content">
      {framing && <p className="eyebrow ask-framing">{framing}</p>}
      <h1 className="question">{probe.question}</h1>
      {Ask && <Ask family={family} probe={probe} />}
      <Progress total={family.probes.length} current={index} />
      <div className="card" style={{ marginTop: 24 }}>
        <div aria-live="polite">
          <StatValue probe={probe} v={value} />
        </div>
        <input
          className="slider"
          type="range"
          min={input.min}
          max={input.max}
          step={input.step}
          value={value}
          style={{ ["--pct" as string]: `${pct}%` }}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={probe.question}
        />
        <div className="range-labels">
          <span>{formatValue(input, input.min)}</span>
          <span>{formatValue(input, input.max)}</span>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="pill pill-filled" onClick={onNext}>
          {isLast ? "See my plan" : "Next"}
        </button>
      </div>
    </main>
  );
}

function AgeScreen({ value, onChange, onNext }: { value: number; onChange: (v: number) => void; onNext: () => void }) {
  const min = 18;
  const max = 95;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <main className="content">
      <h1 className="question">How old are you?</h1>
      <div className="card" style={{ marginTop: 24 }}>
        <p className="stat-value" aria-live="polite">
          {value}
          <span className="stat-unit">years old</span>
        </p>
        <input
          className="slider"
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          style={{ ["--pct" as string]: `${pct}%` }}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Your age"
        />
        <div className="range-labels">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="pill pill-filled" onClick={onNext}>
          Continue
        </button>
      </div>
    </main>
  );
}

// Páginas del análisis: portada + una por sección, con las sondas que pertenecen a cada una.
function analysisPages(family: Family): AnalysisPage[] {
  const analysis = ANALYSIS[family.id];
  if (!analysis) return [];
  return [
    { kind: "cover" },
    ...analysis.sections.map((section): AnalysisPage => ({
      kind: "section",
      section,
      probes: family.probes.filter((p) => SECTION_OF_PROBE[p.id] === section.id),
    })),
  ];
}

function AnalysisScreen({
  family,
  format,
  step,
  answers,
  onNext,
}: {
  family: Family;
  format: FormatId;
  step: number;
  answers: Record<string, number>;
  onNext: () => void;
}) {
  const pages = analysisPages(family);
  const page = pages[step];
  const def = FORMATS[format];
  const Page = def.Page ?? DashboardPage;
  if (!page) return null;
  return (
    <main className="content">
      <Progress total={pages.length} current={step} />
      <div className="reveal-slot">
        <Page family={family} analysis={ANALYSIS[family.id]} page={page} answers={answers} Reveal={def.Reveal} />
      </div>
      <div className="actions">
        <button type="button" className="pill pill-filled" onClick={onNext}>
          {step >= pages.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </main>
  );
}

function SummaryScreen({
  family,
  answers,
  onChangeFormat,
  onRestart,
}: {
  family: Family;
  answers: Record<string, number>;
  onChangeFormat: (f: FormatId) => void;
  onRestart: () => void;
}) {

  // Sondas con valor real numérico para contabilizar aciertos (margen <= 10 % del rango).
  const scorable = family.probes.filter((p) => truthValue(p) !== null);
  const hits = scorable.filter((p) => {
    const real = truthValue(p)!;
    const a = answers[p.id] ?? p.input.initial;
    return Math.abs(a - real) <= 0.1 * (p.input.max - p.input.min);
  }).length;

  const clampPct = (v: number, min: number, max: number) =>
    Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  return (
    <main className="content">
      <h1>Summary</h1>

      <section className="card summary-score" style={{ marginTop: 24 }}>
        <p className="eyebrow">CLOSE GUESSES</p>
        <p className="stat-value">
          {hits} <span className="stat-unit">of {scorable.length}</span>
        </p>
      </section>

      <ul className="summary-list">
        {family.probes.map((p) => {
          const real = truthValue(p);
          const a = answers[p.id] ?? p.input.initial;
          const youPct = clampPct(a, p.input.min, p.input.max);
          const realPct = real !== null ? clampPct(real, p.input.min, p.input.max) : 0;
          const badgeTone =
            p.tone === "bad" ? "badge-outline" : p.tone === "good" ? "badge-solid" : "badge-soft";

          return (
            <li key={p.id} className="card summary-card">
              <div className="card-head">
                <p className="eyebrow summary-q">{p.question}</p>
                <span className={`badge badge-dot ${badgeTone}`}>{toneLabel[p.tone]}</span>
              </div>
              <StatValue probe={p} v={real} className={`sm tone-${p.tone}`} />
              {real !== null && (
                <div className="summary-bar" aria-hidden="true">
                  <span className="summary-mark summary-mark-you" style={{ left: `${youPct}%` }} />
                  <span
                    className={`summary-mark summary-mark-plan tone-${p.tone}`}
                    style={{ left: `${realPct}%` }}
                  />
                </div>
              )}
              <p className="summary-you">You: {formatValue(p.input, a)}</p>
            </li>
          );
        })}
      </ul>

      <section className="other-formats">
        <h2 className="section-title">See it another way</h2>
        <div className="format-pills" role="group" aria-label="See in other formats">
          {FORMAT_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className="format-pill"
              onClick={() => onChangeFormat(id)}
            >
              {FORMATS[id].name}
            </button>
          ))}
        </div>

      </section>

      <div className="actions">
        <button type="button" className="pill pill-outline" onClick={onRestart}>
          Start over
        </button>
      </div>
    </main>
  );
}

const initialState: State = {
  family: null,
  age: 40,
  format: "dashboard",
  index: 0,
  step: 0,
  phase: "age",
  answers: {},
  dir: "forward",
};

export default function App() {
  const [s, setS] = useState<State>(initialState);

  // Al elegir familia se propone la edad del cliente principal; la persona puede cambiarla.
  const pickFamily = (family: Family) =>
    setS({ ...initialState, family, age: familyAge(family) ?? 40, dir: "forward" });

  const confirmAge = () =>
    setS((cur) => ({ ...cur, format: formatForAge(cur.age), phase: "ask", index: 0, dir: "forward" }));

  const restart = () => setS({ ...initialState, dir: "back" });

  const back = () =>
    setS((cur) => {
      if (!cur.family) return cur;
      if (cur.phase === "done") return { ...cur, phase: "analysis", step: analysisPages(cur.family).length - 1, dir: "back" };
      if (cur.phase === "analysis") {
        if (cur.step > 0) return { ...cur, step: cur.step - 1, dir: "back" };
        return { ...cur, phase: "ask", index: cur.family.probes.length - 1, dir: "back" };
      }
      if (cur.phase === "ask") {
        if (cur.index > 0) return { ...cur, index: cur.index - 1, dir: "back" };
        return { ...cur, phase: "age", dir: "back" };
      }
      return { ...cur, family: null, dir: "back" };
    });

  // Fija la respuesta actual (aunque no se haya movido el deslizador) y pasa a la siguiente pregunta;
  // tras la última empieza el análisis.
  const nextQuestion = () =>
    setS((cur) => {
      if (!cur.family) return cur;
      const p = cur.family.probes[cur.index];
      const answers = { ...cur.answers, [p.id]: cur.answers[p.id] ?? p.input.initial };
      if (cur.index >= cur.family.probes.length - 1) return { ...cur, answers, phase: "analysis", step: 0, dir: "forward" };
      return { ...cur, answers, index: cur.index + 1, dir: "forward" };
    });

  const nextStep = () =>
    setS((cur) => {
      if (!cur.family) return cur;
      if (cur.step >= analysisPages(cur.family).length - 1) return { ...cur, phase: "done", dir: "forward" };
      return { ...cur, step: cur.step + 1, dir: "forward" };
    });

  const changeFormat = (format: FormatId) => setS((cur) => ({ ...cur, format, phase: "analysis", step: 0, dir: "forward" }));

  const screenKey = s.family ? `${s.phase}-${s.family.id}-${s.phase === "analysis" ? s.step : s.index}-${s.format}` : "family";
  const probe = s.family?.probes[s.index];

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={back} disabled={!s.family} />
      </header>
      <div key={screenKey} className={`screen dir-${s.dir}`}>
        {!s.family ? (
          <FamilyScreen onPick={pickFamily} />
        ) : s.phase === "age" ? (
          <AgeScreen value={s.age} onChange={(age) => setS((cur) => ({ ...cur, age }))} onNext={confirmAge} />
        ) : s.phase === "done" ? (
          <SummaryScreen family={s.family} answers={s.answers} onChangeFormat={changeFormat} onRestart={restart} />
        ) : s.phase === "analysis" ? (
          <AnalysisScreen family={s.family} format={s.format} step={s.step} answers={s.answers} onNext={nextStep} />
        ) : probe ? (
          <QuestionScreen
            family={s.family}
            index={s.index}
            format={s.format}
            value={s.answers[probe.id] ?? probe.input.initial}
            onChange={(v) => setS((cur) => ({ ...cur, answers: { ...cur.answers, [s.family!.probes[cur.index].id]: v } }))}
            onNext={nextQuestion}
          />
        ) : null}
      </div>
    </div>
  );
}
