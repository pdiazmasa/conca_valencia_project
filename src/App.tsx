import { useState } from "react";
import { FAMILIES, formatValue, type Family } from "./data";

type Dir = "forward" | "back";
type State = {
  family: Family | null;
  index: number;
  answers: Record<string, number>;
  dir: Dir;
};

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="back"
      onClick={onClick}
      disabled={disabled}
      aria-label="Volver"
    >
      <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
        <path
          d="M10 2 2 10l8 8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function FamilyScreen({ onPick }: { onPick: (f: Family) => void }) {
  return (
    <main className="content">
      <p className="eyebrow">Same Page</p>
      <h1>¿A qué familia perteneces?</h1>
      <ul className="family-list">
        {FAMILIES.map((f) => (
          <li key={f.id}>
            <button type="button" className="family-row" onClick={() => onPick(f)}>
              <span>{f.name}</span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                <path
                  d="m1 1 6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
  value,
  onChange,
  onNext,
}: {
  family: Family;
  index: number;
  value: number;
  onChange: (v: number) => void;
  onNext: () => void;
}) {
  const probe = family.probes[index];
  const { input } = probe;
  const pct = ((value - input.min) / (input.max - input.min)) * 100;
  return (
    <main className="content">
      <p className="eyebrow">
        {family.name} · {index + 1} de {family.probes.length}
      </p>
      <h1 className="question">{probe.question}</h1>
      <p className="value" aria-live="polite">
        {formatValue(input, value)}
      </p>
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
      <button type="button" className="pill pill-filled" onClick={onNext}>
        Continuar
      </button>
      <p className="footnote">Según tu plan. Son proyecciones, no certezas.</p>
      <div className="dots" aria-hidden="true">
        {family.probes.map((p, i) => (
          <span key={p.id} className={i === index ? "dot active" : "dot"} />
        ))}
      </div>
    </main>
  );
}

export default function App() {
  const [s, setS] = useState<State>({ family: null, index: 0, answers: {}, dir: "forward" });

  const pickFamily = (family: Family) =>
    setS({ family, index: 0, answers: {}, dir: "forward" });

  const back = () =>
    setS((cur) => {
      if (!cur.family) return cur;
      if (cur.index === 0) return { ...cur, family: null, dir: "back" };
      return { ...cur, index: cur.index - 1, dir: "back" };
    });

  const next = () =>
    setS((cur) => {
      if (!cur.family) return cur;
      // Por ahora, la última pregunta no avanza a ninguna pantalla nueva.
      if (cur.index >= cur.family.probes.length - 1) return cur;
      return { ...cur, index: cur.index + 1, dir: "forward" };
    });

  const screenKey = s.family ? `q-${s.family.id}-${s.index}` : "family";

  return (
    <div className="app">
      <header className="topbar">
        <BackButton onClick={back} disabled={!s.family} />
      </header>
      <div key={screenKey} className={`screen dir-${s.dir}`}>
        {s.family ? (
          <QuestionScreen
            family={s.family}
            index={s.index}
            value={s.answers[s.family.probes[s.index].id] ?? s.family.probes[s.index].input.initial}
            onChange={(v) =>
              setS((cur) => ({
                ...cur,
                answers: { ...cur.answers, [s.family!.probes[cur.index].id]: v },
              }))
            }
            onNext={next}
          />
        ) : (
          <FamilyScreen onPick={pickFamily} />
        )}
      </div>
    </div>
  );
}
