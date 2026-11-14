import { useState } from "react";
import { ANALYSIS, FAMILIES, SECTION_OF_PROBE, formatValue, peopleOf, truthValue, type Family, type Person } from "./data";
import { FORMATS, FORMAT_ORDER, formatForAge, type FormatId } from "./formats";
import { DashboardPage } from "./formats/DashboardPage";
import type { AnalysisPage } from "./formats/types";
import { StatValue, toneLabel } from "./formats/Dashboard";
import { AudioTurn } from "./formats/Audio";
import { CoupleReveal } from "./analysis/CoupleReveal";
import LoadingScreen from "./LoadingScreen";

type Dir = "forward" | "back";
// turn: "X, responde" (solo con varias personas) · age: edad (decide el formato) · ask: preguntas de intuición ·
// loading: carga corta · couple: cada aspecto con lo que opina cada uno y el plan (solo parejas) ·
// analysis: plan completo · done: resumen
type Phase = "turn" | "age" | "ask" | "loading" | "couple" | "analysis" | "done";
type State = {
  family: Family | null;
  people: Person[];
  person: number; // persona que está respondiendo
  ages: number[];
  formatOverride: FormatId | null; // formato elegido al final con "See it another way"
  index: number;
  step: number;
  phase: Phase;
  answers: Record<number, Record<string, number>>;
  dir: Dir;
  history: State[];
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
  const Ask = FORMATS[format].Ask;

  return (
    <main className="content">
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
// En pareja las sondas ya se han visto aspecto por aspecto, así que las secciones no las repiten.
function analysisPages(family: Family, couple = false): AnalysisPage[] {
  const analysis = ANALYSIS[family.id];
  if (!analysis) return [];
  return [
    { kind: "cover" },
    ...analysis.sections.map((section): AnalysisPage => ({
      kind: "section",
      section,
      probes: couple ? [] : family.probes.filter((p) => SECTION_OF_PROBE[p.id] === section.id),
    })),
  ];
}

function AnalysisScreen({
  family,
  format,
  step,
  answers,
  couple,
  onNext,
}: {
  family: Family;
  format: FormatId;
  step: number;
  answers: Record<string, number>;
  couple: boolean;
  onNext: () => void;
}) {
  const pages = analysisPages(family, couple);
  const page = pages[step];
  const def = FORMATS[format];
  const Page = def.Page ?? DashboardPage;
  if (!page) return null;
  return (
    <main className="content">
      <Progress total={pages.length} current={step} />
      <div className={`reveal-slot${couple ? " is-couple" : ""}`}>
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

function TurnScreen({ person, format, onNext }: { person: Person; format: FormatId; onNext: () => void }) {
  return (
    <main className="content">
      <div className="turn">
        <h1>{person.name}, it's your turn</h1>
        {format === "audio" && <AudioTurn name={person.name} />}
      </div>
      <div className="actions">
        <button type="button" className="pill pill-filled" onClick={onNext}>
          Start
        </button>
      </div>
    </main>
  );
}

function SummaryScreen({
  family,
  people,
  answers,
  onChangeFormat,
  onRestart,
}: {
  family: Family;
  people: Person[];
  answers: Record<number, Record<string, number>>;
  onChangeFormat: (f: FormatId) => void;
  onRestart: () => void;
}) {
  // Sondas con valor real numérico para contabilizar aciertos (margen <= 10 % del rango).
  const scorable = family.probes.filter((p) => truthValue(p) !== null);
  const hitsOf = (i: number) =>
    scorable.filter((p) => {
      const real = truthValue(p)!;
      const a = answers[i]?.[p.id] ?? p.input.initial;
      return Math.abs(a - real) <= 0.1 * (p.input.max - p.input.min);
    }).length;

  const clampPct = (v: number, min: number, max: number) =>
    Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  return (
    <main className="content">
      <h1>Summary</h1>

      {people.length === 1 && (
        <section className="card summary-score" style={{ marginTop: 24 }}>
          <p className="eyebrow">CLOSE GUESSES</p>
          <p className="stat-value">
            {hitsOf(0)} <span className="stat-unit">of {scorable.length}</span>
          </p>
        </section>
      )}

      <ul className="summary-list">
        {family.probes.map((p) => {
          const real = truthValue(p);
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
                  {people.map((_, i) => (
                    <span key={i} className="summary-mark summary-mark-you" style={{ left: `${clampPct(answers[i]?.[p.id] ?? p.input.initial, p.input.min, p.input.max)}%` }} />
                  ))}
                  <span className={`summary-mark summary-mark-plan tone-${p.tone}`} style={{ left: `${realPct}%` }} />
                </div>
              )}
              {people.map((person, i) => (
                <p key={person.name} className="summary-you">
                  {people.length > 1 ? person.name : "You"}: {formatValue(p.input, answers[i]?.[p.id] ?? p.input.initial)}
                </p>
              ))}
            </li>
          );
        })}
      </ul>

      <section className="other-formats">
        <h2 className="section-title">See it another way</h2>
        <div className="format-pills" role="group" aria-label="See in other formats">
          {FORMAT_ORDER.map((id) => (
            <button key={id} type="button" className="format-pill" onClick={() => onChangeFormat(id)}>
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

function CoupleScreen({
  family,
  people,
  format,
  index,
  answers,
  onNext,
}: {
  family: Family;
  people: Person[];
  format: FormatId;
  index: number;
  answers: Record<number, Record<string, number>>;
  onNext: () => void;
}) {
  const probe = family.probes[index];
  const View = FORMATS[format].Couple ?? CoupleReveal;
  const values = people.map((_, i) => answers[i]?.[probe.id] ?? probe.input.initial);
  const isLast = index >= family.probes.length - 1;
  return (
    <main className="content">
      <Progress total={family.probes.length} current={index} />
      <div className="reveal-slot">
        <View family={family} probe={probe} index={index} total={family.probes.length} people={people} values={values} />
      </div>
      <div className="actions">
        <button type="button" className="pill pill-filled" onClick={onNext}>
          {isLast ? "See the full plan" : "Next"}
        </button>
      </div>
    </main>
  );
}

const initialState: State = {
  family: null,
  people: [],
  person: 0,
  ages: [],
  formatOverride: null,
  index: 0,
  step: 0,
  phase: "age",
  answers: {},
  dir: "forward",
  history: [],
};

export default function App() {
  const [s, setS] = useState<State>(initialState);

  // Una persona: su edad. Pareja: la media de las dos.
  const formatOf = (st: State): FormatId => {
    if (st.formatOverride) return st.formatOverride;
    const ages = st.ages.length > 0 ? st.ages : [40];
    return formatForAge(Math.round(ages.reduce((a, b) => a + b, 0) / ages.length));
  };

  // Avanza a un nuevo estado guardando el actual para poder volver con la flecha.
  const go = (next: (cur: State) => Partial<State>) =>
    setS((cur) => ({ ...cur, ...next(cur), dir: "forward", history: [...cur.history, cur] }));

  // Avanza sin guardar historial (la pantalla de carga no debe quedar en la pila).
  const replace = (next: (cur: State) => Partial<State>) => setS((cur) => ({ ...cur, ...next(cur), dir: "forward" }));

  const back = () =>
    setS((cur) => {
      const prev = cur.history[cur.history.length - 1];
      if (!prev) return cur;
      // Se conservan las respuestas y edades más recientes.
      return { ...prev, answers: cur.answers, ages: cur.ages, dir: "back" };
    });

  const pickFamily = (family: Family) => {
    const people = peopleOf(family);
    setS({ ...initialState, family, people, ages: people.map((p) => p.age), phase: people.length > 1 ? "turn" : "age", history: [initialState] });
  };

  const restart = () => setS({ ...initialState, dir: "back" });

  const confirmAge = () => go(() => ({ phase: "ask", index: 0 }));

  const nextQuestion = () =>
    go((cur) => {
      const family = cur.family!;
      const p = family.probes[cur.index];
      const mine = { ...(cur.answers[cur.person] ?? {}) };
      mine[p.id] = mine[p.id] ?? p.input.initial;
      const answers = { ...cur.answers, [cur.person]: mine };
      if (cur.index < family.probes.length - 1) return { answers, index: cur.index + 1 };
      if (cur.person < cur.people.length - 1) return { answers, person: cur.person + 1, phase: "turn" as Phase, index: 0 };
      return { answers, person: 0, phase: "loading" as Phase, index: 0 };
    });

  const afterLoading = () =>
    replace((cur) => (cur.people.length > 1 ? { phase: "couple", index: 0, step: 0 } : { phase: "analysis", step: 0 }));

  const nextCouple = () =>
    go((cur) => (cur.index < cur.family!.probes.length - 1 ? { index: cur.index + 1 } : { phase: "analysis" as Phase, step: 0 }));

  const nextStep = () =>
    go((cur) => {
      const pages = analysisPages(cur.family!, cur.people.length > 1).length;
      if (cur.step < pages - 1) return { step: cur.step + 1 };
      return { phase: "done" as Phase };
    });

  const startTurn = () => go(() => ({ phase: "age" as Phase }));

  const changeFormat = (format: FormatId) =>
    go((cur) => ({ formatOverride: format, person: 0, index: 0, step: 0, phase: (cur.people.length > 1 ? "couple" : "analysis") as Phase }));

  const family = s.family;
  const format = formatOf(s);
  const screenKey = family ? `${s.phase}-${family.id}-${s.person}-${s.phase === "analysis" ? s.step : s.index}-${format}` : "family";
  const probe = family?.probes[s.index];
  const answers = s.answers[s.person] ?? {};

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={back} disabled={!family || s.history.length === 0} />
      </header>
      <div key={screenKey} className={`screen dir-${s.dir}`}>
        {!family ? (
          <FamilyScreen onPick={pickFamily} />
        ) : s.phase === "turn" ? (
          <TurnScreen person={s.people[s.person]} format={format} onNext={startTurn} />
        ) : s.phase === "age" ? (
          <AgeScreen value={s.ages[s.person]} onChange={(age) => setS((cur) => ({ ...cur, ages: cur.ages.map((a, i) => (i === cur.person ? age : a)) }))} onNext={confirmAge} />
        ) : s.phase === "loading" ? (
          <LoadingScreen onDone={afterLoading} />
        ) : s.phase === "analysis" ? (
          <AnalysisScreen family={family} format={format} step={s.step} answers={answers} couple={s.people.length > 1} onNext={nextStep} />
        ) : s.phase === "couple" ? (
          <CoupleScreen family={family} people={s.people} format={format} index={s.index} answers={s.answers} onNext={nextCouple} />
        ) : s.phase === "done" ? (
          <SummaryScreen family={family} people={s.people} answers={s.answers} onChangeFormat={changeFormat} onRestart={restart} />
        ) : probe ? (
          <QuestionScreen
            family={family}
            index={s.index}
            format={format}
            value={answers[probe.id] ?? probe.input.initial}
            onChange={(v) =>
              setS((cur) => ({ ...cur, answers: { ...cur.answers, [cur.person]: { ...(cur.answers[cur.person] ?? {}), [family.probes[cur.index].id]: v } } }))
            }
            onNext={nextQuestion}
          />
        ) : null}
      </div>
    </div>
  );
}
