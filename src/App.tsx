import { useEffect, useMemo, useRef, useState } from "react";
import { ANALYSIS, FAMILIES, SECTION_OF_PROBE, formatValue, peopleOf, type Family, type Person } from "./data";
import { FORMATS, formatForAge, type FormatId } from "./formats";
import { DashboardPage } from "./formats/DashboardPage";
import type { AnalysisPage } from "./formats/types";
import { StatValue } from "./formats/Dashboard";
import { AudioTurn } from "./formats/Audio";
import { WrappedTurn } from "./formats/Wrapped";
import { CoupleContext, CoupleRevealAdapter, type CoupleData } from "./analysis/CoupleReveal";
import LoadingScreen from "./LoadingScreen";
import { NextStepsScreen } from "./NextSteps";
import { Brand } from "./brand/Brand";
import { StoryProgress } from "./story/StoryProgress";
import { StoryPeeks, type Peek } from "./story/StoryPeek";
import { FormatChooser } from "./finale/FormatChooser";
import { FamilyCards } from "./finale/FamilyCards";

type Dir = "forward" | "back";
// turn: "X, responde" (solo con varias personas) · age: edad (decide el formato) · ask: preguntas de intuición ·
// loading: carga corta · analysis: plan completo (en pareja, cada sección enseña a la vez lo que pensaba cada uno,
// si coinciden y la realidad) · done: resumen · steps: próximos pasos (lo último)
type Phase = "turn" | "age" | "ask" | "loading" | "analysis" | "done" | "steps";
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
  choices: Record<number, number>; // primer paso elegido por cada persona (posición en los pasos del plan)
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
      <FamilyCards onPick={onPick} />
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
  people,
  allAnswers,
  onNext,
  onBack,
}: {
  family: Family;
  format: FormatId;
  step: number;
  people: Person[];
  allAnswers: Record<number, Record<string, number>>;
  onNext: () => void;
  onBack?: () => void;
}) {
  const pages = analysisPages(family);
  const page = pages[step];
  const def = FORMATS[format];
  const Page = def.Page ?? DashboardPage;
  const couple = people.length > 1;
  // En pareja la misma página enseña, para cada aspecto, lo que pensaba cada uno, si coinciden y el plan.
  const coupleData = useMemo<CoupleData | null>(
    () => (couple ? { people, answers: allAnswers, order: pages.flatMap((pg) => (pg.kind === "section" ? pg.probes.map((p) => p.id) : [])) } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [couple, people, allAnswers, family.id],
  );
  // Wrapped se ve como historias de Instagram: pantalla completa en móvil y barras que se llenan tarjeta a tarjeta.
  // Sin botón Next: se pasa de historia al tocar después de la última tarjeta (evento "samepage:story-end").
  const story = format === "wrapped";
  const ended = useRef(false);
  const next = useRef(onNext);
  next.current = onNext;
  useEffect(() => {
    ended.current = false;
    if (!story) return;
    const on = () => {
      if (ended.current) return;
      ended.current = true;
      next.current();
    };
    window.addEventListener("samepage:story-end", on);
    return () => window.removeEventListener("samepage:story-end", on);
  }, [story, step]);
  if (!page) return null;
  // Wrapped en PC: las historias de antes y de después se ven a los lados, pequeñas y difuminadas (src/story/StoryPeek).
  const peeks: Peek[] = story
    ? [-2, -1, 1, 2]
        .filter((o) => pages[step + o])
        .map((o) => {
          const pg = pages[step + o];
          return {
            offset: o,
            label: pg.kind === "cover" ? "Your score" : pg.section.title,
            onOpen: o === -1 ? onBack : o === 1 ? onNext : undefined,
            node: (
              <CoupleContext.Provider value={coupleData}>
                <Page family={family} analysis={ANALYSIS[family.id]} page={pg} answers={allAnswers[0] ?? {}} Reveal={couple ? CoupleRevealAdapter : def.Reveal} />
              </CoupleContext.Provider>
            ),
          };
        })
    : [];
  return (
    <main className={`content${story ? " is-story" : ""}`}>
      {story && <StoryPeeks peeks={peeks} />}
      {story ? <StoryProgress total={pages.length} current={step} /> : <Progress total={pages.length} current={step} />}
      <div className={`reveal-slot${couple ? " is-couple" : ""}`}>
        <CoupleContext.Provider value={coupleData}>
          <Page family={family} analysis={ANALYSIS[family.id]} page={page} answers={allAnswers[0] ?? {}} Reveal={couple ? CoupleRevealAdapter : def.Reveal} />
        </CoupleContext.Provider>
      </div>
      {!story && (
        <div className="actions">
          <button type="button" className="pill pill-filled" onClick={onNext}>
            {step >= pages.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      )}
    </main>
  );
}

function TurnScreen({ person, people, index, format, onNext }: { person: Person; people: Person[]; index: number; format: FormatId; onNext: () => void }) {
  // A partir de la segunda persona hay primero una pantalla de relevo ("Waiting for X") y después la suya ("X, it's your turn").
  const [passed, setPassed] = useState(false);
  const relay = index > 0 && !passed;
  const prevName = index > 0 ? people[index - 1].name.split(" ")[0] : "";
  const nowName = person.name.split(" ")[0];
  return (
    <main className="content">
      {format !== "audio" ? (
        <WrappedTurn people={people} index={index} stage={relay ? "wait" : "turn"} />
      ) : (
        <div className="turn">
          <h1>{relay ? `Waiting for ${nowName}` : `${person.name}, it's your turn`}</h1>
          {relay && (
            <p style={{ marginTop: 14, color: "#6b6b6b", fontSize: 17, lineHeight: 1.4, maxWidth: 520 }}>
              {prevName}, your answers are saved. When {nowName} finishes, you'll see together where you agree, where you don't, and what the plan says.
            </p>
          )}
          {format === "audio" && !relay && <AudioTurn name={person.name} />}
        </div>
      )}
      <div className="actions">
        <button type="button" className="pill pill-filled" onClick={relay ? () => setPassed(true) : onNext}>
          Start
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
  choices: {},
  dir: "forward",
  history: [],
};

export default function App() {
  const [s, setS] = useState<State>(initialState);
  // El contenido no sale hasta que el logo de arranque ha llegado a su sitio.
  const [ready, setReady] = useState(false);

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
      // Se conservan las respuestas, edades y pasos elegidos más recientes.
      return { ...prev, answers: cur.answers, ages: cur.ages, choices: cur.choices, dir: "back" };
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

  const afterLoading = () => replace(() => ({ phase: "analysis" as Phase, step: 0 }));

  const nextStep = () =>
    go((cur) => {
      const pages = analysisPages(cur.family!).length;
      if (cur.step < pages - 1) return { step: cur.step + 1 };
      return { phase: "done" as Phase };
    });

  const startTurn = () => go(() => ({ phase: "age" as Phase }));

  const changeFormat = (format: FormatId) =>
    go(() => ({ formatOverride: format, person: 0, index: 0, step: 0, phase: "analysis" as Phase }));

  useEffect(() => {
    const handleNextSteps = () => {
      if (s.family && s.phase === "analysis") {
        go(() => ({ phase: "steps" as Phase }));
      }
    };
    window.addEventListener("samepage:next-steps", handleNextSteps);
    return () => window.removeEventListener("samepage:next-steps", handleNextSteps);
  }, [s.family, s.phase]);

  const family = s.family;
  const format = formatOf(s);
  const screenKey = family ? `${s.phase}-${family.id}-${s.person}-${s.phase === "analysis" ? s.step : s.index}-${format}` : "family";
  const probe = family?.probes[s.index];
  const answers = s.answers[s.person] ?? {};

  return (
    <div className="app">
      <Brand onLanded={() => setReady(true)} away={s.phase === "loading"} />
      <header className="topbar">
        <BackButton onClick={back} disabled={!family || s.history.length === 0} />
      </header>
      {ready && (
      <div key={screenKey} className={`screen dir-${s.dir}`}>
        {!family ? (
          <FamilyScreen onPick={pickFamily} />
        ) : s.phase === "turn" ? (
          <TurnScreen person={s.people[s.person]} people={s.people} index={s.person} format={format} onNext={startTurn} />
        ) : s.phase === "age" ? (
          <AgeScreen value={s.ages[s.person]} onChange={(age) => setS((cur) => ({ ...cur, ages: cur.ages.map((a, i) => (i === cur.person ? age : a)) }))} onNext={confirmAge} />
        ) : s.phase === "loading" ? (
          <LoadingScreen onDone={afterLoading} />
        ) : s.phase === "analysis" ? (
          <AnalysisScreen family={family} format={format} step={s.step} people={s.people} allAnswers={s.answers} onNext={nextStep} onBack={back} />
        ) : s.phase === "done" ? (
          <FormatChooser current={format} onChangeFormat={changeFormat} onNextSteps={() => go(() => ({ phase: "steps" as Phase }))} />
        ) : s.phase === "steps" ? (
          <NextStepsScreen
            family={family}
            people={s.people}
            choices={s.choices}
            onChoose={(person, move) => setS((cur) => ({ ...cur, choices: { ...cur.choices, [person]: move } }))}
            onRestart={restart}
          />
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
      )}
    </div>
  );
}
