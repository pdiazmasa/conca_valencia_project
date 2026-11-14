import { useState } from "react";
import { FAMILIES, formatValue, truthValue, type Family, type Probe } from "./data";
import { FORMATS, FORMAT_ORDER, type FormatId } from "./formats";
import { QUIZ, pickFormat } from "./formats/quiz";
import { StatValue, toneLabel } from "./formats/Directo";

type Dir = "forward" | "back";
// quiz: test de 3 pasos · format: formato asignado · ask: deslizador · reveal: respuesta frente al plan · done: resumen final
type Phase = "quiz" | "format" | "ask" | "reveal" | "done";
type State = {
  family: Family | null;
  quizIndex: number;
  quizAnswers: Record<string, FormatId>;
  format: FormatId;
  index: number;
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
      <p className="eyebrow">Same Page</p>
      <h1 style={{ marginTop: 8 }}>Who are you?</h1>
      <p className="lede">Choose your family to get started.</p>
      <ul className="family-list card card-list">
        {FAMILIES.map((f) => (
          <li key={f.id}>
            <button type="button" className="family-row card-row" onClick={() => onPick(f)}>
              <span className="avatar">{initials(f.name)}</span>
              <span className="row-main">
                <span className="row-title" style={{ display: "block" }}>
                  {f.name}
                </span>
                <span className="row-sub">{f.probes.length} questions</span>
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

function QuizScreen({
  family,
  quizIndex,
  selected,
  onPick,
}: {
  family: Family;
  quizIndex: number;
  selected?: FormatId;
  onPick: (format: FormatId) => void;
}) {
  const q = QUIZ[quizIndex];
  return (
    <main className="content">
      <p className="crumbs">
        {family.name} · <b>Step {quizIndex + 1} of {QUIZ.length}</b>
      </p>
      <h1 className="question">{q.question}</h1>
      <Progress total={QUIZ.length} current={quizIndex} />
      <ul className="family-list card card-list">
        {q.options.map((opt) => (
          <li key={opt.format}>
            <button
              type="button"
              className={`family-row card-row ${selected === opt.format ? "quiz-row-selected" : ""}`}
              onClick={() => onPick(opt.format)}
            >
              <span className="row-main">
                <span className="row-title" style={{ display: "block" }}>
                  {opt.label}
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

function FormatScreen({
  family,
  format,
  onStart,
}: {
  family: Family;
  format: FormatId;
  onStart: () => void;
}) {
  const def = FORMATS[format];
  return (
    <main className="content">
      <p className="crumbs">{family.name}</p>
      <p className="eyebrow" style={{ marginTop: 4 }}>
        Based on your answers
      </p>
      <h1 style={{ marginTop: 8 }}>Your format: {def.name}</h1>
      <p className="lede">{def.tagline}</p>

      <div className="card" style={{ marginTop: 24 }}>
        <p className="eyebrow">How it works</p>
        <p className="context" style={{ marginTop: 8 }}>
          First, you'll answer {family.probes.length} questions about your plan using your gut instinct. Then you'll see the reality in the{" "}
          <b style={{ color: "var(--ink)", fontWeight: 500 }}>{def.name}</b> format.
        </p>
      </div>

      <div className="actions">
        <button type="button" className="pill pill-filled" onClick={onStart}>
          Start
        </button>
      </div>
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
  const probe = family.probes[index];
  const { input } = probe;
  const pct = ((value - input.min) / (input.max - input.min)) * 100;
  const framing = FORMATS[format].askFraming?.(family, probe);

  return (
    <main className="content">
      <p className="crumbs">
        {family.name} · <b>{index + 1} of {family.probes.length}</b>
      </p>
      {framing && <p className="eyebrow ask-framing">{framing}</p>}
      <h1 className="question">{probe.question}</h1>
      <Progress total={family.probes.length} current={index} />
      <div className="card" style={{ marginTop: 24 }}>
        <p className="eyebrow">Your gut feeling</p>
        <div aria-live="polite" style={{ marginTop: 8 }}>
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
          See my plan
        </button>
      </div>
      <p className="footnote">Based on your plan. These are projections, not certainties.</p>
    </main>
  );
}

function RevealScreen({
  family,
  index,
  probe,
  answer,
  format,
  onNext,
  isLast,
}: {
  family: Family;
  index: number;
  probe: Probe;
  answer: number;
  format: FormatId;
  onNext: () => void;
  isLast: boolean;
}) {
  const FormatReveal = FORMATS[format].Reveal;
  return (
    <main className="content">
      <p className="crumbs">
        {family.name} · <b>{index + 1} of {family.probes.length}</b>
      </p>
      <Progress total={family.probes.length} current={index} />

      <div className="reveal-slot">
        <FormatReveal
          family={family}
          probe={probe}
          answer={answer}
          index={index}
          total={family.probes.length}
          animate={true}
        />
      </div>

      <div className="actions">
        <button type="button" className="pill pill-filled" onClick={onNext}>
          {isLast ? "See summary" : "Next question"}
        </button>
      </div>
      <p className="footnote">Based on your plan. These are projections, not certainties.</p>
    </main>
  );
}

function SummaryScreen({
  family,
  answers,
  format,
  onRestart,
}: {
  family: Family;
  answers: Record<string, number>;
  format: FormatId;
  onRestart: () => void;
}) {
  const [galleryFormat, setGalleryFormat] = useState<FormatId | null>(null);
  const otherFormats = FORMAT_ORDER.filter((id) => id !== format);

  // Sondas con valor real numérico para contabilizar aciertos (margen <= 10 % del rango).
  const scorable = family.probes.filter((p) => truthValue(p) !== null);
  const hits = scorable.filter((p) => {
    const real = truthValue(p)!;
    const a = answers[p.id] ?? p.input.initial;
    return Math.abs(a - real) <= 0.1 * (p.input.max - p.input.min);
  }).length;

  const clampPct = (v: number, min: number, max: number) =>
    Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  const GalleryReveal = galleryFormat ? FORMATS[galleryFormat].Reveal : null;

  return (
    <main className="content">
      <p className="crumbs">{family.name}</p>
      <h1>Summary</h1>
      <p className="lede">Your gut feeling vs. your plan.</p>

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
        <h2 className="section-title">See in other formats</h2>
        <p className="crumbs">
          Your format: <b>{FORMATS[format].name}</b>
        </p>
        <div className="format-pills" role="group" aria-label="See in other formats">
          {otherFormats.map((id) => (
            <button
              key={id}
              type="button"
              className={`format-pill ${galleryFormat === id ? "format-pill-active" : ""}`}
              onClick={() => setGalleryFormat(id)}
            >
              {FORMATS[id].name}
            </button>
          ))}
          <button
            type="button"
            className={`format-pill ${galleryFormat === format ? "format-pill-active" : ""}`}
            onClick={() => setGalleryFormat(format)}
          >
            {FORMATS[format].name} · <span className="format-pill-sub">Your format</span>
          </button>
        </div>

        {galleryFormat && GalleryReveal && (
          <div className="format-gallery">
            <p className="lede" style={{ marginTop: 12 }}>
              {FORMATS[galleryFormat].tagline}
            </p>
            <div className="format-gallery-list">
              {family.probes.map((p, idx) => (
                <article key={`${galleryFormat}-${p.id}`} className="format-gallery-item">
                  <GalleryReveal
                    family={family}
                    probe={p}
                    answer={answers[p.id] ?? p.input.initial}
                    index={idx}
                    total={family.probes.length}
                    animate={false}
                  />
                </article>
              ))}
            </div>
          </div>
        )}
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
  quizIndex: 0,
  quizAnswers: {},
  format: "directo",
  index: 0,
  phase: "quiz",
  answers: {},
  dir: "forward",
};

export default function App() {
  const [s, setS] = useState<State>(initialState);

  const pickFamily = (family: Family) =>
    setS({
      family,
      quizIndex: 0,
      quizAnswers: {},
      format: "directo",
      index: 0,
      phase: "quiz",
      answers: {},
      dir: "forward",
    });

  const answerQuiz = (choice: FormatId) =>
    setS((cur) => {
      if (!cur.family) return cur;
      const q = QUIZ[cur.quizIndex];
      const nextQuizAnswers = { ...cur.quizAnswers, [q.id]: choice };
      if (cur.quizIndex < QUIZ.length - 1) {
        return {
          ...cur,
          quizIndex: cur.quizIndex + 1,
          quizAnswers: nextQuizAnswers,
          dir: "forward",
        };
      }
      return {
        ...cur,
        quizAnswers: nextQuizAnswers,
        format: pickFormat(nextQuizAnswers),
        phase: "format",
        dir: "forward",
      };
    });

  const startProbes = () =>
    setS((cur) => ({
      ...cur,
      index: 0,
      phase: "ask",
      dir: "forward",
    }));

  const restart = () => setS({ ...initialState, dir: "back" });

  const back = () =>
    setS((cur) => {
      if (!cur.family) return cur;
      if (cur.phase === "done") return { ...cur, phase: "reveal", dir: "back" };
      if (cur.phase === "reveal") return { ...cur, phase: "ask", dir: "back" };
      if (cur.phase === "ask") {
        if (cur.index === 0) return { ...cur, phase: "format", dir: "back" };
        return { ...cur, index: cur.index - 1, phase: "reveal", dir: "back" };
      }
      if (cur.phase === "format") {
        return { ...cur, phase: "quiz", quizIndex: QUIZ.length - 1, dir: "back" };
      }
      // phase === "quiz"
      if (cur.quizIndex === 0) return { ...cur, family: null, dir: "back" };
      return { ...cur, quizIndex: cur.quizIndex - 1, dir: "back" };
    });

  // Fija la respuesta actual (aunque no se haya movido el deslizador) y revela.
  const reveal = () =>
    setS((cur) => {
      if (!cur.family) return cur;
      const p = cur.family.probes[cur.index];
      return {
        ...cur,
        phase: "reveal",
        answers: { ...cur.answers, [p.id]: cur.answers[p.id] ?? p.input.initial },
        dir: "forward",
      };
    });

  const next = () =>
    setS((cur) => {
      if (!cur.family) return cur;
      if (cur.index >= cur.family.probes.length - 1) return { ...cur, phase: "done", dir: "forward" };
      return { ...cur, index: cur.index + 1, phase: "ask", dir: "forward" };
    });

  const stepIndex = s.phase === "quiz" ? s.quizIndex : s.index;
  const screenKey = s.family ? `${s.phase}-${s.family.id}-${stepIndex}` : "family";
  const probe = s.family?.probes[s.index];

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={back} disabled={!s.family} />
      </header>
      <div key={screenKey} className={`screen dir-${s.dir}`}>
        {!s.family ? (
          <FamilyScreen onPick={pickFamily} />
        ) : s.phase === "quiz" ? (
          <QuizScreen
            family={s.family}
            quizIndex={s.quizIndex}
            selected={s.quizAnswers[QUIZ[s.quizIndex].id]}
            onPick={answerQuiz}
          />
        ) : s.phase === "format" ? (
          <FormatScreen family={s.family} format={s.format} onStart={startProbes} />
        ) : probe && s.phase === "done" ? (
          <SummaryScreen family={s.family} answers={s.answers} format={s.format} onRestart={restart} />
        ) : probe && s.phase === "reveal" ? (
          <RevealScreen
            family={s.family}
            index={s.index}
            probe={probe}
            answer={s.answers[probe.id] ?? probe.input.initial}
            format={s.format}
            onNext={next}
            isLast={s.index >= s.family.probes.length - 1}
          />
        ) : probe ? (
          <QuestionScreen
            family={s.family}
            index={s.index}
            format={s.format}
            value={s.answers[probe.id] ?? probe.input.initial}
            onChange={(v) =>
              setS((cur) => ({
                ...cur,
                answers: { ...cur.answers, [s.family!.probes[cur.index].id]: v },
              }))
            }
            onNext={reveal}
          />
        ) : null}
      </div>
    </div>
  );
}
