import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from "react";
import { agreeOn, coupleOutcome, coupleText, formatStat, formatValue, revealContext, truthValue, type Analysis, type Probe, type ProbeInput, type Section, type Stat } from "../data";
import type { CoupleData } from "../analysis/CoupleReveal";
import { formatCompactUSD } from "../charts/LineChart";
import "./wrappedStory.css";

// Wrapped en modo "historia" (0–29 años): una sección entera como pantallas a todo el alto, una idea por pantalla.
// Cabecera de la sección → por cada pregunta: "You said" (tu respuesta) → "Your plan says" (cifra real en un dial)
// → cuánto te desviaste. Poco texto: el detalle completo va en el panel "Show me the numbers".
// Se dibuja en un lienzo fijo de 360×640 que se escala al ancho disponible.

const W = 360;
const H = 640;
const C = 2 * Math.PI * 100;
const DIAL_TOP = 346; // el dial empieza aquí (debe coincidir con .ws-dial en el css)

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const delay = (s: string) => ({ "--d": s }) as CSSProperties;
const fit = (len: number, base: number, width: number) => Math.min(base, width / (Math.max(len, 1) * 0.48));

type Tone = Probe["tone"];
// Textos opcionales para reutilizar las pantallas con cifras que no son preguntas.
type Extra = { lab?: string; said?: string; vs?: string; verdict?: string; unitLabel?: string };
type Pal = { bg: string; band: string; accent: string; ink: string; cap: string; cap2: string; gapMid: string; gapDark: string; ring: string };

// Un color por tono, como en las tarjetas actuales: rojo/naranja = atención, verde = buena noticia, violeta = a tener en cuenta.
const PAL: Record<Tone, Pal> = {
  bad: { bg: "#ff4d17", band: "#e23c08", accent: "#ffc21a", ink: "#150a06", cap: "#ff6a3d,#b3141f 55%,#3a0a14", cap2: "#ff3d6e,#8a0f3a 55%,#2a0620", gapMid: "#c2410c", gapDark: "#2b0a03", ring: "#ffc21a" },
  good: { bg: "#0fa968", band: "#0b8a53", accent: "#ffe14a", ink: "#04140c", cap: "#34d399,#0a7a55 55%,#032e21", cap2: "#22d3ee,#0e6b73 55%,#042a30", gapMid: "#0f766e", gapDark: "#03201e", ring: "#5eead4" },
  neutral: { bg: "#5b3df5", band: "#4529d6", accent: "#ffd84a", ink: "#0d0826", cap: "#8b5cf6,#4c1d95 55%,#1a0b3b", cap2: "#ec4899,#7e1d6a 55%,#2a0a2a", gapMid: "#4c1d95", gapDark: "#120733", ring: "#c4b5fd" },
};

const OCEAN: Pal = { bg: "#1f3dff", band: "#1630d1", accent: "#ffd84a", ink: "#06102e", cap: "#60a5fa,#1d4ed8 55%,#0a1a5c", cap2: "#22d3ee,#0e6b73 55%,#042a30", gapMid: "#1d3fd6", gapDark: "#060b2b", ring: "#7dd3fc" };
const ROSE: Pal = { bg: "#e11d74", band: "#be185d", accent: "#ffe14a", ink: "#2a0516", cap: "#f472b6,#9d174d 55%,#3b0a24", cap2: "#fb7185,#9f1239 55%,#3a0716", gapMid: "#9d174d", gapDark: "#2a0516", ring: "#fda4cf" };
const ALT_PAL: Pal[] = [OCEAN, ROSE, PAL.good];

// "73 years old" -> ["73", "years old"]; "$1,200" -> ["$1,200", ""].
function splitValue(text: string): [string, string] {
  const m = text.match(/^(.*?)\s(\S.*)$/);
  return m ? [m[1], m[2]] : [text, ""];
}

// Formatea un número igual que la muestra (prefijo, comas, decimales, sufijo) para poder contarlo sin saltos de formato.
function numFormatter(sample: string): (v: number) => string {
  const m = sample.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m) return () => sample;
  const dec = (m[2].split(".")[1] ?? "").length;
  const comma = m[2].includes(",");
  return (v) => m[1] + (comma ? v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + m[3];
}

function tweenText(el: HTMLElement | null, fmt: (v: number) => string, from: number, to: number, wait: number, dur: number): () => void {
  if (!el) return () => {};
  if (reduced()) {
    el.textContent = fmt(to);
    return () => {};
  }
  let raf = 0;
  const t0 = performance.now() + wait;
  const f = (n: number) => {
    const p = clamp01((n - t0) / dur);
    el.textContent = fmt(from + (to - from) * easeOut(p));
    if (p < 1) raf = requestAnimationFrame(f);
  };
  raf = requestAnimationFrame(f);
  return () => cancelAnimationFrame(raf);
}

function sparks(root: HTMLElement, x: number, y: number, cols: string[], n: number) {
  if (reduced()) return;
  for (let i = 0; i < n; i++) {
    const d = document.createElement("i");
    const s = 6 + Math.random() * 8;
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 90;
    d.style.cssText = `position:absolute;z-index:4;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${Math.random() < 0.5 ? "50%" : "2px"};background:${cols[i % cols.length]}`;
    root.appendChild(d);
    d.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.2) rotate(${Math.random() * 360}deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" },
    ).onfinish = () => d.remove();
  }
}

function shake(el: HTMLElement | SVGElement | null) {
  if (!el || reduced()) return;
  el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-9px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }], { duration: 380 });
}

// Misma vara que el resto de la app: acierto si la diferencia es <= 10 % del rango.
function closeness(probe: Probe, answer: number, real: number | null): string | null {
  if (real === null) return null;
  const gap = Math.abs(answer - real) / (probe.input.max - probe.input.min);
  if (gap <= 0.1) return "Nailed it";
  if (gap <= 0.25) return "Not far off";
  return "Big surprise";
}

function Slide({ bg, fg, active, r, children }: { bg: string; fg: string; active: boolean; r: RefObject<HTMLDivElement>; children: ReactNode }) {
  return (
    <div ref={r} className={`ws-sl${active ? " go" : ""}`} style={{ background: bg, color: fg }}>
      {children}
      <div className="ws-grain" />
    </div>
  );
}

// ---- Pantallas de cifras de la sección (cabecera y datos clave) ----
type StatT = Stat;
// Las proporciones de un total se dibujan como anillo; el resto (crecimiento, vaivenes) como número grande.
const NOT_SHARE = /growth|ups and downs/i;
const isShare = (s: { kind: StatT["kind"]; label: string; value: number | string }) => s.kind === "pct" && typeof s.value === "number" && !NOT_SHARE.test(s.label);

// Texto de una cifra partido para poder contarla: "-$8,336" -> signo, prefijo, número; "58 years old" -> "58" + "years old".
function statParts(kind: StatT["kind"], value: number | string) {
  const full = formatStat(kind, value);
  const neg = full.startsWith("-");
  const text = neg ? full.slice(1) : full;
  const m = text.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (typeof value !== "number" || !m) return { big: full, small: "", fmt: null as null | ((v: number) => string), target: 0 };
  const base = numFormatter(m[1] + m[2]);
  return { big: (neg ? "-" : "") + m[1] + m[2], small: m[3].trim(), fmt: neg ? (v: number) => "-" + base(v) : base, target: kind === "pct" ? Math.round(value * 1000) / 10 : m[3].trim() === "" ? Math.abs(parseFloat(m[2].replace(/,/g, ""))) : Math.abs(value) };
}

// El "%" va pegado al número ("58.7%"); el resto de unidades van aparte.
const pctSuf = (small: string) => (small === "%" ? "%" : "");
const withSuf = (fmt: (v: number) => string, small: string) => (v: number) => fmt(v) + pctSuf(small);

