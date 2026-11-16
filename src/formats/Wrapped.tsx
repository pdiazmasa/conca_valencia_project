import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { formatValue, revealContext, truthValue, type Analysis, type Probe } from "../data";
import { useTween } from "../charts/useTween";
import type { PageProps, RevealProps } from "./types";
import { useCouple } from "../analysis/CoupleReveal";
import { CoverStory, WrappedStory } from "./WrappedStory";
import "./wrapped.css";

// Formato "Wrapped" (0–29 años): tarjetas a pantalla casi completa, un número por tarjeta,
// tipografía enorme y color por tono. Se avanza tocando (o con flechas / Enter).
// Secuencia por sonda: tu respuesta → cifra real (cuenta animada) → qué significa.
// Las animaciones expresan algo: la cuenta parte de TU respuesta y llega a la real (la dirección
// del movimiento es el error), y la última tarjeta reacciona a lo cerca que estuviste.

const LAST_STEP = 2;

const toneLabel = {
  good: "Good news",
  bad: "Needs attention",
  neutral: "Good to know",
} satisfies Record<Probe["tone"], string>;

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// "73 years old" -> ["73", "years old"]; "$1,200" -> ["$1,200", ""].
function splitValue(text: string): [string, string] {
  const m = text.match(/^(.*?)\s(\S.*)$/);
  return m ? [m[1], m[2]] : [text, ""];
}

type Verdict = { label: string; fx: "nailed" | "near" | "surprise" };

// Misma vara que el resumen de App: acierto si la diferencia es <= 10 % del rango.
function closeness(probe: Probe, answer: number, real: number | null): Verdict | null {
  if (real === null) return null;
  const gap = Math.abs(answer - real) / (probe.input.max - probe.input.min);
  if (gap <= 0.1) return { label: "Nailed it", fx: "nailed" };
  if (gap <= 0.25) return { label: "Not far off", fx: "near" };
  return { label: "Big surprise", fx: "surprise" };
}

function BigValue({ text }: { text: string }) {
  const [n, unit] = splitValue(text);
  return (
    <p className="wr-value">
      <span className="wr-num">{n}</span>
      {unit && <span className="wr-unit">{unit}</span>}
    </p>
  );
}

// Se monta solo al llegar a la tarjeta de la cifra real, así la cuenta arranca entonces.
// La cifra y la marca "Plan" salen de TU respuesta y se mueven juntas hasta la real.
function CountUp({ probe, you, from, to }: { probe: Probe; you: number; from: number; to: number }) {
  const { v } = useTween(from, to, { duration: 1200, delay: 250 });
  const { min, max } = probe.input;
  const pct = (x: number) => Math.min(100, Math.max(0, ((x - min) / (max - min)) * 100));
  return (
    <>
      <BigValue text={formatValue(probe.input, v)} />
      <div className="wr-rail" aria-hidden="true">
        <span className="wr-rail-track" />
        <span className="wr-mark wr-mark-you" style={{ left: `${pct(you)}%` }}>
          <em>You</em>
        </span>
        <span className="wr-mark wr-mark-plan" style={{ left: `${pct(v)}%` }}>
          <em>Plan</em>
        </span>
      </div>
    </>
  );
}

// Destello de confeti para "Nailed it": 16 piezas con ángulo fijo (sin azar, siempre igual).
function Confetti() {
  return (
    <div className="wr-confetti" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} style={{ "--a": `${i * 22.5}deg`, "--d": `${90 + (i % 3) * 45}px`, "--i": i } as CSSProperties} />
      ))}
    </div>
  );
}