// Anillo para una proporción. En Retirement, mantener pulsado enseña la parte que falta.
function RingScreen({ uid, kicker, label, value, canHold, active, fire }: { uid: string; kicker: string; label: string; value: number; canHold: boolean; active: boolean; fire?: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const last = useRef(0);
  const [filled, setFilled] = useState(false);
  const [hold, setHold] = useState(false);
  const frac = clamp01(value);
  const sp = statParts("pct", value);
  const size = fit(sp.big.length + 1, 96, 200);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setFilled(true), reduced() ? 0 : 300);
    return () => window.clearTimeout(t);
  }, [active]);

  useEffect(() => {
    if (!active || !sp.fmt) return;
    const to = hold ? 100 - sp.target : sp.target;
    const first = last.current === 0 && !hold;
    const stop = tweenText(numEl.current, sp.fmt, last.current, to, first ? 300 : 0, first ? 1700 : 600);
    last.current = to;
    return stop;
  }, [active, hold]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un toque corto avanza como en cualquier pantalla; mantener pulsado (más de 0,2 s) enseña la parte que falta.
  const timer = useRef(0);
  const long = useRef(false);
  const down = () => {
    if (!canHold) return;
    long.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      long.current = true;
      setHold(true);
    }, 200);
  };
  const up = () => {
    window.clearTimeout(timer.current);
    if (long.current) setHold(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Slide bg={fire ? "#080503" : "#0b0720"} fg="#fff" active={active} r={r}>
      <div className="ws-blob" style={{ width: 320, height: 320, background: fire ? "#ff7a00" : "#7c3aed", left: -110, top: 380, opacity: fire ? 0.55 : 0.65 }} />
      <div className="ws-blob" style={{ width: 260, height: 260, background: fire ? "#ffc21a" : "#ec4899", right: -90, top: -70, opacity: fire ? 0.42 : 0.5, animationDelay: "-4s" }} />
      <div className="ws-lab ws-in" style={delay(".1s")}>{kicker}</div>
      <div
        className="ws-rw"
        {...(canHold
          ? {
              onPointerDown: down,
              onPointerUp: up,
              onPointerLeave: up,
              onPointerCancel: up,
              // Tras mantener pulsado, el clic que sigue no debe cambiar de pantalla.
              onClickCapture: (e: MouseEvent<HTMLDivElement>) => {
                if (long.current) {
                  e.stopPropagation();
                  long.current = false;
                }
              },
            }
          : {})}
      >
        <svg viewBox="-150 -150 300 300">
          <defs>
            <linearGradient id={`ws-g-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={fire ? "#ffe066" : "#22d3ee"} />
              <stop offset=".5" stopColor={fire ? "#ff9a1a" : "#8b5cf6"} />
              <stop offset="1" stopColor={fire ? "#d9480f" : "#ff4d8d"} />
            </linearGradient>
          </defs>
          <circle r="100" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="38" />
          {canHold && (
            <circle r="100" fill="none" stroke="#ff4040" strokeWidth="38" strokeDasharray={`${(1 - frac) * C} ${C}`} strokeDashoffset={hold ? 0 : (1 - frac) * C} transform={`rotate(${-90 + frac * 360})`} style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }} />
          )}
          <circle r="100" fill="none" stroke={`url(#ws-g-${uid})`} strokeWidth="38" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={filled ? C * (1 - frac) : C} transform="rotate(-90)" style={{ filter: fire ? "drop-shadow(0 0 16px rgba(255,140,30,.85))" : "drop-shadow(0 0 16px rgba(139,92,246,.9))", opacity: hold ? 0.25 : 1, transition: "stroke-dashoffset 1.7s cubic-bezier(.2,.8,.2,1),opacity .4s" }} />
        </svg>
        <div className="ws-cent">
          <div>
            <span ref={numEl} className="ws-A" style={{ fontSize: size, lineHeight: 1 }}>{sp.fmt ? sp.fmt(0) : sp.big}</span>
            <span className="ws-A" style={{ fontSize: size * 0.46, marginLeft: 4 }}>{sp.small}</span>
          </div>
        </div>
      </div>
      <p className="ws-ringlab ws-in" style={delay(".7s")}>{hold ? "Not covered" : label}</p>
      {canHold && (
        <div className="ws-s1b">
          <button type="button" className="ws-pill ws-in" data-nohit style={delay(".9s")}>Hold the ring</button>
        </div>
      )}
    </Slide>
  );
}

// Una cifra suelta de la sección se cuenta con los mismos formatos que las preguntas: se disfraza de pregunta con su escala.
const UNIT: Record<StatT["kind"], ProbeInput["unit"]> = { usd: "$", pct: "%", months: "months", age: "years", text: "years" };
function synth(kind: StatT["kind"], label: string, tone: Tone, vals: number[]): Probe {
  const k = kind === "pct" ? 100 : 1;
  const mx = Math.max(...vals.map((v) => Math.abs(v) * k), 1);
  return { id: `stat-${label}`, question: label, tone, why: "", truth: {}, input: { min: 0, max: kind === "pct" ? 100 : Math.ceil(mx * 1.1), step: kind === "pct" ? 0.1 : 1, initial: 0, unit: UNIT[kind] } };
}
const scaled = (kind: StatT["kind"], v: number) => Math.abs(v) * (kind === "pct" ? 100 : 1);

// ---- "You said": cápsulas con ruleta (o píldora ancha si la cifra es larga) ----
function YouScreen({ probe, answer, tone, active, x }: { probe: Probe; answer: number; tone: Tone; active: boolean; x?: Extra }) {
  const r = useRef<HTMLDivElement>(null);
  const wide = useRef<HTMLSpanElement>(null);
  const p = PAL[tone];
  const [n, unit0] = splitValue(formatValue(probe.input, answer));
  const unit = n === "1" ? unit0.replace(/^(year|month)s\b/, "$1") : unit0;
  const reels = /^\d{1,2}$/.test(n);
  const q = probe.question;

  useEffect(() => {
    if (!active || !r.current) return;
    const root = r.current;
    let stop = () => {};
    if (reels) {
      root.querySelectorAll<HTMLElement>(".ws-cap").forEach((c, i) => {
        if (!reduced()) c.animate([{ transform: "translateY(110%)" }, { transform: "none" }], { duration: 800, delay: i * 160, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
      });
      root.querySelectorAll<HTMLElement>(".ws-strip").forEach((s, i) => {
        const to = -(10 + Number(s.dataset.land)) * 340;
        if (reduced()) {
          s.style.transform = `translateY(${to}px)`;
          return;
        }
        s.animate([{ transform: "translateY(0)" }, { transform: `translateY(${to}px)` }], { duration: 1500 + i * 500, delay: 400 + i * 120, easing: "cubic-bezier(.12,.7,.2,1)", fill: "forwards" });
      });
    } else {
      stop = tweenText(wide.current, numFormatter(n), probe.input.min, answer, 400, 1400);
    }
    return stop;
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg="#f4f1ea" fg="#141414" active={active} r={r}>
      <div className="ws-lab ws-in" style={delay(".1s")}>{x?.lab ?? "You said"}</div>
      {reels ? (
        n.split("").map((ch, i) => (
          <div key={i} className={`ws-cap ${n.length === 1 ? "ws-solo" : i === 0 ? "ws-c1" : "ws-c2"}`} style={{ background: `linear-gradient(170deg,${i === 0 ? p.cap : p.cap2})` }}>
            <div className="ws-reel">
              <div className="ws-strip" data-land={ch}>
                {Array.from({ length: 30 }, (_, k) => (
                  <div key={k}>{k % 10}</div>
                ))}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="ws-wide" style={{ background: `linear-gradient(170deg,${p.cap})` }}>
          <span ref={wide} className="ws-A" style={{ fontSize: fit(n.length, 120, 226) }}>{numFormatter(n)(probe.input.min)}</span>
        </div>
      )}
      <p className="ws-q ws-in" style={delay(".3s")}>{q}</p>
      <div className={`ws-yo${reels ? "" : " is-wide"}`}>
        <b className="ws-A ws-in" style={{ ...delay("1s"), fontSize: fit((unit || "Your answer").length, 56, 300) }}>{unit || "Your answer"}</b>
      </div>
    </Slide>
  );
}

// ---- "Your plan says": cifra real enorme y dial con la aguja que barre hasta ella ----
const CX = 160;
const CY = 175;
const polar = (f: number, rad: number): [number, number] => {
  const t = Math.PI * (1 - f);
  return [CX + rad * Math.cos(t), CY - rad * Math.sin(t)];
};

function PlanScreen({ probe, answer, real, tone, active, onNumbers, x, pal }: { probe: Probe; answer: number; real: number | null; tone: Tone; active: boolean; onNumbers: () => void; x?: Extra; pal?: Pal }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const nd = useRef<SVGGElement>(null);
  const hl = useRef<SVGPathElement>(null);
  const my = useRef<SVGCircleElement>(null);
  const dial = useRef<SVGSVGElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const p = pal ?? PAL[tone];
  const { min, max } = probe.input;
  const f = (v: number) => clamp01((v - min) / (max - min));
  const never = real === null;
  const realText = never ? "Never" : formatValue(probe.input, real);
  const [n, unit] = splitValue(realText);
  const fa = f(answer);
  const fr = never ? 1 : f(real);
  const gapAbs = never ? 0 : Math.abs(real - answer);
  const gapNum = splitValue(formatValue(probe.input, gapAbs))[0];
  const chipText = never ? "No end date" : gapAbs === 0 ? "Spot on" : `${real > answer ? "+" : "−"}${gapNum} ${x?.vs ?? "vs your guess"}`;
  const minL = splitValue(formatValue(probe.input, min))[0];
  const maxL = splitValue(formatValue(probe.input, max))[0];

  useEffect(() => {
    if (!active) return;
    const stop = never ? () => {} : tweenText(numEl.current, numFormatter(n), answer, real, 350, 1400);
    const endDeg = -180 * (1 - fr);
    if (reduced()) {
      if (nd.current) nd.current.style.transform = `rotate(${endDeg}deg)`;
      hl.current?.setAttribute("opacity", "1");
      if (chip.current) chip.current.style.opacity = "1";
      return stop;
    }
    nd.current?.animate([{ transform: "rotate(-180deg)" }, { transform: `rotate(${endDeg}deg)` }], { duration: 1900, delay: 800, easing: "cubic-bezier(.3,.7,.2,1.08)", fill: "forwards" });
    const timers: number[] = [];
    if (fr > fa && fa > 0) {
      timers.push(window.setTimeout(() => {
        my.current?.animate([{ transform: "scale(1)" }, { transform: "scale(1.8)" }, { transform: "scale(1)" }], { duration: 400 });
        shake(dial.current);
      }, 800 + 1900 * Math.pow(fa / fr, 0.55)));
    }
    timers.push(window.setTimeout(() => {
      hl.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: "forwards" });
      chip.current?.animate([{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }], { duration: 450, fill: "forwards", easing: "cubic-bezier(.2,1.2,.4,1)" });
      if (r.current) {
        const [px, py] = polar(fr, 100);
        sparks(r.current, 20 + px, DIAL_TOP + py, [p.accent, "#fff", p.ink], 16);
      }
      shake(dial.current);
    }, 800 + 1900));
    return () => {
      stop();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const ticks = Array.from({ length: 41 }, (_, i) => {
    const major = i % 5 === 0;
    const [x1, y1] = polar(i / 40, major ? 114 : 124);
    const [x2, y2] = polar(i / 40, 138);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={major ? 2.5 : 1.2} opacity={major ? 1 : 0.6} />;
  });
  const [yx, yy] = polar(fa, 100);
  const [a1x, a1y] = polar(Math.min(fa, fr), 150);
  const [a2x, a2y] = polar(Math.max(fa, fr), 150);
  const sz = fit(n.length, 200, 248);

  return (
    <Slide bg={p.bg} fg="#fff" active={active} r={r}>
      <div className="ws-band" style={{ left: 0, width: 12, background: p.ink, ...delay(".05s") }} />
      <div className="ws-band" style={{ left: 12, width: 20, background: p.band, ...delay(".15s") }} />
      <div className="ws-band" style={{ right: 0, width: 58, background: p.accent, ...delay(".25s") }} />
      <div className="ws-lab ws-in" style={{ ...delay(".2s"), left: 46 }}>{x?.lab ?? "But your plan says"}</div>
      <div className="ws-said ws-in" style={delay(".5s")}>{x?.said ?? "You said"} {formatValue(probe.input, answer)}</div>
      <div className="ws-b85 ws-A ws-in" style={{ ...delay(".35s"), fontSize: sz, color: p.ink }}>
        <span ref={numEl}>{never ? n : numFormatter(n)(answer)}</span>
      </div>
      <div className="ws-bv"><span className="ws-A" style={{ color: p.ink }}>{unit ? `${unit} · Your plan` : "Your plan"}</span></div>
      <svg ref={dial} className="ws-dial" width="340" height="200" viewBox="0 0 340 200" aria-hidden="true">
        <g transform="translate(10,0)">
          {ticks}
          {!never && gapAbs > 0 && <path ref={hl} d={`M${a1x} ${a1y} A150 150 0 0 1 ${a2x} ${a2y}`} fill="none" stroke={p.accent} strokeWidth="9" strokeLinecap="round" opacity="0" />}
          <circle ref={my} cx={yx} cy={yy} r="10" fill="none" stroke="#fff" strokeWidth="3" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          <g ref={nd} style={{ transformOrigin: `${CX}px ${CY}px`, transform: "rotate(-180deg)" }}>
            <line x1={CX} y1={CY} x2={CX + 96} y2={CY} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="8" fill="#fff" />
            <circle cx={CX + 96} cy={CY} r="10" fill={p.ink} stroke="#fff" strokeWidth="3" />
          </g>
          <g transform="translate(109,191)">
            <circle cx="0" cy="0" r="5.5" fill="none" stroke="#fff" strokeWidth="2.5" />
            <text x="12" y="4" fill="#fff" fontSize="11" fontWeight="700" letterSpacing="2">YOU</text>
            <circle cx="62" cy="0" r="5.5" fill={p.ink} stroke="#fff" strokeWidth="2.5" />
            <text x="74" y="4" fill="#fff" fontSize="11" fontWeight="700" letterSpacing="2">PLAN</text>
          </g>
          <text x="14" y="196" fill="#fff" fontSize="12" fontWeight="600">{minL}</text>
          <text x="290" y="196" fill="#fff" fontSize="12" fontWeight="600" textAnchor="end">{maxL}</text>
        </g>
      </svg>
      <div ref={chip} className="ws-chip3" style={{ background: p.ink, color: p.accent }}>{chipText}</div>
      <button type="button" className="ws-pill ws-nm" data-nohit onClick={onNumbers}>Numbers</button>
    </Slide>
  );
}

// ---- Cuánto te desviaste: anillos que laten alrededor de un agujero con la diferencia ----
const GAP_LABEL: Record<ProbeInput["unit"], string> = { years: "years off", $: "off", "%": "points off", months: "months off", "years of salary": "years off" };

function GapScreen({ probe, answer, real, tone, active, onNumbers, x, pal }: { probe: Probe; answer: number; real: number | null; tone: Tone; active: boolean; onNumbers: () => void; x?: Extra; pal?: Pal }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const p = pal ?? PAL[tone];
  const never = real === null;
  const gap = never ? 0 : Math.abs(real - answer);
  const gapNum = splitValue(formatValue(probe.input, gap))[0];
  const verdict = x?.verdict ?? closeness(probe, answer, real) ?? "Never runs out";
  const big = never ? "∞" : gapNum;

  useEffect(() => {
    if (!active) return;
    const stop = never ? () => {} : tweenText(numEl.current, numFormatter(gapNum), 0, gap, 500, 900);
    const t = window.setTimeout(() => {
      if (r.current && (verdict === "Nailed it" || never)) sparks(r.current, W / 2, 300, [p.ring, "#fff", p.accent], 22);
    }, 900);
    return () => {
      stop();
      window.clearTimeout(t);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg={p.gapDark} fg="#fff" active={active} r={r}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 47%,${p.gapMid} 0,${p.gapDark} 62%)` }} />
      {[0, -1.1, -2.2, -3.3].map((d) => (
        <div key={d} className="ws-rg" style={{ animationDelay: `${d}s` }} />
      ))}
      <div className="ws-lab ws-in" style={delay(".1s")}>{x?.lab ?? "Your guess was"}</div>
      <div className="ws-hole ws-in" style={{ ...delay(".3s"), background: p.gapDark, borderColor: p.ring }}>
        <span ref={numEl} className="ws-A" style={{ fontSize: fit(big.length, 150, 160), lineHeight: 1, fontFamily: never ? "'Space Grotesk',sans-serif" : undefined }}>{never ? big : numFormatter(gapNum)(0)}</span>
        <div className="ws-u" style={{ color: p.ring }}>{never ? "NO END DATE" : (x?.unitLabel ?? GAP_LABEL[probe.input.unit]).toUpperCase()}</div>
      </div>
      <div className="ws-s4b">
        <div className="ws-A ws-in" style={{ ...delay(".8s"), fontSize: fit(verdict.length, 44, 310) }}>{verdict}</div>
        <button type="button" className="ws-pill ws-in" data-nohit style={delay("1s")} onClick={onNumbers}>Show me the numbers</button>
      </div>
    </Slide>
  );
}

// ---- Calculadora: la cifra del plan se teclea en una calculadora retro ----
const CALC_KEYS = ["7", "8", "9", "÷", "×", "4", "5", "6", "−", "+", "1", "2", "3", "0", "="];

function CalcScreen({ probe, answer, real, active, onNumbers }: { probe: Probe; answer: number; real: number | null; active: boolean; onNumbers: () => void }) {
  const r = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const [sub, setSub] = useState("");
  const [down, setDown] = useState("");
  const full = real === null ? "NEVER" : formatValue(probe.input, real);
  const said = `you said ${formatValue(probe.input, answer)}`;
  useEffect(() => {
    if (!active) return;
    if (reduced()) {
      setTyped(full);
      setSub(said);
      return;
    }
    setTyped("");
    setSub("");
    setDown("");
    const ids: number[] = [];
    const later = (f: () => void, ms: number) => {
      ids.push(window.setTimeout(f, ms));
    };
    const press = (k: string) => {
      setDown(k);
      later(() => setDown(""), 120);
    };
    let i = 0;
    const type = () => {
      i++;
      setTyped(full.slice(0, i));
      const ch = full.charAt(i - 1);
      press(CALC_KEYS.includes(ch) ? ch : "+");
      if (i < full.length) later(type, 200);
      else
        later(() => {
          press("=");
          let j = 0;
          const w = () => {
            j++;
            setSub(said.slice(0, j));
            if (j < said.length) later(w, 40);
          };
          w();
        }, 350);
    };
    later(type, 800);
    return () => ids.forEach((t) => window.clearTimeout(t));
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const fs = Math.min(40, 232 / (Math.max(full.length, 6) * 0.6));
  return (
    <Slide bg="#FFF3DC" fg="#B4231C" active={active} r={r}>
      <div className="cc-top ws-in" style={delay(".1s")}>
        <span className="cc-tag">YOUR PLAN</span>
      </div>
      <div className="cc-h ws-in" style={delay(".25s")}>
        According to
        <br />
        your <i>plan</i>…
      </div>
      <div className="cc-q ws-in" style={delay(".45s")}>{probe.question}</div>
      <button type="button" className="ws-pill cc-num ws-in" data-nohit style={delay("1s")} onClick={onNumbers}>Show me the numbers</button>
      <div className="cc-body">
        <div className="cc-sol" />
        <div className="cc-lcd">
          <div className="cc-l1" style={{ fontSize: fs }}>
            {typed}
            {typed.length < full.length ? <span className="cc-cur" /> : null}
          </div>
          <div className="cc-l2">{sub}</div>
        </div>
        <div className="cc-keys">
          {CALC_KEYS.map((k) => (
            <div key={k} className={`cc-k${down === k ? " p" : ""}`}>{k}</div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

// ---- Papel arrugado: una bola de papel con relieve real que se despliega y deja la cifra ----
const ANTON = "'Anton',Impact,'Arial Narrow Bold',sans-serif";
const PAPERS = [
  { bg: "#D9FF00", ink: "#1a1f00", tilt: -4 },
  { bg: "#F2F1EE", ink: "#2a2a2a", tilt: 3 },
  { bg: "#BDF1EE", ink: "#17302f", tilt: -2 },
  { bg: "#FFD21F", ink: "#2a1d00", tilt: -3 },
];
function paperFrame(t: number, tilt: number) {
  const e = 1 - Math.pow(1 - t, 3);
  const p = 1 - e * 0.9;
  return {
    disp: 10 + 170 * Math.pow(p, 1.3),
    surf: 1.4 + 5.5 * p,
    tf: `translate(180 320) rotate(${((1 - e) * 200 + tilt * e).toFixed(1)}) scale(${(0.3 + 0.7 * e).toFixed(3)}) translate(-180 -320)`,
    op: Math.max(0, Math.min(1, (t - 0.4) / 0.35)),
  };
}
function splitVerdict(v: string): [string, string] {
  const w = v.split(" ");
  const h = Math.ceil(w.length / 2);
  return [w.slice(0, h).join(" "), w.slice(h).join(" ")];
}

function PaperScreen({ tag, big, word, lines, variant, active, onNumbers }: { tag: string; big: string; word: string; lines: [string, string]; variant: number; active: boolean; onNumbers: () => void }) {
  const r = useRef<HTMLDivElement>(null);
  const fid = "pf" + useId().replace(/:/g, "");
  const dm = useRef<SVGFEDisplacementMapElement>(null);
  const dl = useRef<SVGFEDiffuseLightingElement>(null);
  const pg = useRef<SVGGElement>(null);
  const tx = useRef<SVGGElement>(null);
  const pp = PAPERS[variant % PAPERS.length];
  const apply = (t: number) => {
    const f = paperFrame(t, pp.tilt);
    dm.current?.setAttribute("scale", f.disp.toFixed(1));
    dl.current?.setAttribute("surfaceScale", f.surf.toFixed(2));
    pg.current?.setAttribute("transform", f.tf);
    tx.current?.setAttribute("opacity", f.op.toFixed(2));
  };
  useEffect(() => {
    if (!active) return;
    if (reduced()) {
      apply(1);
      return;
    }
    let raf = 0;
    let t0: number | null = null;
    const fr = (ts: number) => {
      if (t0 === null) t0 = ts;
      const t = clamp01((ts - t0) / 2800);
      apply(t);
      if (t < 1) raf = requestAnimationFrame(fr);
    };
    apply(0);
    raf = requestAnimationFrame(fr);
    return () => cancelAnimationFrame(raf);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const f0 = paperFrame(0, pp.tilt);
  const tg = tag.length > 26 ? tag.slice(0, 25) + "…" : tag;
  const W1 = Math.min(214, big.length * 38);
  const W2 = Math.min(214, word.length * 38);
  return (
    <Slide bg="#151111" fg="#fff" active={active} r={r}>
      <svg className="pp-svg" viewBox="0 0 360 640">
        <defs>
          <filter id={fid} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.015" numOctaves={4} seed={11} result="n" />
            <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves={2} seed={4} result="n2" />
            <feComposite in="n" in2="n2" operator="arithmetic" k1={0} k2={0.8} k3={0.3} k4={0} result="h" />
            <feDisplacementMap ref={dm} in="SourceGraphic" in2="n" scale={f0.disp} xChannelSelector="R" yChannelSelector="G" result="d" />
            <feDiffuseLighting ref={dl} in="h" surfaceScale={f0.surf} diffuseConstant={1.15} lightingColor="#ffffff" result="lt">
              <feDistantLight azimuth={235} elevation={52} />
            </feDiffuseLighting>
            <feComposite in="lt" in2="d" operator="in" result="lt2" />
            <feBlend in="d" in2="lt2" mode="multiply" />
          </filter>
        </defs>
        <g ref={pg} transform={f0.tf}>
          <g filter={`url(#${fid})`}>
            <rect x={55} y={150} width={250} height={340} fill={pp.bg} />
            <g ref={tx} opacity={f0.op}>
              <rect x={73} y={172} width={tg.length * 8.6 + 26} height={26} rx={13} fill="none" stroke={pp.ink} strokeWidth={2} />
              <text x={86} y={190} fontSize={12} fontWeight={500} fill={pp.ink} fontFamily="'Space Grotesk',sans-serif">{tg}</text>
              <text x={73} y={268} fontFamily={ANTON} fontSize={72} fill={pp.ink} textLength={W1} lengthAdjust="spacingAndGlyphs">{big}</text>
              <text x={73} y={338} fontFamily={ANTON} fontSize={72} fill={pp.ink} textLength={W2} lengthAdjust="spacingAndGlyphs">{word.toUpperCase()}</text>
              <text x={73} y={408} fontFamily="Georgia,serif" fontStyle="italic" fontSize={22} fill={pp.ink}>{lines[0]}</text>
              <text x={73} y={434} fontFamily="Georgia,serif" fontStyle="italic" fontSize={22} fill={pp.ink}>{lines[1]}</text>
            </g>
          </g>
        </g>
      </svg>
      <div className="ws-s4b">
        <button type="button" className="ws-pill ws-in" data-nohit style={delay("2.2s")} onClick={onNumbers}>Show me the numbers</button>
      </div>
    </Slide>
  );
}

// ---- Cartel fluido: degradado líquido oscuro con grano; la cifra se ondula al aparecer y queda recta ----
const FLUIDS = [
  { bg: "#0c0707", ink: "#fff", bl: ["#FF9A00", "#FF3B2E", "#FF2E7A", "#1a0a06"] },
  { bg: "#07041a", ink: "#fff", bl: ["#FFD400", "#B01FD1", "#5A22D6", "#0a0620"] },
  { bg: "#070a09", ink: "#B6FF3B", bl: ["#00E5A0", "#FF4FB0", "#0a0a0a", "#7a1f55"] },
];

function FluidScreen({ probe, answer, real, pi, active, onNumbers }: { probe: Probe; answer: number; real: number | null; pi: number; active: boolean; onNumbers: () => void }) {
  const r = useRef<HTMLDivElement>(null);
  const fid = "fw" + useId().replace(/:/g, "");
  const dm = useRef<SVGFEDisplacementMapElement>(null);
  const tb = useRef<SVGFETurbulenceElement>(null);
  const wg = useRef<SVGGElement>(null);
  const fl = FLUIDS[pi % 3];
  const never = real === null;
  const [big, unit] = never ? ["∞", "NO END DATE"] : ((): [string, string] => {
    const [a, b] = splitValue(formatValue(probe.input, real));
    return [a, (a === "1" ? b.replace(/^(year|month)s\b/, "$1") : b).toUpperCase()];
  })();
  const fs = Math.min(215, 300 / (big.length * 0.42));
  // Centra la tinta de la cifra, no su caja: un "1" tiene la bandera a la izquierda y se veía descentrado.
  const [dx, setDx] = useState(0);
  useEffect(() => {
    let off = false;
    const run = async () => {
      try {
        await document.fonts.load(`${fs}px ${ANTON}`);
      } catch {
        /* sin fuente: se queda como está */
      }
      const c = document.createElement("canvas").getContext("2d");
      if (!c || off) return;
      c.font = `${fs}px ${ANTON}`;
      c.textAlign = "center";
      const m = c.measureText(big);
      setDx(-(m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2);
    };
    run();
    return () => {
      off = true;
    };
  }, [big, fs]);
  const apply = (t: number) => {
    const e = easeOut(t);
    const wob = (1 - e) * Math.sin(t * 14) * 0.004;
    dm.current?.setAttribute("scale", (280 * (1 - e)).toFixed(1));
    tb.current?.setAttribute("baseFrequency", `0.002 ${(0.012 + wob + (1 - e) * 0.012).toFixed(4)}`);
    if (wg.current) wg.current.style.opacity = String(Math.min(1, t * 4));
  };
  useEffect(() => {
    if (!active) return;
    if (reduced()) {
      apply(1);
      return;
    }
    let raf = 0;
    let t0: number | null = null;
    const fr = (ts: number) => {
      if (t0 === null) t0 = ts;
      const t = clamp01((ts - t0) / 1900);
      apply(t);
      if (t < 1) raf = requestAnimationFrame(fr);
    };
    apply(0);
    raf = requestAnimationFrame(fr);
    return () => cancelAnimationFrame(raf);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const bl = fl.bl;
  return (
    <Slide bg={fl.bg} fg={fl.ink} active={active} r={r}>
      <div className="fl-blob" style={{ width: 280, height: 280, left: -70, top: 60, background: bl[0], animation: "fl-d1 9s ease-in-out infinite" }} />
      <div className="fl-blob" style={{ width: 260, height: 260, right: -90, top: 180, background: bl[1], animation: "fl-d2 11s ease-in-out infinite" }} />
      <div className="fl-blob" style={{ width: 300, height: 300, left: 30, bottom: -30, background: bl[2], animation: "fl-d3 10s ease-in-out infinite" }} />
      <div className="fl-blob" style={{ width: 240, height: 240, right: 0, top: -40, background: bl[3], animation: "fl-d1 13s ease-in-out infinite reverse" }} />
      <div className="fl-crease" />
      <div className="fl-vig" />
      <div className="fl-grain" />
      <div className="ws-lab ws-in" style={delay(".1s")}>But your plan says</div>
      <svg className="pp-svg" viewBox="0 0 360 640" style={{ zIndex: 2 }}>
        <defs>
          <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence ref={tb} type="fractalNoise" baseFrequency="0.002 0.024" numOctaves={1} seed={3} result="n" />
            <feDisplacementMap ref={dm} in="SourceGraphic" in2="n" scale={280} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g ref={wg} filter={`url(#${fid})`} style={{ opacity: 0 }}>
          <text x={180 + dx} y={315 + fs * 0.37} textAnchor="middle" fontFamily={ANTON} fontSize={fs} fill={fl.ink}>{big}</text>
        </g>
      </svg>
      <div className="fl-unit ws-in" style={{ ...delay("1.8s"), color: fl.ink }}>{unit}</div>
      <div className="ws-s4b" style={{ color: fl.ink }}>
        <div className="fl-said ws-in" style={delay("2s")}>You said {formatValue(probe.input, answer)}</div>
        <button type="button" className="ws-pill ws-in" data-nohit style={delay("2.2s")} onClick={onNumbers}>Show me the numbers</button>
      </div>
    </Slide>
  );
}

// ---- Aviso pixelado: trama de puntos y triángulos de aviso fijos para las diferencias grandes ----
function PixelTri({ cx, cy, c, d }: { cx: number; cy: number; c: number; d: string }) {
  const cells: [number, number][] = [];
  const R = 20;
  for (let r = 0; r < R; r++) {
    const h = Math.round(r * 0.6);
    if (r >= R - 2) for (let x = -h; x <= h; x++) cells.push([x + 12, r]);
    else cells.push([12 - h, r], [13 - h, r], [11 + h, r], [12 + h, r]);
  }
  for (let r = 6; r <= 13; r++) cells.push([11, r], [12, r]);
  for (let r = 15; r <= 16; r++) cells.push([11, r], [12, r]);
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className="px-tri" style={delay(d)} fill="#3550FF" shapeRendering="crispEdges">
        {cells.map(([x, y], i) => (
          <rect key={i} x={(x - 12) * c} y={y * c} width={c} height={c} />
        ))}
      </g>
    </g>
  );
}
const PIX_TRI: [number, number, number][] = [[130, 58, 5], [8, 300, 4], [226, 418, 6], [40, 520, 3]];

function PixelScreen({ probe, answer, real, active, onNumbers, x }: { probe: Probe; answer: number; real: number | null; active: boolean; onNumbers: () => void; x?: Extra }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const never = real === null;
  const gap = never ? 0 : Math.abs(real - answer);
  const gapNum = splitValue(formatValue(probe.input, gap))[0];
  const unit = (never ? "NO END DATE" : x?.unitLabel ?? GAP_LABEL[probe.input.unit]).toUpperCase();
  const verdict = x?.verdict ?? closeness(probe, answer, real) ?? "Never runs out";
  const big = never ? "∞" : gapNum;
  useEffect(() => {
    const c = cv.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const draw = (t: number) => {
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 360, 640);
      ctx.fillStyle = "#A9A9A4";
      ctx.beginPath();
      for (let gy = 0; gy < 64; gy++)
        for (let gx = 0; gx < 36; gx++) {
          const px = gx * 10 + 5;
          const py = gy * 10 + 5;
          const band = Math.exp(-Math.pow((py - (300 + Math.sin(px * 0.018 + t * 0.5) * 50 - px * 0.12)) / 80, 2));
          const w = 0.5 + 0.5 * Math.sin(px * 0.05 + py * 0.04 - t * 0.8);
          const rad = Math.max(0, 3.2 * band * (0.35 + 0.65 * w));
          if (rad > 0.15) {
            ctx.moveTo(px + rad, py);
            ctx.arc(px, py, rad, 0, Math.PI * 2);
          }
        }
      ctx.fill();
    };
    draw(0);
    if (!active || reduced()) return;
    let raf = 0;
    const t0 = performance.now();
    const fr = (ts: number) => {
      draw((ts - t0) / 1000);
      raf = requestAnimationFrame(fr);
    };
    raf = requestAnimationFrame(fr);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  useEffect(() => {
    if (!active || never) return;
    return tweenText(numEl.current, numFormatter(gapNum), 0, gap, 1400, 900);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Slide bg="#EDEDE9" fg="#111" active={active} r={r}>
      <canvas ref={cv} className="px-cv" width={720} height={1280} />
      <svg className="pp-svg" viewBox="0 0 360 640" style={{ zIndex: 2 }}>
        {PIX_TRI.map((t, i) => (
          <PixelTri key={i} cx={t[0]} cy={t[1]} c={t[2]} d={`${0.3 + i * 0.25}s`} />
        ))}
      </svg>
      <div className="ws-lab ws-in" style={delay(".1s")}>{x?.lab ?? "Your guess was"}</div>
      <div className="px-num ws-A ws-in" style={{ ...delay("1.4s"), fontSize: fit(big.length, 150, 280) }}>
        <span ref={numEl}>{never ? big : numFormatter(gapNum)(0)}</span>
      </div>
      <div className="px-unit ws-in" style={delay("1.7s")}>
        <span>{unit}</span>
      </div>
      <div className="px-verdict ws-A ws-in" style={{ ...delay("1.9s"), fontSize: fit(verdict.length, 38, 300) }}>{verdict}</div>
      <div className="ws-s4b" style={{ color: "#111" }}>
        <button type="button" className="ws-pill ws-in" data-nohit style={delay("2.1s")} onClick={onNumbers}>Show me the numbers</button>
      </div>
    </Slide>
  );
}

// ---- Transición: seis tiras verticales que suben (o bajan al retroceder) una tras otra ----
function comb(nw: HTMLElement, old: HTMLElement, fromTop: boolean, end: () => void): () => void {
  const N = 6;
  const dur = 720;
  const stg = 70;
  const t0 = performance.now();
  let raf = 0;
  const f = (now: number) => {
    const t = now - t0;
    const pts = [fromTop ? "0px 0px" : `0px ${H}px`];
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const p = clamp01((t - i * stg) / dur);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const y = fromTop ? H * e : H * (1 - e);
      sum += e;
      pts.push(`${(i * W) / N}px ${y}px`, `${((i + 1) * W) / N}px ${y}px`);
    }
    pts.push(`${W}px ${fromTop ? 0 : H}px`);
    nw.style.clipPath = `polygon(${pts.join(",")})`;
    old.style.transform = `translateY(${(fromTop ? 1 : -1) * (sum / N) * 60}px) scale(${1 - (sum / N) * 0.06})`;
    if (t < dur + stg * (N - 1)) raf = requestAnimationFrame(f);
    else end();
  };
  raf = requestAnimationFrame(f);
  return () => cancelAnimationFrame(raf);
}

// ---- Portada del análisis: la nota, las áreas y los próximos pasos, con los mismos formatos ----
type ScoreT = Analysis["score"];
const scoreTone = (v: number): Tone => (v < 40 ? "bad" : v < 70 ? "neutral" : "good");
const TONE_ARC: Record<Tone, [string, string]> = { bad: ["#ff4d17", "#ffc21a"], neutral: ["#8b5cf6", "#22d3ee"], good: ["#34d399", "#5eead4"] };
const TONE_BLOB: Record<Tone, [string, string]> = { bad: ["#ea580c", "#be123c"], neutral: ["#7c3aed", "#ec4899"], good: ["#059669", "#0ea5e9"] };
const PILLAR_FILL = { low: "linear-gradient(180deg,#ff6a3d,#b3141f)", mid: "linear-gradient(180deg,#fcd34d,#d97706)", high: "linear-gradient(180deg,#34d399,#0a7a55)" };
const round = (v: number) => String(Math.round(v));

// La nota: anillo grande, cifra enorme y la palabra del nivel. La frase explicativa va en el panel.
function ScoreScreen({ s, active, onMeaning }: { s: ScoreT; active: boolean; onMeaning: () => void }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const [filled, setFilled] = useState(false);
  const tone = scoreTone(s.value);
  const [c1, c2] = TONE_ARC[tone];
  const [b1, b2] = TONE_BLOB[tone];

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setFilled(true), reduced() ? 0 : 300);
    const stop = tweenText(numEl.current, round, 0, s.value, 300, 1700);
    return () => {
      window.clearTimeout(t);
      stop();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg="#0b0720" fg="#fff" active={active} r={r}>
      <div className="ws-blob" style={{ width: 320, height: 320, background: b1, left: -110, top: 380, opacity: 0.65 }} />
      <div className="ws-blob" style={{ width: 260, height: 260, background: b2, right: -90, top: -70, opacity: 0.5, animationDelay: "-4s" }} />
      <div className="ws-lab ws-in" style={delay(".1s")}>Your financial health</div>
      <div className="ws-rw">
        <svg viewBox="-150 -150 300 300">
          <defs>
            <linearGradient id="ws-score-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={c1} />
              <stop offset="1" stopColor={c2} />
            </linearGradient>
          </defs>
          <circle r="100" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="38" />
          <circle r="100" fill="none" stroke="url(#ws-score-g)" strokeWidth="38" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={filled ? C * (1 - clamp01(s.value / 100)) : C} transform="rotate(-90)" style={{ filter: `drop-shadow(0 0 16px ${c1})`, transition: "stroke-dashoffset 1.7s cubic-bezier(.2,.8,.2,1)" }} />
        </svg>
        <div className="ws-cent">
          <div>
            <span ref={numEl} className="ws-A" style={{ fontSize: 120, lineHeight: 1 }}>0</span>
            <span className="ws-A" style={{ fontSize: 30, marginLeft: 6, opacity: 0.7 }}>/100</span>
          </div>
        </div>
      </div>
      <div className="ws-bandw ws-in" style={delay(".7s")}>{s.band}</div>
      <div className="ws-s1b">
        <button type="button" className="ws-pill ws-in" data-nohit style={delay(".9s")} onClick={onMeaning}>What this means</button>
      </div>
    </Slide>
  );
}

// Las áreas: una cápsula vertical por área que se llena desde abajo según su nota.
function PillarsScreen({ pillars, active }: { pillars: ScoreT["pillars"]; active: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const nums = useRef<(HTMLSpanElement | null)[]>([]);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setOn(true), reduced() ? 0 : 350);
    const stops = pillars.map((p, i) => tweenText(nums.current[i], round, 0, p.score, 350 + i * 120, 1000));
    return () => {
      window.clearTimeout(t);
      stops.forEach((s) => s());
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg="#f4f1ea" fg="#141414" active={active} r={r}>
      <div className="ws-lab ws-in" style={delay(".1s")}>Score by area</div>
      <div className="ws-pil">
        {pillars.map((p, i) => {
          const lv = p.score < 35 ? "low" : p.score < 65 ? "mid" : "high";
          return (
            <div key={p.name} className="ws-pcol ws-in" style={delay(`${0.2 + i * 0.1}s`)}>
              <span ref={(el) => { nums.current[i] = el; }} className="ws-A ws-pnum">0</span>
              <div className="ws-pc">
                <div className="ws-pf" style={{ height: on ? `${p.score}%` : "0%", background: PILLAR_FILL[lv], transitionDelay: `${i * 0.12}s` }} />
              </div>
              <span className="ws-pname">{p.name}</span>
            </div>
          );
        })}
      </div>
    </Slide>
  );
}

// ---- Próximos pasos como baterías: cada paso carga la nota desde donde está hasta lo que subiría (los pasos no se suman) ----
const BT_PAD = 8;
const btCol = (v: number) => (v < 30 ? "#ff7b4d" : v < 60 ? "#fcd34d" : "#3ddba0");
// Degradado de cada nivel (arriba claro → abajo oscuro), como las barras de "Score by area".
const btGrad = (v: number): [string, string] => (v < 30 ? ["#ff7b4d", "#c0182b"] : v < 60 ? ["#fcd34d", "#dd7f06"] : ["#3ddba0", "#0a8a5e"]);
function BtGrad({ id, v, y1, y2 }: { id: string; v: number; y1: number; y2: number }) {
  const [a, b] = btGrad(v);
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={y1} x2="0" y2={y2}>
      <stop offset="0" stopColor={a} />
      <stop offset="1" stopColor={b} />
    </linearGradient>
  );
}
const BT_CREAM = "#f3e8d3";
const BT_BG = "#1e2024";

// Fondos de los pasos con los colores de las barras de "Score by area": verde, amarillo, rojo.
// Si la descripción es larga, se queda con la primera idea (antes de "to raise…", "toward…", "so that…").
function shortAction(t: string) {
  if (t.length <= 92) return t;
  const k = t.search(/ (to raise|toward|towards|so that|in order to)\b/i);
  return k > 24 ? t.slice(0, k) : t;
}
// ink = texto principal; ttl = título; sub = descripción; pillBg/pillFg = píldora de puntos.
const BT_PALS = [
  { bg: "#14966a", sh: "#0a4d38", ink: "#fff", ttl: "#ffd21f", sub: "#e4fff3", pillBg: "#050505", pillFg: "#ffd21f" },
  { bg: "#f2b02a", sh: "#8f5206", ink: "#16181d", ttl: "#16181d", sub: "#3a2605", pillBg: "#16181d", pillFg: "#ffd21f" },
  { bg: "#e04632", sh: "#7a1410", ink: "#fff", ttl: "#ffd21f", sub: "#ffe6e0", pillBg: "#050505", pillFg: "#ffd21f" },
];

// Cuántas líneas ocupa un título al partirlo por palabras (aprox. por ancho de línea en caracteres).
const btLines = (text: string, per: number) => {
  let lines = 1;
  let cur = 0;
  for (const w of text.split(" ")) {
    if (cur && cur + 1 + w.length > per) {
      lines++;
      cur = w.length;
    } else cur += (cur ? 1 : 0) + w.length;
  }
  return lines;
};

// Una batería plana con celdas: el relleno se pinta sobre el fondo y las celdas son huecos oscuros encima.
function Battery({ id, x, y, w, h, before, after, cur, on, done, ghost }: { id: string; x: number; y: number; w: number; h: number; before: number; after: number; cur: boolean; on: boolean; done: boolean; ghost: boolean }) {
  const ih = h - 2 * BT_PAD - 6;
  const bot = y + BT_PAD + 3 + ih;
  const hh = (v: number) => (ih * Math.max(0, Math.min(100, v))) / 100;
  return (
    <g opacity={cur ? 1 : 0.45}>
      <rect x={x + w / 2 - 12} y={y - 14} width="24" height="16" rx="5" fill={BT_CREAM} />
      <rect x={x + 2.5} y={y + 2.5} width={w - 5} height={h - 5} rx="15" fill={BT_BG} stroke={BT_CREAM} strokeWidth="5" />
      <clipPath id={id}><rect x={x + BT_PAD + 3} y={y + BT_PAD + 3} width={w - 2 * BT_PAD - 6} height={ih} rx="5" /></clipPath>
      <defs>
        <BtGrad id={`${id}b`} v={before} y1={bot - hh(before)} y2={bot} />
        <BtGrad id={`${id}a`} v={after} y1={bot - hh(after)} y2={bot} />
      </defs>
      <g clipPath={`url(#${id})`}>
        {ghost && <rect x={x} y={bot - hh(after)} width={w} height={hh(after)} fill={`url(#${id}a)`} opacity=".35" />}
        {cur && <rect className="bt-base" x={x} y={bot - hh(before)} width={w} height={hh(before)} fill={done ? `url(#${id}a)` : `url(#${id}b)`} />}
        {cur && <rect className={`bt-gain${on ? " bt-on" : ""}`} x={x} y={bot - hh(after)} width={w} height={Math.max(0, hh(after) - hh(before))} fill={done ? `url(#${id}a)` : "#fff"} />}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
          <rect key={k} x={x} y={y + BT_PAD + 3 + (ih * k) / 10 - 1.6} width={w} height="3.2" fill={BT_BG} />
        ))}
      </g>
    </g>
  );
}

// Un próximo paso: póster azul con una batería gigante que carga la nota, con la figura encima.
function MoveScreen({ moves, i, active }: { moves: ScoreT["moves"]; i: number; active: boolean }) {
  const m = moves[i];
  const n = moves.length;
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const uid = useId().replace(/:/g, "");
  const [on, setOn] = useState(false);
  const [done, setDone] = useState(false);
  const gain = m.scoreAfter - m.scoreBefore;
  const PAL = BT_PALS[i % 3];
  const BLUE = PAL.bg;
  const SHADOW = PAL.sh;
  const BX = 26;
  const BW = 150;
  const BY = 236;
  const BHT = 292;
  const ih = BHT - 36;
  const bot = BY + BHT - 18;
  const hh = (v: number) => (ih * Math.max(0, Math.min(100, v))) / 100;
  const big = btLines(m.title, 16) > 2;
  const tSize = big ? 20 : 27;

  useEffect(() => {
    if (!active) return;
    const t1 = window.setTimeout(() => setOn(true), reduced() ? 0 : 900);
    const t2 = window.setTimeout(() => setDone(true), reduced() ? 0 : 2100);
    const stop = tweenText(numEl.current, round, m.scoreBefore, m.scoreAfter, 900, 1100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      stop();
      setOn(false);
      setDone(false);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg={BLUE} fg={PAL.ink} active={active} r={r}>
      <svg className="bt-svg" viewBox="0 0 360 640" width="360" height="640" aria-hidden="true">
        <defs>
          <pattern id={`ht${uid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <rect width="4" height="4" fill="#fff" />
            <circle cx="2" cy="2" r="1.1" fill="#111" />
          </pattern>
          <clipPath id={`bc${uid}`}><rect x={BX + 18} y={BY + 18} width={BW - 36} height={ih} rx="4" /></clipPath>
          <BtGrad id={`gb${uid}`} v={m.scoreBefore} y1={bot - hh(m.scoreBefore)} y2={bot} />
          <BtGrad id={`ga${uid}`} v={m.scoreAfter} y1={bot - hh(m.scoreAfter)} y2={bot} />
        </defs>
        <rect x={BX + 16} y={BY + 16} width={BW} height={BHT} rx="18" fill={SHADOW} />
        <rect x={BX + 55} y={BY - 22 + 16} width="80" height="26" rx="7" fill={SHADOW} />
        <rect x={BX + 39} y={BY - 24} width="72" height="26" rx="7" fill={BT_CREAM} />
        <rect x={BX} y={BY} width={BW} height={BHT} rx="18" fill={SHADOW} stroke={BT_CREAM} strokeWidth="9" />
        <g clipPath={`url(#bc${uid})`}>
          <rect className="bt-base" x={BX} y={bot - hh(m.scoreBefore)} width={BW} height={hh(m.scoreBefore)} fill={done ? `url(#ga${uid})` : `url(#gb${uid})`} />
          <rect className={`bt-gain${on ? " bt-on" : ""}`} x={BX} y={bot - hh(m.scoreAfter)} width={BW} height={Math.max(0, hh(m.scoreAfter) - hh(m.scoreBefore))} fill={done ? `url(#ga${uid})` : "#fff"} />
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
            <rect key={k} x={BX} y={BY + 18 + (ih * k) / 10 - 2} width={BW} height="4" fill={SHADOW} />
          ))}
        </g>
        <g className={`bt-fig${on ? " bt-fon" : ""}`}>
          <g transform={`translate(${BX + BW / 2} ${BY - 24}) scale(1.6)`}>
            <rect x="-6" y="-24" width="4.6" height="24" fill="#151515" transform="rotate(4 -4 -24)" />
            <rect x="1.6" y="-24" width="4.6" height="24" fill="#151515" transform="rotate(-4 4 -24)" />
            <rect x="-8" y="-42" width="16" height="21" rx="3" fill={`url(#ht${uid})`} stroke="#111" strokeWidth=".8" />
            <rect x="-13" y="-41" width="5" height="17" rx="2" fill={`url(#ht${uid})`} stroke="#111" strokeWidth=".8" transform="rotate(8 -10 -41)" />
            <rect x="8" y="-41" width="5" height="17" rx="2" fill={`url(#ht${uid})`} stroke="#111" strokeWidth=".8" transform="rotate(-8 10 -41)" />
            <circle cx="0" cy="-48" r="5.6" fill="#151515" />
          </g>
        </g>
      </svg>
      <div className="ws-lab bt-lab ws-in" style={{ ...delay(".1s"), color: PAL.ttl }}>Next step {i + 1} of {n}</div>
      <div className="bt-ttl ws-in" style={{ ...delay(".3s"), top: big ? 54 : 62, fontSize: tSize, color: PAL.ttl, WebkitTextStrokeColor: PAL.ttl }}>{m.title}</div>
      <div className="bt-num ws-in" style={{ ...delay(".7s"), left: 202, top: 276, fontSize: String(m.scoreAfter).length > 2 ? 78 : 112, color: PAL.ink }}><span ref={numEl}>{m.scoreBefore}</span></div>
      <div className="bt-eff ws-in" style={{ ...delay("1s"), left: 202, top: 406, width: 134, color: PAL.ink, borderColor: PAL.ink }}>Effort · {m.effort}</div>
      <div className="bt-pill ws-in" style={{ ...delay("1.4s"), left: 202, top: 448, width: 134, background: PAL.pillBg, color: PAL.pillFg, ...(gain > 0 ? {} : { fontSize: 11, letterSpacing: "0.04em" }) }}>{gain > 0 ? `+${gain} point${gain === 1 ? "" : "s"}` : "Better together"}</div>
      <p className="bt-sub ws-in" style={{ ...delay(".5s"), top: 556, fontSize: 12.5, color: PAL.sub }}>{shortAction(m.action.split(" — ")[0])}</p>
    </Slide>
  );
}

// El efecto de hacerlo todo junto: una batería grande que carga hasta la nota final.
function CombinedScreen({ c, before, active, onNote }: { c: NonNullable<ScoreT["combined"]>; before: number; active: boolean; onNote: () => void }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const uid = useId().replace(/:/g, "");
  const [on, setOn] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    const t1 = window.setTimeout(() => setOn(true), reduced() ? 0 : 700);
    const t2 = window.setTimeout(() => setDone(true), reduced() ? 0 : 2000);
    const stop = tweenText(numEl.current, round, before, c.scoreAfter, 700, 1300);
    const t3 = window.setTimeout(() => {
      if (r.current) sparks(r.current, W / 2, 250, ["#fcd34d", "#3ddba0", "#fff"], 22);
    }, 2100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      stop();
      setOn(false);
      setDone(false);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg={BT_BG} fg="#fff" active={active} r={r}>
      <svg className="bt-svg" viewBox="0 0 360 640" width="360" height="640" aria-hidden="true">
        <Battery id={`c${uid}`} x={110} y={92} w={140} h={290} before={before} after={c.scoreAfter} cur on={on} done={done} ghost={false} />
      </svg>
      <div className="ws-lab bt-lab ws-in" style={delay(".1s")}>Together</div>
      <div className="bt-k ws-in" style={{ ...delay(".4s"), top: 408, left: 0, width: W, textAlign: "center", paddingLeft: "0.2em", boxSizing: "border-box" }}>Score if you do {c.moves.length === 1 ? "it" : "them all"}</div>
      <div className="bt-num ws-in" style={{ ...delay(".4s"), top: 424, left: 0, width: W, textAlign: "center", fontSize: 92, color: done ? btCol(c.scoreAfter) : BT_CREAM }}><span ref={numEl}>{before}</span></div>
      <div className="bt-from ws-in" style={delay(".8s")}>{before} → {c.scoreAfter}</div>
      <button type="button" className="ws-pill bt-btn ws-in" data-nohit style={delay("1s")} onClick={onNote}>Show me the numbers</button>
    </Slide>
  );
}

// ---- Dos formatos nuevos para las cifras sueltas: cinta giratoria y barras en fila ----
// Una cifra grande sobre cintas de texto que se desplazan en sentidos opuestos.
function MarqueeScreen({ kicker, label, kind, value, variant, active, tint }: { kicker: string; label: string; kind: StatT["kind"]; value: number | string; variant: number; active: boolean; tint?: string }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const { big, small, fmt, target } = statParts(kind, value);
  const neg = typeof value === "number" && value < 0;
  const dark = variant % 2 === 1;
  const bg = neg ? "#d9a62c" : dark ? "#0b0720" : tint ?? PAL.neutral.bg;
  const line = neg ? "#9a6e16" : dark ? PAL.neutral.ring : "#ffd84a";
  const word = label.toUpperCase();
  const track = `${word} \u00a0•\u00a0 `.repeat(8);

  useEffect(() => {
    if (!active || !fmt) return;
    return tweenText(numEl.current, withSuf(fmt, small), 0, target, 350, 1400);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg={bg} fg={neg ? "#2b1d04" : "#fff"} active={active} r={r}>
      <div className="ws-mq ws-A" style={{ top: 96, transform: "rotate(-8deg)", color: "transparent", WebkitTextStrokeColor: line }}>
        <i>{track}{track}</i>
      </div>
      <div className="ws-mq ws-A" style={{ top: 470, transform: "rotate(-8deg)", color: "transparent", WebkitTextStrokeColor: line }}>
        <i style={{ animationDirection: "reverse" }}>{track}{track}</i>
      </div>
      <div className="ws-lab ws-in" style={delay(".1s")}>{kicker}</div>
      <div className="ws-mqn">
        <span ref={numEl} className="ws-A ws-in" style={{ ...delay(".25s"), fontSize: fit(big.length + pctSuf(small).length, 150, 320), lineHeight: 1, color: neg ? "#1c1303" : line }}>{big + pctSuf(small)}</span>
        {small && small !== "%" && <div className="ws-mqs ws-in" style={delay(".6s")}>{small}</div>}
        <div className="ws-mql ws-in" style={delay(".8s")}>{label}</div>
      </div>
    </Slide>
  );
}

const ROW_GRAD = ["#8b5cf6,#22d3ee", "#ff6a3d,#ffc21a", "#34d399,#5eead4", "#ec4899,#8b5cf6"];

// Varias cifras de la misma clase en fila: cada una con su barra, proporcional a la mayor.
function LineupScreen({ kicker, stats, active }: { kicker: string; stats: StatT[]; active: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const nums = useRef<(HTMLSpanElement | null)[]>([]);
  const [on, setOn] = useState(false);
  const vals = stats.map((s) => Math.abs(s.value as number));
  const mx = Math.max(...vals, 1);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setOn(true), reduced() ? 0 : 400);
    const stops = stats.map((s, i) => {
      const { fmt, target } = statParts(s.kind, s.value);
      return fmt ? tweenText(nums.current[i], fmt, 0, target, 400 + i * 150, 1100) : () => {};
    });
    return () => {
      window.clearTimeout(t);
      stops.forEach((f) => f());
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg="#0b0720" fg="#fff" active={active} r={r}>
      <div className="ws-blob" style={{ width: 300, height: 300, background: "#4c1d95", right: -120, top: 360, opacity: 0.55 }} />
      <div className="ws-lab ws-in" style={delay(".1s")}>{kicker}</div>
      <div className="ws-lu">
        {stats.map((s, i) => {
          const { big, small } = statParts(s.kind, s.value);
          const neg = (s.value as number) < 0;
          return (
            <div key={s.label} className="ws-row ws-in" style={delay(`${0.2 + i * 0.15}s`)}>
              <div className="ws-rowh">
                <span className="ws-rowl">{s.label}</span>
                <span className="ws-A ws-rown"><span ref={(el) => { nums.current[i] = el; }}>{big}</span>{small && <em>{small}</em>}</span>
              </div>
              <div className="ws-rowt">
                <div className="ws-rowf" style={{ width: on ? `${Math.max(6, (vals[i] / mx) * 100)}%` : "0%", background: `linear-gradient(90deg,${neg ? "#ff4d17,#be123c" : ROW_GRAD[i % ROW_GRAD.length]})`, transitionDelay: `${i * 0.15}s` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Slide>
  );
}

// ---- "Lo que tienes frente a lo recomendado": columnas cara a cara o cápsula que se llena (en vez de repetir el dial) ----
const TEAL: Pal = { bg: "#064e3b", band: "#047857", accent: "#fde047", ink: "#021a14", cap: "#34d399,#0a7a55 55%,#032e21", cap2: "#22d3ee,#0e6b73 55%,#042a30", gapMid: "#0f766e", gapDark: "#021a14", ring: "#6ee7b7" };
const PETROL: Pal = { bg: "#0d5566", band: "#0a4352", accent: "#ffc233", ink: "#031a22", cap: "#5fe0d0,#0e7f8c 55%,#042a30", cap2: "#22d3ee,#0e6b73 55%,#042a30", gapMid: "#0e6b7e", gapDark: "#031a22", ring: "#5fe0d0" };
const VS_PAL: Pal[] = [OCEAN, TEAL, PETROL];
const PAPER_SEQ: Record<string, number[]> = { protection: [3, 1], debt: [1, 3], portfolio: [2] };
const HEAD_TINT: Record<string, string> = { wealth: "#34208a", debt: "#8f1f2b", savings: "#2347f5", protection: "#7a1428" };

// ---- Pantallas "tienes vs recomendado" con cifras en amarillo: panel azul con barra amarilla sobre negro (variant 1) y escáner térmico (variant 2) ----
const COVER = /insurance|policy|cover/i;

function useVsNumbers(active: boolean, kind: StatT["kind"], have: number, rec: number, r: RefObject<HTMLDivElement>) {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const h = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  const hv = statParts(kind, have);
  const rv = statParts(kind, rec);
  const dv = statParts(kind, Math.abs(rec - have));
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setOn(true), reduced() ? 0 : 350);
    const s1 = hv.fmt ? tweenText(a.current, withSuf(hv.fmt, hv.small), 0, hv.target, 450, 1500) : () => {};
    const s2 = rv.fmt ? tweenText(b.current, withSuf(rv.fmt, rv.small), 0, rv.target, 950, 1500) : () => {};
    const s3 = dv.fmt ? tweenText(h.current, withSuf(dv.fmt, dv.small), 0, dv.target, 1500, 1200) : () => {};
    const t2 = window.setTimeout(() => {
      if (r.current && have >= rec) sparks(r.current, W / 2, 300, ["#ffd21f", "#2450e8", "#fff"], 22);
    }, 2600);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      s1();
      s2();
      s3();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return { a, b, h, on, hv, rv, dv };
}

// Pie de la diferencia: "STILL UNCOVERED" en seguros, "SHORT OF THE TARGET" en el resto.
function vsCaption(kind: StatT["kind"], kicker: string, word: string, have: number, rec: number, still: boolean) {
  const W = word.toUpperCase();
  const pts = kind === "pct" ? "POINTS " : "";
  if (have === rec) return `RIGHT ON THE ${W}`;
  if (have > rec) return `${pts}OVER THE ${W}`;
  return COVER.test(kicker) ? (still ? "STILL UNCOVERED" : "UNCOVERED") : `${pts}SHORT OF THE ${W}`;
}

function LifeScreen({ kicker, kind, have, rec, word, active }: { kicker: string; kind: StatT["kind"]; have: number; rec: number; word: string; active: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const { a, b, h, on, hv, rv, dv } = useVsNumbers(active, kind, have, rec, r);
  const below = have < rec;
  const ratio = rec === 0 ? 1 : clamp01(Math.max(0, have) / rec);
  const pill = below ? `${Math.round(ratio * 100)}% of the way` : COVER.test(kicker) ? "Fully covered" : "Target reached";
  return (
    <Slide bg="#050505" fg="#fff" active={active} r={r}>
      <div className="lf-tag ws-in" style={delay(".1s")}>{kicker}</div>
      <div className="lf-panel ws-in" style={delay(".2s")}>
        <span className="lf-k lf-k0">{word}</span>
        <span ref={b} className="ws-A lf-rec" style={{ fontSize: fit(rv.big.length + 1, 76, 250) }}>{rv.big + pctSuf(rv.small)}</span>
        <div className="lf-div" />
        <div className="lf-diff ws-in" style={delay(".9s")}>
          <span ref={h} className="ws-A lf-dn" style={{ fontSize: fit(dv.big.length + 1, 60, 250) }}>{dv.big + pctSuf(dv.small)}</span>
          <span className="lf-k">{vsCaption(kind, kicker, word, have, rec, true)}</span>
        </div>
        <div className="lf-bar" style={{ transform: on ? "none" : "translateY(101%)", transition: reduced() ? "none" : "transform 1s cubic-bezier(.2,.9,.25,1.05) .2s" }}>
          <span ref={a} className="ws-A lf-hn" style={{ fontSize: fit(hv.big.length + 1, 48, 190) }}>{hv.big + pctSuf(hv.small)}</span>
          <span className="lf-hl">You<br />have</span>
        </div>
      </div>
      <div className="ws-A lf-pill ws-in" style={delay("1.6s")}>{pill}</div>
    </Slide>
  );
}

// Cinco siluetas "expuestas" vistas por una cámara térmica (cabeza, torso, brazos y piernas con distinta temperatura).
const FIG: [number, number][] = [[70, 222], [180, 222], [290, 222], [125, 384], [235, 384]];

function ScanScreen({ kicker, kind, have, rec, word, hl = "You have", active }: { kicker: string; kind: StatT["kind"]; have: number; rec: number; word: string; hl?: string; active: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const { a, b, h, hv, rv, dv } = useVsNumbers(active, kind, have, rec, r);
  const uid = useId().replace(/:/g, "");
  const covered = have >= rec;
  return (
    <Slide bg="#05030f" fg="#fff" active={active} r={r}>
      <svg className="sc-svg" viewBox="0 0 360 640" width="360" height="640" aria-hidden="true">
        <defs>
          <filter id={`th${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="7" result="t" />
            <feDisplacementMap in="b" in2="t" scale="7" result="d" />
            <feColorMatrix in="d" values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1" result="al" />
            <feComponentTransfer in="al">
              <feFuncR type="table" tableValues="0 0 .05 .5 .95 1 1" />
              <feFuncG type="table" tableValues="0 .85 .95 .9 .45 .12 .06" />
              <feFuncB type="table" tableValues="0 .8 .5 .05 0 0 0" />
            </feComponentTransfer>
          </filter>
          <filter id={`gn${uid}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency=".95" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -.55" />
          </filter>
          <radialGradient id={`ub${uid}`} cx="50%" cy="55%" r="75%">
            <stop offset="0" stopColor="#1b1052" />
            <stop offset=".6" stopColor="#0d0830" />
            <stop offset="1" stopColor="#05030f" />
          </radialGradient>
        </defs>
        <rect width="360" height="640" fill="#000" />
        <g filter={`url(#th${uid})`}>
          {FIG.map(([x, y], i) => {
            const sw = (i % 2 ? 1 : -1) * 5;
            return (
              <g key={i} transform={`translate(${x} ${y})`} fill="#fff">
                <circle cx="0" cy="14" r="10" opacity=".85" />
                <ellipse cx="0" cy="52" rx="17" ry="29" />
                <ellipse cx="-22" cy="55" rx="5" ry="22" transform={`rotate(${8 + sw} -22 55)`} opacity=".55" />
                <ellipse cx="22" cy="55" rx="5" ry="22" transform={`rotate(${-8 + sw} 22 55)`} opacity=".55" />
                <ellipse cx="-8" cy="106" rx="7.5" ry="30" transform={`rotate(${5 + sw} -8 106)`} opacity=".62" />
                <ellipse cx="9" cy="108" rx="7.5" ry="30" transform={`rotate(${-7 + sw} 9 108)`} opacity=".5" />
              </g>
            );
          })}
        </g>
        <rect width="360" height="640" fill={`url(#ub${uid})`} style={{ mixBlendMode: "screen" }} />
        {FIG.map(([x, y], i) => {
          const x0 = x - 33;
          const y0 = y - 4;
          return (
            <g key={i} className="sc-bx" style={{ animationDelay: `${1.2 + i * 0.35}s` }}>
              <rect x={x0} y={y0} width="66" height="140" fill="none" stroke={covered ? "#3ddba0" : "#ffd21f"} strokeWidth="1.6" />
              <text x={x0} y={y0 - 5} className="sc-mono" fontSize="9.5" fill={covered ? "#3ddba0" : "#ffd21f"}>{`${covered ? "COVERED" : "EXPOSED"}_0${i + 1}XY`}</text>
              <rect x={x0} y={y0 + 126} width="66" height="14" fill={covered ? "#3ddba0" : "#ffd21f"} />
              <text x={x0 + 4} y={y0 + 136} className="sc-mono" fontSize="8.5" fill="#111">{covered ? "PROTECTED" : "UNPROTECTED"}</text>
            </g>
          );
        })}
        <rect width="360" height="640" filter={`url(#gn${uid})`} opacity=".35" style={{ mixBlendMode: "multiply" }} />
        <g className="sc-scan">
          <rect x="0" y="-12" width="360" height="3" fill="#ffd21f" />
          <rect x="0" y="-60" width="360" height="48" fill="#ffd21f" opacity=".07" />
        </g>
      </svg>
      <div className="ws-lab sc-lab ws-in" style={delay(".1s")}>{kicker}</div>
      <div className="sc-top ws-in" style={delay(".15s")}>
        <span ref={h} className="ws-A sc-n" style={{ fontSize: fit(dv.big.length + 1, 74, 312) }}>{dv.big + pctSuf(dv.small)}</span>
        <span className="sc-c">{vsCaption(kind, kicker, word, have, rec, false)}</span>
      </div>
      <div className="sc-bot ws-in" style={delay("1s")}>
        <div className="sc-col" style={{ left: 24 }}>
          <span className="sc-k">{hl}</span>
          <span ref={a} className="ws-A sc-v" style={{ fontSize: fit(hv.big.length + 1, 34, 150) }}>{hv.big + pctSuf(hv.small)}</span>
        </div>
        <div className="sc-col" style={{ left: 200 }}>
          <span className="sc-k">{word}</span>
          <span ref={b} className="ws-A sc-v sc-y" style={{ fontSize: fit(rv.big.length + 1, 34, 150) }}>{rv.big + pctSuf(rv.small)}</span>
        </div>
      </div>
    </Slide>
  );
}

// ---- Variante 0: dos pilares amarillos con tapa roja sobre azul puro (altura proporcional a las cifras) ----
const PIL_BASE = 648;
const PIL_MAX = 310;

function PillarScreen({ kicker, kind, have, rec, word, hl = "You have", active }: { kicker: string; kind: StatT["kind"]; have: number; rec: number; word: string; hl?: string; active: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const { a, b, h, on, hv, rv, dv } = useVsNumbers(active, kind, have, rec, r);
  const uid = useId().replace(/:/g, "");
  const max = Math.max(Math.abs(have), Math.abs(rec)) || 1;
  // Si en alguna barra el texto no cabe debajo, las dos lo llevan encima del muñeco; si cabe en las dos, las dos dentro.
  // Con el texto encima, la barra más alta se acorta para que su texto nunca toque el título (que acaba hacia y=216).
  const h0 = (v: number) => Math.max(46, (Math.max(0, v) / max) * PIL_MAX);
  const up = [have, rec].some((v) => PIL_BASE - h0(v) + 96 + 64 > 628);
  const ht = (v: number) => (up ? Math.max(46, (Math.max(0, v) / max) * (PIL_BASE - 216 - 170)) : h0(v));
  const P = [
    { cx: 108, top: PIL_BASE - ht(have), flip: true, ref: a, v: hv, lab: hl, id: "p1" },
    { cx: 252, top: PIL_BASE - ht(rec), flip: false, ref: b, v: rv, lab: word, id: "p2" },
  ];
  const num = (len: number, base: number, width: number) => Math.min(base, width / (Math.max(len, 1) * 0.6));
  return (
    <Slide bg="#0d19e6" fg="#fff" active={active} r={r}>
      <svg className="pl-svg" viewBox="0 0 360 640" width="360" height="640" aria-hidden="true">
        <defs>
          <pattern id={`ht${uid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <rect width="4" height="4" fill="#fff" />
            <circle cx="2" cy="2" r="1.1" fill="#111" />
          </pattern>
          <g id={`man${uid}`}>
            <rect x="-6" y="-24" width="4.6" height="24" fill="#151515" transform="rotate(4 -4 -24)" />
            <rect x="1.6" y="-24" width="4.6" height="24" fill="#151515" transform="rotate(-4 4 -24)" />
            <rect x="-8" y="-42" width="16" height="21" rx="3" fill={`url(#ht${uid})`} stroke="#111" strokeWidth=".8" />
            <rect x="-13" y="-41" width="5" height="17" rx="2" fill={`url(#ht${uid})`} stroke="#111" strokeWidth=".8" transform="rotate(8 -10 -41)" />
            <rect x="8" y="-41" width="5" height="17" rx="2" fill={`url(#ht${uid})`} stroke="#111" strokeWidth=".8" transform="rotate(-8 10 -41)" />
            <circle cx="0" cy="-48" r="5.6" fill="#151515" />
          </g>
          <g id={`sh${uid}`}>
            <rect x="-6" y="-24" width="4.6" height="24" />
            <rect x="1.6" y="-24" width="4.6" height="24" />
            <rect x="-13" y="-42" width="26" height="21" />
            <circle cx="0" cy="-48" r="5.6" />
          </g>
          {P.map((p) => (
            <clipPath key={p.id} id={`e${p.id}${uid}`}><ellipse cx={p.cx} cy={p.top} rx="56" ry="16" /></clipPath>
          ))}
        </defs>
        <circle cx="332" cy="46" r="8" fill="#e8101c" />
        {P.map((p, i) => (
          <g key={p.id} className={`pl-g${on ? " pl-on" : ""}`}>
            <rect className="pl-col" style={{ transitionDelay: `${i * 0.2}s` }} x={p.cx - 56} y={p.top} width="112" height={PIL_BASE - p.top + 4} fill="#ffd21f" />
            <g className="pl-top" style={{ transitionDelay: `${0.9 + i * 0.25}s` }}>
              <ellipse cx={p.cx} cy={p.top} rx="56" ry="16" fill="#e8101c" />
              <g clipPath={`url(#e${p.id}${uid})`}>
                <use href={`#sh${uid}`} transform={`translate(${p.cx} ${p.top + 2}) matrix(1.5 0 .6 -.3 0 0)`} />
              </g>
              <use href={`#man${uid}`} transform={`translate(${p.cx} ${p.top + 5}) scale(${p.flip ? -1.7 : 1.7} 1.7)`} />
            </g>
          </g>
        ))}
      </svg>
      <div className="ws-lab pl-lab ws-in" style={delay(".1s")}>{kicker}</div>
      <div className="pl-head ws-in" style={delay(".15s")}>
        <span ref={h} className="pl-big" style={{ fontSize: num(dv.big.length + pctSuf(dv.small).length, 104, 300) }}>{dv.big + pctSuf(dv.small)}</span>
        <span className="pl-cap">{vsCaption(kind, kicker, word, have, rec, false)}</span>
      </div>
      {P.map((p, i) => (
        <div key={p.id} className={`pl-n ws-in${up ? " pl-up" : ""}`} style={{ ...delay(`${1.3 + i * 0.2}s`), left: p.cx - 56, top: up ? p.top - 170 : p.top + 96 }}>
          <span ref={p.ref} className="pl-v" style={{ fontSize: num(p.v.big.length + pctSuf(p.v.small).length, 33, 100) }}>{p.v.big + pctSuf(p.v.small)}</span>
          <span className="pl-l">{p.lab}</span>
        </div>
      ))}
    </Slide>
  );
}

// ---- Panel "More information": el detalle completo de la sección, en el mismo estilo que la historia ----
type LineChartT = Extract<NonNullable<Section["chart"]>, { kind: "line" }>;
type BarsChartT = Extract<NonNullable<Section["chart"]>, { kind: "bars" }>;
const cell = (c: string | { kind: StatT["kind"]; value: number }) => (typeof c === "string" ? c : formatStat(c.kind, c.value));
const TILE_GRAD = ["#8b5cf6,#4c1d95", "#ff6a3d,#b3141f", "#0fa968,#0b6b45", "#ec4899,#7e1d6a", "#22d3ee,#0e6b73", "#f59e0b,#b45309"];

// Una cifra de la sección en su tarjeta de color; el número cuenta hacia arriba al entrar.
function NumberTile({ s, i }: { s: StatT; i: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const { big, small, fmt, target } = statParts(s.kind, s.value);
  const neg = typeof s.value === "number" && s.value < 0;
  useEffect(() => (fmt ? tweenText(el.current, fmt, 0, target, 150 + i * 90, 1000) : undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="wm-tile" style={{ background: `linear-gradient(145deg,${neg ? "#ff4d17,#8a1010" : TILE_GRAD[i % TILE_GRAD.length]})`, animationDelay: `${i * 0.06}s` }}>
      <span className="wm-tl">{s.label}</span>
      <span className="ws-A wm-tv" style={{ fontSize: Math.min(40, 138 / (Math.max(big.length, 3) * 0.56)) }}>
        <span className="wm-gh" aria-hidden="true">{big}</span>
        <span ref={el} className="wm-lv">{big}</span>
        {small && <em>{small}</em>}
      </span>
    </div>
  );
}

// Gráfico de línea con el mismo lenguaje: trazo con degradado que se dibuja, área, punto de pico y marca de "se acaban los ahorros".
function LineArt({ chart }: { chart: LineChartT }) {
  const pts = chart.points;
  if (pts.length < 2) return null;
  const w = 320, h = 210, pl = 8, pr = 8, pt = 26, pb = 26;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x: number) => pl + ((x - x0) / (x1 - x0 || 1)) * (w - pl - pr);
  const sy = (y: number) => pt + (1 - (y - y0) / (y1 - y0 || 1)) * (h - pt - pb);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(" ");
  const area = `${d} L${sx(x1).toFixed(1)} ${h - pb} L${sx(x0).toFixed(1)} ${h - pb} Z`;
  const pk = pts.reduce((a, p) => (p[1] > a[1] ? p : a), pts[0]);
  const mk = chart.markAge !== null && chart.markAge >= x0 && chart.markAge <= x1 ? chart.markAge : null;
  const near = mk === null ? null : pts.reduce((a, p) => (Math.abs(p[0] - mk) < Math.abs(a[0] - mk) ? p : a), pts[0]);
  const clampX = (x: number) => Math.max(46, Math.min(w - 46, x));
  return (
    <div className="wm-chart">
      <p className="wm-cap">{chart.title}</p>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={chart.title}>
        <defs>
          <linearGradient id="wm-l" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="wm-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.5" />
            <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#wm-a)" className="wm-fade" />
        <path d={d} fill="none" stroke="url(#wm-l)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="wm-draw" />
        <line x1={pl} x2={w - pr} y1={h - pb} y2={h - pb} stroke="rgba(255,255,255,.18)" />
        {mk !== null && near && (
          <g className="wm-fade" style={{ animationDelay: "1.2s" }}>
            <line x1={sx(mk)} x2={sx(mk)} y1={pt - 6} y2={h - pb} stroke="#ff6a3d" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx={sx(mk)} cy={sy(near[1])} r="5.5" fill="#ff6a3d" stroke="#0b0720" strokeWidth="2" />
            <text x={clampX(sx(mk))} y={pt - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ff9a6e">Savings run out · {Math.round(mk)}</text>
          </g>
        )}
        <g className="wm-fade" style={{ animationDelay: "1s" }}>
          <circle cx={sx(pk[0])} cy={sy(pk[1])} r="5.5" fill="#fff" stroke="#8b5cf6" strokeWidth="2.5" />
          <text x={clampX(sx(pk[0]))} y={sy(pk[1]) - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">Peak {formatCompactUSD(pk[1])}</text>
        </g>
        <text x={pl} y={h - 7} fontSize="10.5" fontWeight="600" fill="rgba(255,255,255,.6)">Age {Math.round(x0)}</text>
        <text x={w - pr} y={h - 7} textAnchor="end" fontSize="10.5" fontWeight="600" fill="rgba(255,255,255,.6)">Age {Math.round(x1)}</text>
      </svg>
    </div>
  );
}

// Gráfico de barras: cada elemento con su barra y, si lo tiene, la marca del objetivo.
function BarsArt({ chart }: { chart: BarsChartT }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(true), 150);
    return () => window.clearTimeout(t);
  }, []);
  const max = Math.max(...chart.items.map((i) => Math.max(i.value, i.target ?? 0)), 1);
  const fmt = (v: number) => formatStat(chart.ratio ? "pct" : "usd", v);
  return (
    <div className="wm-chart">
      <p className="wm-cap">{chart.title}</p>
      {chart.items.map((it, i) => (
        <div key={it.label} className="wm-bar">
          <div className="wm-barh">
            <span>{it.label}</span>
            <b className="ws-A">{fmt(it.value)}</b>
          </div>
          <div className="wm-bart">
            <div className="wm-barf" style={{ width: on ? `${Math.max(2, (it.value / max) * 100)}%` : "0%", background: `linear-gradient(90deg,${ROW_GRAD[i % ROW_GRAD.length]})`, transitionDelay: `${i * 0.08}s` }} />
            {it.target !== undefined && <span className="wm-bartg" style={{ left: `${(it.target / max) * 100}%` }} />}
          </div>
          {it.target !== undefined && <span className="wm-barn">Target {fmt(it.target)}</span>}
        </div>
      ))}
    </div>
  );
}

type MoreTab = "numbers" | "chart" | "table" | "insights";
const TAB_LABEL: Record<MoreTab, string> = { numbers: "Numbers", chart: "Chart", table: "Table", insights: "Insights" };

function moreTabs(section: Section): MoreTab[] {
  const t: MoreTab[] = [];
  if (section.stats.length > 0) t.push("numbers");
  if (section.chart) t.push("chart");
  if (section.table && section.table.rows.length > 0) t.push("table");
  if (section.observations.length > 0 || (section.recommendations?.length ?? 0) > 0 || section.lookInto) t.push("insights");
  return t;
}

function MorePanel({ section, onClose, initial }: { section: Section; onClose: () => void; initial?: string }) {
  const tabs = moreTabs(section);
  const [tab, setTab] = useState<MoreTab>(tabs.find((x) => x === initial) ?? tabs[0]);
  const body = useRef<HTMLDivElement>(null);
  const go = (t: MoreTab) => {
    setTab(t);
    body.current?.scrollTo({ top: 0 });
  };
  return (
    <div className="wm" style={{ background: moreTheme(section.id).bg }}>
      <div className="wm-h">
        <div>
          <div className="wm-k">More information</div>
          <div className="ws-A wm-t">{section.title}</div>
        </div>
        <button type="button" className="wm-x" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="wm-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => go(t)}>{TAB_LABEL[t]}</button>
        ))}
      </div>
      <div className="wm-b" ref={body} key={tab}>
        {tab === "numbers" && <div className="wm-grid">{section.stats.map((s, i) => <NumberTile key={s.label} s={s} i={i} />)}</div>}
        {tab === "chart" && section.chart && (section.chart.kind === "line" ? <LineArt chart={section.chart} /> : <BarsArt chart={section.chart} />)}
        {tab === "table" && section.table && (
          <div className="wm-rows">
            {section.table.rows.map((r, i) => (
              <div key={i} className="wm-tr" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="wm-tt">{cell(r[0])}</div>
                <div className="wm-tg">
                  {r.slice(1).map((c, j) => (
                    <div key={j}>
                      <span>{section.table?.columns[j + 1]}</span>
                      <b>{cell(c)}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "insights" && (
          <div className="wm-ins">
            {section.observations.map((o, i) => (
              <div key={i} className="wm-in" style={{ animationDelay: `${i * 0.07}s` }}>
                <span className="ws-A wm-n">{i + 1}</span>
                <p>{o}</p>
              </div>
            ))}
            {(section.recommendations?.length ?? 0) > 0 && <div className="wm-sub">What to consider</div>}
            {section.recommendations?.map((o, i) => (
              <div key={`r${i}`} className="wm-in wm-rec" style={{ animationDelay: `${(section.observations.length + i) * 0.07}s` }}>
                <span className="ws-A wm-n">→</span>
                <p>{o}</p>
              </div>
            ))}
            {section.lookInto && <div className="wm-look">{section.lookInto}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// Cada sección tiene su propio color en el panel y en la pantalla final.
type MoreTheme = { bg: string; a: string; b: string };
const MORE_THEME: Record<string, MoreTheme> = {
  retirement: { bg: "#0b0720", a: "#7c3aed", b: "#ec4899" },
  wealth: { bg: "#1a0508", a: "#dc2626", b: "#f97316" },
  debt: { bg: "#04140c", a: "#059669", b: "#84cc16" },
  savings: { bg: "#050d1f", a: "#2563eb", b: "#06b6d4" },
  protection: { bg: "#1a0414", a: "#db2777", b: "#7c3aed" },
  portfolio: { bg: "#031418", a: "#0891b2", b: "#22c55e" },
};
const moreTheme = (id: string): MoreTheme => MORE_THEME[id] ?? MORE_THEME.retirement;

// Última pantalla de la historia: invita a abrir el detalle completo.
function MoreScreen({ section, active, onOpen }: { section: Section; active: boolean; onOpen: (tab?: string) => void }) {
  const r = useRef<HTMLDivElement>(null);
  const th = moreTheme(section.id);
  const tabs = moreTabs(section);
  return (
    <Slide bg={th.bg} fg="#fff" active={active} r={r}>
      <div className="ws-blob" style={{ width: 340, height: 340, background: th.a, left: -120, top: 330, opacity: 0.6 }} />
      <div className="ws-blob" style={{ width: 260, height: 260, background: th.b, right: -100, top: -60, opacity: 0.45, animationDelay: "-4s" }} />
      <div className="ws-lab ws-in" style={delay(".1s")}>{section.title}</div>
      <div className="wm-end">
        <div className="ws-A ws-in" style={{ ...delay(".25s"), fontSize: 68, lineHeight: 0.95 }}>The full<br />picture</div>
        <div className="wm-chips ws-in" style={delay(".6s")}>
          {tabs.map((t) => (
            <button key={t} type="button" data-nohit onClick={() => onOpen(t)}>{TAB_LABEL[t]}</button>
          ))}
        </div>
      </div>
      <div className="ws-s1b">
        <button type="button" className="ws-pill wm-big ws-in" data-nohit style={delay(".9s")} onClick={() => onOpen()}>More information</button>
      </div>
    </Slide>
  );
}

// ---- Motor común: lienzo escalado, progreso, toques, teclado, transición de tiras y panel de números ----
type Rows = [string, string][];

function StoryEngine({ n, render, light, label, hasMore, more, startAt }: { n: number; render: (i: number, active: boolean, openSheet: (rows: Rows) => void, openMore: (tab?: string) => void) => ReactNode; light: (i: number) => boolean; label: string; hasMore: boolean; more?: (close: () => void, tab?: string) => ReactNode; startAt?: number }) {
  const [s, setS] = useState<{ idx: number; prev: number | null; ready: boolean }>({ idx: Math.min(Math.max(0, startAt ?? 0), n - 1), prev: null, ready: true });
  const [sheet, setSheet] = useState<Rows | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreTab, setMoreTab] = useState<string | undefined>();
  const openMore = (tab?: string) => {
    setMoreTab(tab);
    setMoreOpen(true);
  };
  const [k, setK] = useState(1);
  const busy = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const newL = useRef<HTMLDivElement>(null);
  const oldL = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const upd = () => setK(Math.min(1.25, Math.max(0.5, el.clientWidth / W)));
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goTo = (to: number) => {
    if (busy.current || sheet || moreOpen || to < 0 || to >= n || to === s.idx) return;
    busy.current = true;
    const rm = reduced();
    setS((p) => ({ idx: to, prev: rm ? null : p.idx, ready: rm }));
  };

  useLayoutEffect(() => {
    if (s.prev === null) {
      busy.current = false;
      return;
    }
    const nw = newL.current;
    const old = oldL.current;
    if (!nw || !old) return;
    nw.style.clipPath = "polygon(0 0,0 0,0 0)";
    const stop = comb(nw, old, s.idx < s.prev, () => {
      nw.style.clipPath = "none";
      setS((p) => ({ ...p, prev: null, ready: true }));
    });
    const t = window.setTimeout(() => setS((p) => (p.idx === s.idx ? { ...p, ready: true } : p)), 320);
    return () => {
      stop();
      window.clearTimeout(t);
    };
  }, [s.idx, s.prev]);

  const onTap = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-nohit]") || sheet || moreOpen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.28) goTo(s.idx - 1);
    else if (s.idx === n - 1) {
      if (hasMore) wrap.current?.nextElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else goTo(s.idx + 1);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && moreOpen) {
      setMoreOpen(false);
      return;
    }
    if (e.target !== e.currentTarget || moreOpen) return;
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goTo(s.idx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(s.idx - 1);
    }
  };

  const fg = light(s.idx) ? "#141414" : "#fff";
  return (
    <div ref={wrap} className="ws-wrap" style={{ height: H * k }}>
      <div className="ws-scale" style={{ transform: `scale(${k})` }}>
        <div className="ws-stage" role="group" tabIndex={0} aria-label={label} onClick={onTap} onKeyDown={onKey}>
          {s.prev !== null && (
            <div key={s.prev} ref={oldL} className="ws-layer">
              {render(s.prev, true, setSheet, openMore)}
            </div>
          )}
          <div key={s.idx} ref={newL} className="ws-layer">
            {render(s.idx, s.ready, setSheet, openMore)}
          </div>
          <div className="ws-pg" style={{ color: fg }} aria-hidden="true">
            {Array.from({ length: n }, (_, i) => (
              <i key={i} className={i <= s.idx ? "on" : ""} />
            ))}
          </div>
          <div className="ws-hint" style={{ color: fg }} aria-hidden="true">
            {s.idx === n - 1 ? (hasMore ? "Scroll for the details ↓" : "") : "Tap"}
          </div>
          <div className={`ws-sheet${sheet ? " open" : ""}`} data-nohit onClick={(e) => e.stopPropagation()}>
            {sheet && (
              <dl>
                {sheet.map(([a, b]) => (
                  <Fragment key={a}>
                    <dt>{a}</dt>
                    <dd>{b}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
            <button type="button" onClick={() => setSheet(null)}>Close</button>
          </div>
          {more && (
            <div className={`ws-more${moreOpen ? " open" : ""}`} data-nohit onClick={(e) => e.stopPropagation()}>
              {moreOpen && more(() => setMoreOpen(false), moreTab)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Pareja: cada uno ha respondido por su cuenta; aquí se ve en qué coinciden y qué dice el plan ----
// Fondos degradados de las preguntas de pareja: manchones de color con negros y blancos (aurora = coinciden; ember y mint, las demás).
type PairFx = { bg: string; b: string; bl: [number, number, string, string, number, number][] };
const PR_FX: PairFx[] = [
  { bg: "#050314", b: "#ff5a6e", bl: [[300, 300, "left:-80px;top:40px", "#1f3dff", 1, 9], [280, 280, "right:-100px;top:210px", "#8b2cf5", 2, 11], [220, 220, "left:60px;bottom:-40px", "#bfe9ff", 3, 10], [240, 240, "right:-20px;top:-60px", "#0a0620", 1, 13]] },
  { bg: "#0c0707", b: "#4de1ff", bl: [[280, 280, "left:-70px;top:60px", "#FF9A00", 1, 9], [260, 260, "right:-90px;top:180px", "#FF3B2E", 2, 11], [300, 300, "left:30px;bottom:-30px", "#FF2E7A", 3, 10], [240, 240, "right:0;top:-40px", "#1a0a06", 1, 13]] },
  { bg: "#070a09", b: "#ff5a6e", bl: [[280, 280, "left:-70px;top:60px", "#00E5A0", 1, 9], [260, 260, "right:-90px;top:180px", "#e8fff6", 2, 11], [300, 300, "left:30px;bottom:-30px", "#0b6b50", 3, 10], [240, 240, "right:0;top:-40px", "#0a0a0a", 1, 13]] },
];
const PR_A = "#ffd21f";
const TOPIC_LABEL: Record<string, string> = { colchon: "Cash cushion", mezcla: "Investment mix", tarjeta: "Credit card", seguro: "Life insurance", ahorros: "Savings", destino: "Retirement saving", fiscal: "Taxes" };
const topicOf = (p: Probe) => TOPIC_LABEL[p.id] ?? "Your plan";

// Una pregunta de pareja: una escala con la marca de cada uno y la del plan.
function PairScreen({ probe, couple, pi, total, active, onNumbers }: { probe: Probe; couple: CoupleData; pi: number; total: number; active: boolean; onNumbers: () => void }) {
  const r = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [a, b] = couple.people.map((_, i) => couple.answers[i]?.[probe.id] ?? probe.input.initial);
  const real = truthValue(probe);
  const agree = agreeOn(probe, a, b);
  const fx = agree ? PR_FX[0] : PR_FX[1 + (pi % 2)];
  const { min, max } = probe.input;
  const X = (v: number) => 24 + clamp01((v - min) / (max - min || 1)) * 312;
  const xa = X(a);
  const xb = X(b);
  const xp = real === null ? 336 : X(real);
  const lx = (x: number) => Math.max(62, Math.min(298, x));
  const planTxt = real === null ? "Never runs out" : formatValue(probe.input, real);
  const planHw = Math.max(planTxt.length, 4) * 5.6;
  const lxp = Math.max(planHw + 12, Math.min(348 - planHw, xp));
  const T = 366;
  const same = Math.abs(xa - xb) < 6;
  const close = !same && Math.abs(xa - xb) < 84;
  const q = probe.question;
  const nameA = couple.people[0].name.split(" ")[0];
  const nameB = couple.people[1].name.split(" ")[0];

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setOn(true), reduced() ? 0 : 700);
    return () => {
      window.clearTimeout(t);
      setOn(false);
    };
  }, [active]);

  const open = () => onNumbers();
  return (
    <Slide bg={fx.bg} fg="#fff" active={active} r={r}>
      {fx.bl.map(([w, h, pos, c, k, t], j) => (
        <div key={j} className="fl-blob" style={{ width: w, height: h, ...Object.fromEntries(pos.split(";").map((d) => d.split(":"))), background: c, animation: `fl-d${k} ${t}s ease-in-out infinite` }} />
      ))}
      <div className="fl-vig" />
      <div className="fl-grain" />
      <div className="pr-lab ws-in" style={delay(".1s")}>{topicOf(probe)} · {pi + 1} of {total}</div>
      <div className="pr-q ws-in" style={{ ...delay(".25s"), fontSize: q.length > 62 ? 22 : 25, color: "#fff", WebkitTextStrokeColor: "#fff" }}>{q}</div>
      <div className="pr-badge ws-in" style={{ ...delay(".9s"), top: 200, background: agree ? "#050505" : "#ffd21f", color: agree ? "#ffd21f" : "#16181d" }}>{agree ? "You agree" : "You see it differently"}</div>
      <div className="pr-trk ws-in" style={{ ...delay(".5s"), top: T, background: "rgba(0,0,0,.55)", boxShadow: "0 0 0 1.5px rgba(255,255,255,.35)" }} />
      <div className="pr-plan" style={{ left: xp, top: T - 62, height: 69, transform: on ? "scaleY(1)" : "scaleY(0)" }} />
      <div className="pr-nm" style={{ left: lxp, top: T - 112, fontSize: 14, opacity: on ? 1 : 0 }}>Plan<br />{planTxt}</div>
      <div className="pr-dot" style={{ left: on ? xa : 24, top: T, background: PR_A }} />
      <div className="pr-dot" style={{ left: on ? xb : 24, top: T, background: fx.b }} />
      {same ? (
        <div className="pr-nm" style={{ left: Math.max(92, Math.min(268, xa)), top: T + 34, opacity: on ? 1 : 0 }}>{nameA} & {nameB}<br />{formatValue(probe.input, a)}</div>
      ) : (
        <>
          <div className="pr-nm" style={{ left: lx(xa), top: T + 34, color: PR_A, opacity: on ? 1 : 0 }}>{nameA}<br />{formatValue(probe.input, a)}</div>
          <div className="pr-nm" style={{ left: lx(xb), top: T + (close ? 68 : 34), color: "#fff", opacity: on ? 1 : 0 }}>{nameB}<br />{formatValue(probe.input, b)}</div>
        </>
      )}
      <p className="pr-txt ws-in" style={{ ...delay("1.2s"), top: 490 }}>{coupleText(probe.id, coupleOutcome(probe, a, b))}</p>
      <button type="button" className="ws-pill pr-btn ws-in" data-nohit style={delay("1.5s")} onClick={open}>Show me the numbers</button>
    </Slide>
  );
}

// El resumen: dos círculos que se solapan (uno por persona); en la intersección, en cuántas preguntas coinciden.
function PairRecapScreen({ probes, couple, active }: { probes: Probe[]; couple: CoupleData; active: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const fx = PR_FX[0];
  const rows = probes.map((p) => {
    const [a, b] = couple.people.map((_, i) => couple.answers[i]?.[p.id] ?? p.input.initial);
    return { label: topicOf(p), agree: agreeOn(p, a, b) };
  });
  const n = rows.filter((x) => x.agree).length;
  const names = couple.people.map((x) => x.name.split(" ")[0]);
  const top = rows.length > 4 ? 446 : 470;

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setOn(true), reduced() ? 0 : 500);
    return () => {
      window.clearTimeout(t);
      setOn(false);
    };
  }, [active]);

  return (
    <Slide bg={fx.bg} fg="#fff" active={active} r={r}>
      {fx.bl.map(([w, h, pos, c, k, t], j) => (
        <div key={j} className="fl-blob" style={{ width: w, height: h, ...Object.fromEntries(pos.split(";").map((d) => d.split(":"))), background: c, animation: `fl-d${k} ${t}s ease-in-out infinite` }} />
      ))}
      <div className="fl-vig" />
      <div className="fl-grain" />
      <div className="pr-lab ws-in" style={delay(".1s")}>{names.join(" & ")}</div>
      <div className="pr-vn" style={{ left: on ? 46 : -130, top: 110, background: "#ffd21f", opacity: 0.92 }} />
      <div className="pr-vn" style={{ left: on ? 144 : 360, top: 110, background: "#ff4f87", opacity: 0.8 }} />
      <div className="pr-vname" style={{ left: 46, top: 292 }}>{names[0]}</div>
      <div className="pr-vname" style={{ left: 184, top: 292 }}>{names[1]}</div>
      <div className="pr-big ws-in" style={{ ...delay(".8s"), left: 0, width: W, top: 134, textAlign: "center", fontSize: 84, color: "#fff" }}>{n}<span> of {rows.length}</span></div>
      <div className="pr-q ws-in" style={{ ...delay(".9s"), top: 334, left: 0, width: W, textAlign: "center", fontSize: 22, color: "#fff", WebkitTextStrokeColor: "#fff" }}>{n === rows.length ? "You see it the same way" : n === 0 ? "You differ on every one" : `You agree on ${n} of ${rows.length}`}</div>
      {rows.map((x, i) => (
        <div key={x.label} className={`pr-chip ws-in${x.agree ? " ag" : ""}`} style={{ ...delay(`${1.1 + i * 0.15}s`), left: 24 + (i % 2) * 160, top: top + Math.floor(i / 2) * 54 }}>
          {x.agree ? "✓" : "≠"}&nbsp; {x.label}
        </div>
      ))}
    </Slide>
  );
}

// En pareja, "You have" pasa a ser el nombre de quien tiene el seguro (o "You both have" si es de los dos).
function haveLabel(kicker: string, couple: boolean) {
  if (!couple) return "You have";
  const m = kicker.match(/\(([^)]+)\)/);
  return m ? `${m[1]} has` : "You both have";
}

// ---- Una sección entera como historia ----
type Screen = { k: "head" } | { k: "you" | "plan" | "gap"; probe: Probe; pi?: number; px?: boolean; paper?: { diff: string; variant: number }; answer?: number; real?: number | null; x?: Extra; pal?: Pal } | { k: "vs"; kicker: string; kind: StatT["kind"]; have: number; rec: number; word: string; variant: number } | { k: "ring"; stat: StatT; i: number } | { k: "mq"; stat: StatT; i: number } | { k: "lineup"; stats: StatT[] } | { k: "pair"; probe: Probe; pi: number } | { k: "recap" } | { k: "more" };

export function WrappedStory({ section, probes, answers, hasMore, startAt, couple, recap }: { section: Section; probes: Probe[]; answers: Record<string, number>; hasMore: boolean; startAt?: number; couple?: CoupleData | null; recap?: Probe[] }) {
  const screens = useMemo<Screen[]>(() => {
    const out: Screen[] = [{ k: "head" }];
    // Primero el choque: lo que pensabas frente a lo que dice el plan, pregunta a pregunta.
    let pixelUsed = false;
    probes.forEach((probe, pi) => {
      const a0 = answers[probe.id] ?? probe.input.initial;
      const big = closeness(probe, a0, truthValue(probe)) === "Big surprise";
      const px = big && !pixelUsed;
      if (px) pixelUsed = true;
      if (couple) {
        out.push({ k: "pair", probe, pi });
        return;
      }
      (["you", "plan", "gap"] as const).forEach((k) => out.push({ k, probe, pi, px: k === "gap" && px, pal: pi > 0 ? ALT_PAL[(pi - 1) % ALT_PAL.length] : undefined }));
    });
    if (couple && recap && recap.length > 1) out.push({ k: "recap" });
    let vsN = 0;
    // Después las cifras clave de la sección, con los mismos formatos.
    // En pareja, "(you)" y "(partner)" pasan a ser los nombres de cada uno.
    const nm = (l: string) => (couple ? l.replace(/\(you\)/i, `(${couple.people[0].name.split(" ")[0]})`).replace(/\(partner\)/i, `(${couple.people[1].name.split(" ")[0]})`) : l.replace(/\s*\((you|partner)\)/i, ""));
    const st = section.stats.map((x) => ({ ...x, label: nm(x.label) }));
    const skip = new Set<number>();
    const rest: { s: StatT; i: number }[] = [];
    st.forEach((s, i) => {
      if (skip.has(i) || typeof s.value !== "number") return;
      const nx = st[i + 1];
      if (nx && s.kind === nx.kind && typeof nx.value === "number" && /recommended|target/i.test(nx.label)) {
        // Lo que tienes frente a lo recomendado: el mismo choque que tu respuesta frente al plan.
        skip.add(i + 1);
        const below = s.value < nx.value;
        const tone: Tone = s.kind === "pct" ? "neutral" : below ? "bad" : "good";
        const word = /target/i.test(nx.label) ? "target" : "recommended";
        const probe = synth(s.kind, s.label, tone, [s.value, nx.value]);
        const va = scaled(s.kind, s.value);
        const vb = scaled(s.kind, nx.value);
        const rot = (vsN++ + (section.id.length % 3)) % 3;
        // En pareja los dos seguros de vida se cuentan igual (infrarrojo) y el paraguas con pilares, para poder compararlos.
        const variant = couple ? (/life insurance/i.test(s.label) ? 2 : /umbrella/i.test(s.label) ? 0 : rot) : rot;
        out.push({ k: "vs", kicker: s.label, kind: s.kind, have: s.value, rec: nx.value, word: word === "target" ? "Target" : "Recommended", variant });
        const pts = s.kind === "pct";
        const diff = pts ? (Math.abs(nx.value - s.value) * 100).toFixed(1) + "%" : formatStat(s.kind, Math.abs(nx.value - s.value));
        out.push({ k: "gap", probe, answer: va, real: vb, pal: VS_PAL[variant], paper: { diff, variant: PAPER_SEQ[section.id] ? PAPER_SEQ[section.id][(vsN - 1) % PAPER_SEQ[section.id].length] : variant }, x: { lab: s.label, verdict: va === vb ? `Right on the ${word}` : `${below ? "Below" : "Above"} the ${word}`, unitLabel: pts ? (below ? "points short" : "points over") : below ? "short" : "over" } });
        return;
      }
      if (isShare(s)) out.push({ k: "ring", stat: s, i });
      else rest.push({ s, i });
    });
    // Las cifras sueltas se agrupan por clase: una sola se cuenta con cinta, varias en barras en fila.
    (["usd", "months", "age", "pct", "text"] as const).forEach((kind) => {
      const g = rest.filter((x) => x.s.kind === kind);
      for (let j = 0; j < g.length; j += 4) {
        const ch = g.slice(j, j + 4);
        if (ch.length === 1) out.push({ k: "mq", stat: ch[0].s, i: ch[0].i });
        else out.push({ k: "lineup", stats: ch.map((x) => x.s) });
      }
    });
    if (moreTabs(section).length > 0) out.push({ k: "more" });
    return out;
  }, [probes, section, answers, couple, recap]);
  const light = (i: number) => {
    const sc = screens[i];
    if (!sc) return false;
    if (sc.k === "you") return true;
    // La pantalla de avisos (píxel) también es de fondo claro: el "Tap" y la barra deben ir oscuros.
    if (sc.k === "gap" && sc.px && !sc.x) return true;
    return false;
  };
  const render = (i: number, active: boolean, openSheet: (rows: Rows) => void, openMore: (tab?: string) => void) => {
    const sc = screens[i];
    if (!sc) return null;
    if (sc.k === "more") return <MoreScreen section={section} active={active} onOpen={openMore} />;
    if (sc.k === "pair") {
      if (!couple) return null;
      const pr = sc.probe;
      const [va, vb] = couple.people.map((_, j) => couple.answers[j]?.[pr.id] ?? pr.input.initial);
      const rl = truthValue(pr);
      const ctx = revealContext(pr);
      const names = couple.people.map((x) => x.name.split(" ")[0]);
      const rows: Rows = [["Question", pr.question], [names[0], formatValue(pr.input, va)], [names[1], formatValue(pr.input, vb)], ["Your plan says", rl === null ? "Your savings never run out" : formatValue(pr.input, rl)]];
      if (ctx) rows.push(["Detail", ctx]);
      return <PairScreen probe={pr} couple={couple} pi={sc.pi} total={probes.length} active={active} onNumbers={() => openSheet(rows)} />;
    }
    if (sc.k === "recap") return couple && recap ? <PairRecapScreen probes={recap} couple={couple} active={active} /> : null;
    if (sc.k === "head") {
      const h = section.headline;
      if (h && isShare(h) && typeof h.value === "number") return <RingScreen uid={`${section.id}-h`} kicker={section.title} label={h.label} value={h.value} canHold={section.id === "retirement"} active={active} />;
      if (h && typeof h.value === "number") return <MarqueeScreen kicker={section.title} label={h.label} kind={h.kind} value={h.value} variant={0} active={active} tint={HEAD_TINT[section.id]} />;
      return <YouScreen probe={synth("text", section.title, "neutral", [1])} answer={0} tone="neutral" active={active} x={{ lab: "Your plan" }} />;
    }
    if (sc.k === "ring") return <RingScreen uid={`${section.id}-${sc.i}`} kicker={section.title} label={sc.stat.label} value={sc.stat.value as number} canHold={false} active={active} fire={section.id === "debt" && i === screens.findIndex((q) => q.k === "ring")} />;
    if (sc.k === "vs") {
      if (sc.variant % 3 === 1) return <LifeScreen kicker={sc.kicker} kind={sc.kind} have={sc.have} rec={sc.rec} word={sc.word} active={active} />;
      if (sc.variant % 3 === 2) return <ScanScreen kicker={sc.kicker} kind={sc.kind} have={sc.have} rec={sc.rec} word={sc.word} hl={haveLabel(sc.kicker, !!couple)} active={active} />;
      return <PillarScreen kicker={sc.kicker} kind={sc.kind} have={sc.have} rec={sc.rec} word={sc.word} hl={haveLabel(sc.kicker, !!couple)} active={active} />;
    }
    if (sc.k === "mq") return <MarqueeScreen kicker={section.title} label={sc.stat.label} kind={sc.stat.kind} value={sc.stat.value} variant={sc.i + 1} active={active} />;
    if (sc.k === "lineup") return <LineupScreen kicker={section.title} stats={sc.stats} active={active} />;
    const p = sc.probe;
    const a = sc.answer ?? answers[p.id] ?? p.input.initial;
    const real = sc.real !== undefined ? sc.real : truthValue(p);
    const open = () => {
      const ctx = sc.x ? "" : revealContext(p);
      const rows: Rows = [
        ["Question", p.question],
        [sc.x?.said ?? "You said", formatValue(p.input, a)],
        [sc.x?.lab ?? "Your plan says", real === null ? "Your savings never run out" : formatValue(p.input, real)],
      ];
      if (ctx) rows.push(["Detail", ctx]);
      openSheet(rows);
    };
    if (sc.k === "you") return <YouScreen probe={p} answer={a} tone={p.tone} active={active} x={sc.x} />;
    if (sc.k === "plan") {
      if (!sc.x && p.input.unit === "$") return <CalcScreen probe={p} answer={a} real={real} active={active} onNumbers={open} />;
      if (!sc.x && (sc.pi ?? 0) > 0) return <FluidScreen probe={p} answer={a} real={real} pi={(sc.pi ?? 1) - 1} active={active} onNumbers={open} />;
      return <PlanScreen probe={p} answer={a} real={real} tone={p.tone} active={active} onNumbers={open} x={sc.x} pal={sc.pal} />;
    }
    if (sc.x && sc.paper) return <PaperScreen tag={sc.x.lab ?? ""} big={sc.paper.diff} word={sc.x.unitLabel ?? "short"} lines={splitVerdict(sc.x.verdict ?? "")} variant={sc.paper.variant} active={active} onNumbers={open} />;
    if (sc.px && !sc.x) return <PixelScreen probe={p} answer={a} real={real} active={active} onNumbers={open} x={sc.x} />;
    return <GapScreen probe={p} answer={a} real={real} tone={p.tone} active={active} onNumbers={open} x={sc.x} pal={sc.pal} />;
  };
  return <StoryEngine n={screens.length} render={render} light={light} label={`${section.title} recap`} hasMore={hasMore} startAt={startAt} more={(close, tab) => <MorePanel section={section} onClose={close} initial={tab} />} />;
}

// ---- La portada del análisis como historia ----
type CoverScreen = { k: "score" } | { k: "pillars" } | { k: "move"; i: number } | { k: "comb" };

export function CoverStory({ analysis, hasMore, startAt }: { analysis: Analysis; hasMore: boolean; startAt?: number }) {
  const s = analysis.score;
  const screens = useMemo<CoverScreen[]>(() => [{ k: "score" }, { k: "pillars" }, ...s.moves.map((_, i) => ({ k: "move", i }) as CoverScreen), ...(s.combined ? [{ k: "comb" } as CoverScreen] : [])], [s]);
  const render = (i: number, active: boolean, openSheet: (rows: Rows) => void) => {
    const sc = screens[i];
    if (!sc) return null;
    if (sc.k === "score") return <ScoreScreen s={s} active={active} onMeaning={() => openSheet([["Your score", `${s.value} / 100 · ${s.band}`], ["What it means", s.message]])} />;
    if (sc.k === "pillars") return <PillarsScreen pillars={s.pillars} active={active} />;
    if (sc.k === "move") return <MoveScreen moves={s.moves} i={sc.i} active={active} />;
    const c = s.combined;
    if (!c) return null;
    return <CombinedScreen c={c} before={s.value} active={active} onNote={() => openSheet([["Steps", c.moves.join(" · ")], ["Score after", String(c.scoreAfter)], ["Note", c.note]])} />;
  };
  return <StoryEngine n={screens.length} render={render} light={(i) => screens[i]?.k === "pillars" || (screens[i]?.k === "move" && (screens[i] as { i: number }).i % 3 === 1)} label="Your financial health recap" hasMore={hasMore} startAt={startAt} />;
}