export function Wrapped({ probe, answer, index, total, animate }: RevealProps) {
  const [step, setStep] = useState(animate ? 0 : LAST_STEP);
  const [showNumbers, setShowNumbers] = useState(false);

  const real = truthValue(probe);
  const context = revealContext(probe);
  const answerText = formatValue(probe.input, answer);
  const realText = real === null ? null : formatValue(probe.input, real);
  const verdict = closeness(probe, answer, real);

  const go = (delta: number) => setStep((s) => Math.min(LAST_STEP, Math.max(0, s + delta)));

  // Tocar el 30 % izquierdo retrocede; el resto avanza.
  const onTap = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX - r.left < r.width * 0.3 ? -1 : 1);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // no robar teclas a los botones internos
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  return (
    <article
      className={`wrapped wr-card wr-${probe.tone} ${animate ? "" : "is-static"}`}
      aria-label={`Recap for question ${index + 1} of ${total}`}
    >
      <div className="wr-blobs" aria-hidden="true" />

      <div className="wr-stage" role="group" tabIndex={0} onClick={onTap} onKeyDown={onKey} aria-live="polite">
        <div className="wr-top">
          <span className="wr-count">
            {index + 1} / {total}
          </span>
          <div className="wr-dots" aria-hidden="true">
            {Array.from({ length: LAST_STEP + 1 }, (_, i) => (
              <span key={i} className={`wr-dot ${i === step ? "is-on" : ""}`} />
            ))}
          </div>
        </div>

        <div className={`wr-body ${step === LAST_STEP && verdict ? `wr-fx-${verdict.fx}` : ""}`} key={step}>
          {step === 0 && (
            <>
              <p className="wr-eyebrow">You said</p>
              <BigValue text={answerText} />
              <p className="wr-question">{probe.question}</p>
            </>
          )}

          {step === 1 && (
            <>
              <p className="wr-eyebrow">But your plan says</p>
              {realText === null || real === null ? (
                <p className="wr-value wr-never">Your savings never run out</p>
              ) : (
                <CountUp probe={probe} you={answer} from={animate ? answer : real} to={real} />
              )}
              <div className="wr-chips">
                <span className="wr-badge">{toneLabel[probe.tone]}</span>
                {real !== null && real !== answer && (
                  <span className="wr-badge wr-dirchip">
                    {real < answer ? "Lower than you thought" : "Higher than you thought"}
                  </span>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {verdict && <span className="wr-badge wr-verdict">{verdict.label}</span>}
              {verdict?.fx === "nailed" && <Confetti />}
              <p className="wr-eyebrow">What it means</p>
              <p className="wr-meaning">{context || (realText ? `Your plan says ${realText}.` : "")}</p>
            </>
          )}
        </div>

        <p className="wr-hint" aria-hidden="true">
          {step < LAST_STEP ? "Tap to continue" : "Tap the left side to go back"}
        </p>
      </div>

      <div className="wr-foot">
        <button
          type="button"
          className="wr-link"
          aria-expanded={showNumbers}
          onClick={() => setShowNumbers((v) => !v)}
        >
          {showNumbers ? "Hide the numbers" : "Show me the numbers"}
        </button>
        {showNumbers && (
          <dl className="wr-numbers">
            <dt>Question</dt>
            <dd>{probe.question}</dd>
            <dt>You said</dt>
            <dd>{answerText}</dd>
            <dt>Your plan says</dt>
            <dd>{realText ?? "Your savings never run out"}</dd>
            {context && (
              <>
                <dt>Detail</dt>
                <dd>{context}</dd>
              </>
            )}
          </dl>
        )}
      </div>
    </article>
  );
}

// Formas de la pantalla de arranque, definidas en polares (radio según el ángulo). La figura va
// pasando de una a otra: círculo, flor, estrella y estallido.
type Shape = (th: number) => number;
const TAU = Math.PI * 2;
const spikes = (th: number, k: number) => Math.abs(2 * (((th / TAU) * k) % 1) - 1); // 1 en la punta, 0 en el valle
const SHAPES: Shape[] = [
  () => 0.36,
  (th) => 0.31 + 0.1 * Math.cos(6 * th),
  (th) => 0.2 + 0.26 * spikes(th, 5),
  (th) => 0.15 + 0.32 * Math.pow(spikes(th, 12), 1.8),
];
// Rojo, azul, verde (más claro) y amarillo: un color por forma.
const SHAPE_COLORS: [number, number, number][] = [
  [255, 59, 59],
  [59, 107, 255],
  [60, 230, 140],
  [255, 216, 74],
];
const HOLD = 1.3; // segundos por forma
const MORPH = 0.55; // de esos, lo que tarda en transformarse a la siguiente

// Estado de la figura en el instante t (s): contorno, color y giro.
function shapeFrame(t: number) {
  const last = SHAPES.length - 1;
  const s = t / HOLD;
  const i = Math.min(last, Math.floor(s));
  const m0 = 1 - MORPH / HOLD;
  const raw = i >= last ? 0 : Math.min(1, Math.max(0, (s - i - m0) / (1 - m0)));
  const m = raw * raw * (3 - 2 * raw); // suavizado
  const size = 1 + 0.045 * Math.sin(2.2 * t);
  const N = 160;
  const pts: string[] = [];
  for (let k = 0; k < N; k++) {
    const th = (k / N) * TAU;
    const r0 = SHAPES[i](th);
    const r1 = i < last ? SHAPES[i + 1](th) : r0;
    const rr = Math.min(0.495, (r0 + (r1 - r0) * m) * size);
    pts.push(`${(50 + 100 * rr * Math.cos(th)).toFixed(2)}% ${(50 + 100 * rr * Math.sin(th)).toFixed(2)}%`);
  }
  const c0 = SHAPE_COLORS[i];
  const c1 = i < last ? SHAPE_COLORS[i + 1] : c0;
  const rgb = c0.map((v, k) => Math.round(v + (c1[k] - v) * m)).join(",");
  return { clip: `polygon(${pts.join(",")})`, rgb, turn: (t * 34) % 360 };
}

// Pantalla de arranque: sobre negro, una figura plana que se transforma (círculo, flor, estrella,
// estallido) cambiando de color mientras gira; al final se encoge hasta ser un punto y desaparece. Sale
// una sola vez, al entrar al Wrapped (portada). Se salta tocando; sin animación si el sistema pide
// reducir movimiento.
function Intro() {
  const [phase, setPhase] = useState<"show" | "out" | "gone">(() => (reducedMotion() ? "gone" : "show"));
  const shapeRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const alive = phase !== "gone";

  useEffect(() => {
    if (phase === "show") {
      const t = window.setTimeout(() => setPhase("out"), 5200);
      return () => window.clearTimeout(t);
    }
    if (phase === "out") {
      const t = window.setTimeout(() => setPhase("gone"), 1500);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  // La figura se recalcula en cada fotograma (sin re-renderizar React).
  useEffect(() => {
    if (!alive) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const f = shapeFrame((now - t0) / 1000);
      if (shapeRef.current) {
        shapeRef.current.style.clipPath = f.clip;
        shapeRef.current.style.background = `rgb(${f.rgb})`;
        shapeRef.current.style.transform = `rotate(${f.turn.toFixed(1)}deg)`;
      }
      if (glowRef.current) glowRef.current.style.filter = `drop-shadow(0 0 34px rgba(${f.rgb},0.55))`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alive]);

  if (phase === "gone") return null;
  return (
    <div
      className={`wrapped wr-intro ${phase === "out" ? "is-out" : ""}`}
      role="status"
      onClick={() => setPhase((p) => (p === "show" ? "out" : p))}
    >
      <div className="wr-orb-wrap" aria-hidden="true">
        <div className="wr-glow" ref={glowRef}>
          <div className="wr-orb" ref={shapeRef} style={{ background: "rgb(255,59,59)" }} />
        </div>
      </div>
      <p className="wr-intro-text">Your plan, wrapped.</p>
      <p className="wr-intro-skip">Tap to skip</p>
    </div>
  );
}

// Color de la portada según la puntuación: rojo si es baja, verde si es alta, índigo en medio.
function scoreTone(v: number): "bad" | "neutral" | "good" {
  return v < 40 ? "bad" : v < 70 ? "neutral" : "good";
}

// Anillo con la puntuación: se llena y la cifra sube de 0 al valor.
function ScoreRing({ value }: { value: number }) {
  const { v } = useTween(0, value, { duration: 1500, delay: 300 });
  const C = 2 * Math.PI * 84;
  return (
    <div className="wr-ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="wr-ring-track" cx="100" cy="100" r="84" />
        <circle
          className="wr-ring-fill"
          cx="100"
          cy="100"
          r="84"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(100, Math.max(0, v)) / 100)}
        />
      </svg>
      <div className="wr-ring-num">
        <span className="wr-score">{Math.round(v)}</span>
        <span className="wr-of">/ 100</span>
      </div>
    </div>
  );
}

// Fila de un área: la barra se llena al entrar y su color depende de la nota.
function PillarRow({ name, score, index }: { name: string; score: number; index: number }) {
  const { v } = useTween(0, score, { duration: 900, delay: 350 + index * 120 });
  const level = score < 35 ? "low" : score < 65 ? "mid" : "high";
  return (
    <li className="wr-pillar">
      <div className="wr-pillar-head">
        <span>{name}</span>
        <span className="wr-pillar-score">{score}</span>
      </div>
      <div className="wr-pillar-track">
        <span className={`wr-pillar-fill is-${level}`} style={{ width: `${v}%` }} />
      </div>
    </li>
  );
}

// Portada del análisis en Wrapped: mismo contenido que la de Dashboard (puntuación, notas por área y
// próximos pasos), presentado en tarjetas de color.
export function WrappedCover({ analysis }: { analysis: Analysis }) {
  const s = analysis.score;
  return (
    <div className="a-cover">
      <section className={`wrapped wr-card wr-hero wr-${scoreTone(s.value)}`}>
        <div className="wr-blobs" aria-hidden="true" />
        <div className="wr-hero-in">
          <p className="wr-eyebrow">Your financial health</p>
          <ScoreRing value={s.value} />
          <span className="wr-badge">{s.band}</span>
          <p className="wr-glass">{s.message}</p>
        </div>
      </section>

      <section className="wrapped wr-panel wr-dark">
        <p className="wr-eyebrow">Score by area</p>
        <ul className="wr-pillars">
          {s.pillars.map((p, i) => (
            <PillarRow key={p.name} name={p.name} score={p.score} index={i} />
          ))}
        </ul>
      </section>

      {s.moves.length > 0 && (
        <section className="wrapped wr-panel wr-violet">
          <p className="wr-eyebrow">Best next steps</p>
          <ol className="wr-moves">
            {s.moves.map((m, i) => (
              <li key={m.title}>
                <span className="wr-step">{i + 1}</span>
                <span>
                  <b>{m.title}.</b> {m.action}
                </span>
              </li>
            ))}
          </ol>
          {s.combined && (
            <p className="wr-glass wr-combined">
              Doing {s.combined.moves.length === 1 ? "it" : "all of them"} could lift your score to{" "}
              <b>{s.combined.scoreAfter}</b>.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

// Página del análisis para Wrapped. La portada es la tarjeta de puntuación con la pantalla de arranque
// encima; las secciones muestran las tarjetas Wrapped a todo el ancho (sin el recuadro blanco).
export function WrappedPage(props: PageProps) {
  const { family, analysis, page, answers } = props;
  const couple = useCouple();

  if (page.kind === "cover") {
    return (
      <>
        <Intro />
        <CoverStory analysis={analysis} hasMore={false} />
      </>
    );
  }

  const { section, probes } = page;
  // En pareja cada uno ha respondido por su cuenta: la historia enseña dónde coinciden y qué dice el plan,
  // y al final de la última sección sale el resumen de todas las preguntas.
  const last = analysis.sections[analysis.sections.length - 1]?.id === section.id;
  return (
    <div className="a-section">
      <WrappedStory key={section.id} section={section} probes={probes} answers={answers} hasMore={false} couple={couple} recap={couple && last ? family.probes : undefined} />
    </div>
  );
}


// Pantalla de turno de la pareja: quién ya ha respondido y a quién le toca. Al terminar los dos se ve el resultado.
export function WrappedTurn({ people, index }: { people: { name: string }[]; index: number }) {
  const first = (n: string) => n.split(" ")[0];
  const now = people[index];
  const prev = index > 0 ? people[index - 1] : null;
  return (
    <div className="wt">
      <div className="wt-lab">{people.map((x) => first(x.name)).join(" & ")}</div>
      <div className="wt-row">
        {people.map((x, i) => (
          <div key={x.name} className="wt-p">
            <div className={`wt-av${i < index ? " done" : i === index ? " now" : ""}`}>{first(x.name)[0]}</div>
            {i < index ? <span className="wt-done">✓ Done</span> : i === index ? <span>Your turn</span> : <span style={{ opacity: 0.6 }}>Waiting</span>}
          </div>
        ))}
      </div>
      <h1 className="wt-h">{prev ? `Waiting for ${first(now.name)}` : `${first(now.name)}, it's your turn`}</h1>
      <p className="wt-t">
        {prev
          ? `${first(prev.name)}, your answers are saved. When ${first(now.name)} finishes, you'll see together where you agree, where you don't, and what the plan says.`
          : "You each answer on your own. When you've both finished, you'll see together where you agree, where you don't, and what the plan says."}
      </p>
      {prev && (
        <div className="wt-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}
