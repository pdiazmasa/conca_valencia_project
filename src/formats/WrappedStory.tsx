import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from "react";
import { formatStat, formatValue, revealContext, truthValue, type Analysis, type Probe, type ProbeInput, type Section, type Stat } from "../data";
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
  return { big: (neg ? "-" : "") + m[1] + m[2], small: m[3].trim(), fmt: neg ? (v: number) => "-" + base(v) : base, target: kind === "pct" ? Math.round(value * 1000) / 10 : Math.abs(value) };
}

// Anillo para una proporción. En Retirement, mantener pulsado enseña la parte que falta.
function RingScreen({ uid, kicker, label, value, canHold, active }: { uid: string; kicker: string; label: string; value: number; canHold: boolean; active: boolean }) {
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

  const press = (v: boolean) => () => canHold && setHold(v);
  return (
    <Slide bg="#0b0720" fg="#fff" active={active} r={r}>
      <div className="ws-blob" style={{ width: 320, height: 320, background: "#7c3aed", left: -110, top: 380, opacity: 0.65 }} />
      <div className="ws-blob" style={{ width: 260, height: 260, background: "#ec4899", right: -90, top: -70, opacity: 0.5, animationDelay: "-4s" }} />
      <div className="ws-lab ws-in" style={delay(".1s")}>{kicker}</div>
      <div className="ws-rw" data-nohit onPointerDown={press(true)} onPointerUp={press(false)} onPointerLeave={press(false)} onPointerCancel={press(false)}>
        <svg viewBox="-150 -150 300 300">
          <defs>
            <linearGradient id={`ws-g-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22d3ee" />
              <stop offset=".5" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#ff4d8d" />
            </linearGradient>
          </defs>
          <circle r="100" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="38" />
          {canHold && (
            <circle r="100" fill="none" stroke="#ff4040" strokeWidth="38" strokeDasharray={`${(1 - frac) * C} ${C}`} strokeDashoffset={hold ? 0 : (1 - frac) * C} transform={`rotate(${-90 + frac * 360})`} style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }} />
          )}
          <circle r="100" fill="none" stroke={`url(#ws-g-${uid})`} strokeWidth="38" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={filled ? C * (1 - frac) : C} transform="rotate(-90)" style={{ filter: "drop-shadow(0 0 16px rgba(139,92,246,.9))", opacity: hold ? 0.25 : 1, transition: "stroke-dashoffset 1.7s cubic-bezier(.2,.8,.2,1),opacity .4s" }} />
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
  const [n, unit] = splitValue(formatValue(probe.input, answer));
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

function PlanScreen({ probe, answer, real, tone, active, onNumbers, x }: { probe: Probe; answer: number; real: number | null; tone: Tone; active: boolean; onNumbers: () => void; x?: Extra }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const nd = useRef<SVGGElement>(null);
  const hl = useRef<SVGPathElement>(null);
  const my = useRef<SVGCircleElement>(null);
  const dial = useRef<SVGSVGElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const p = PAL[tone];
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
  const youRight = fa > fr; // la marca con mayor valor queda a la derecha
  const [lyx, lyy] = polar(fa, 162);
  const [lpx, lpy] = polar(fr, 162);
  const sz = fit(n.length, 220, 250);

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
          <text x={lyx + (youRight ? 8 : -8)} y={lyy + 3} fill="#fff" fontSize="11" fontWeight="600" letterSpacing="2" textAnchor={youRight ? "start" : "end"}>YOU</text>
          <text x={lpx + (youRight ? -8 : 8)} y={lpy + 3} fill="#fff" fontSize="11" fontWeight="600" letterSpacing="2" textAnchor={youRight ? "end" : "start"}>PLAN</text>
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
const GAP_LABEL: Record<ProbeInput["unit"], string> = { years: "years off", $: "off", "%": "points off", months: "months off", "years of salary": "years of salary off" };

function GapScreen({ probe, answer, real, tone, active, onNumbers, x }: { probe: Probe; answer: number; real: number | null; tone: Tone; active: boolean; onNumbers: () => void; x?: Extra }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const p = PAL[tone];
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
const EFFORT_TONE: Record<string, Tone> = { low: "good", medium: "neutral", high: "bad" };
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

// Un próximo paso: qué hacer, cuánto esfuerzo cuesta y cómo sube tu nota.
function MoveScreen({ m, i, n, active }: { m: ScoreT["moves"][number]; i: number; n: number; active: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const p = PAL[EFFORT_TONE[m.effort] ?? "neutral"];
  const gain = m.scoreAfter - m.scoreBefore;

  useEffect(() => {
    if (!active) return;
    return tweenText(numEl.current, round, m.scoreBefore, m.scoreAfter, 900, 1100);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg={p.bg} fg="#fff" active={active} r={r}>
      <div className="ws-band" style={{ left: 0, width: 12, background: p.ink, ...delay(".05s") }} />
      <div className="ws-band" style={{ left: 12, width: 20, background: p.band, ...delay(".15s") }} />
      <div className="ws-band" style={{ right: 0, width: 58, background: p.accent, ...delay(".25s") }} />
      <div className="ws-lab ws-in" style={{ ...delay(".2s"), left: 46 }}>Next step {i + 1} of {n}</div>
      <div className="ws-mv">
        <div className="ws-A ws-in" style={{ ...delay(".35s"), fontSize: m.title.length > 28 ? 30 : m.title.length > 18 ? 36 : 44, color: p.ink, lineHeight: 1.05 }}>{m.title}</div>
        <p className="ws-ma ws-in" style={delay(".6s")}>{m.action}</p>
      </div>
      <div className="ws-ms ws-in" style={delay(".9s")}>
        <span className="ws-A ws-mb" style={{ color: p.ink }}>{m.scoreBefore}</span>
        <span className="ws-mar">→</span>
        <span ref={numEl} className="ws-A ws-mn">{m.scoreBefore}</span>
      </div>
      <div className="ws-chip3 ws-mc ws-in" style={{ ...delay("1.4s"), background: p.ink, color: p.accent, opacity: undefined }}>{gain > 0 ? `+${gain} points` : "+0 on its own"}</div>
      <div className="ws-bv"><span className="ws-A" style={{ color: p.ink }}>Effort · {m.effort}</span></div>
    </Slide>
  );
}

// El efecto de hacerlo todo junto: anillos turquesa alrededor de la nota final.
function CombinedScreen({ c, before, active, onNote }: { c: NonNullable<ScoreT["combined"]>; before: number; active: boolean; onNote: () => void }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const p = PAL.good;

  useEffect(() => {
    if (!active) return;
    const stop = tweenText(numEl.current, round, before, c.scoreAfter, 500, 1200);
    const t = window.setTimeout(() => {
      if (r.current) sparks(r.current, W / 2, 300, [p.ring, "#fff", p.accent], 22);
    }, 1700);
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
      <div className="ws-lab ws-in" style={delay(".1s")}>Together</div>
      <div className="ws-hole ws-in" style={{ ...delay(".3s"), background: p.gapDark, borderColor: p.ring }}>
        <span ref={numEl} className="ws-A" style={{ fontSize: 150, lineHeight: 1 }}>{before}</span>
        <div className="ws-u" style={{ color: p.ring }}>SCORE IF YOU DO {c.moves.length === 1 ? "IT" : "THEM ALL"}</div>
      </div>
      <div className="ws-s4b">
        <div className="ws-A ws-in" style={delay(".8s")}>{before} → {c.scoreAfter}</div>
        <button type="button" className="ws-pill ws-in" data-nohit style={delay("1s")} onClick={onNote}>Show me the numbers</button>
      </div>
    </Slide>
  );
}

// ---- Dos formatos nuevos para las cifras sueltas: cinta giratoria y barras en fila ----
// Una cifra grande sobre cintas de texto que se desplazan en sentidos opuestos.
function MarqueeScreen({ kicker, label, kind, value, variant, active }: { kicker: string; label: string; kind: StatT["kind"]; value: number | string; variant: number; active: boolean }) {
  const r = useRef<HTMLDivElement>(null);
  const numEl = useRef<HTMLSpanElement>(null);
  const { big, small, fmt, target } = statParts(kind, value);
  const neg = typeof value === "number" && value < 0;
  const dark = variant % 2 === 1;
  const bg = neg ? PAL.bad.bg : dark ? "#0b0720" : PAL.neutral.bg;
  const line = neg ? "#150a06" : dark ? PAL.neutral.ring : "#ffd84a";
  const word = label.toUpperCase();
  const track = `${word} \u00a0•\u00a0 `.repeat(8);

  useEffect(() => {
    if (!active || !fmt) return;
    return tweenText(numEl.current, fmt, 0, target, 350, 1400);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide bg={bg} fg="#fff" active={active} r={r}>
      <div className="ws-mq ws-A" style={{ top: 96, transform: "rotate(-8deg)", color: "transparent", WebkitTextStrokeColor: line }}>
        <i>{track}{track}</i>
      </div>
      <div className="ws-mq ws-A" style={{ top: 470, transform: "rotate(-8deg)", color: "transparent", WebkitTextStrokeColor: line }}>
        <i style={{ animationDirection: "reverse" }}>{track}{track}</i>
      </div>
      <div className="ws-lab ws-in" style={delay(".1s")}>{kicker}</div>
      <div className="ws-mqn">
        <span ref={numEl} className="ws-A ws-in" style={{ ...delay(".25s"), fontSize: fit(big.length, 150, 320), lineHeight: 1, color: neg ? "#150a06" : line }}>{big}</span>
        {small && <div className="ws-mqs ws-in" style={delay(".6s")}>{small}</div>}
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

// ---- Motor común: lienzo escalado, progreso, toques, teclado, transición de tiras y panel de números ----
type Rows = [string, string][];

function StoryEngine({ n, render, light, label, hasMore }: { n: number; render: (i: number, active: boolean, openSheet: (rows: Rows) => void) => ReactNode; light: (i: number) => boolean; label: string; hasMore: boolean }) {
  const [s, setS] = useState<{ idx: number; prev: number | null; ready: boolean }>({ idx: 0, prev: null, ready: true });
  const [sheet, setSheet] = useState<Rows | null>(null);
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
    if (busy.current || sheet || to < 0 || to >= n || to === s.idx) return;
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
    if ((e.target as HTMLElement).closest("[data-nohit]") || sheet) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.28) goTo(s.idx - 1);
    else if (s.idx === n - 1) {
      if (hasMore) wrap.current?.nextElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else goTo(s.idx + 1);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
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
              {render(s.prev, true, setSheet)}
            </div>
          )}
          <div key={s.idx} ref={newL} className="ws-layer">
            {render(s.idx, s.ready, setSheet)}
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
        </div>
      </div>
    </div>
  );
}

// ---- Una sección entera como historia ----
type Screen = { k: "head" } | { k: "you" | "plan" | "gap"; probe: Probe; answer?: number; real?: number | null; x?: Extra } | { k: "ring"; stat: StatT; i: number } | { k: "mq"; stat: StatT; i: number } | { k: "lineup"; stats: StatT[] };

export function WrappedStory({ section, probes, answers, hasMore }: { section: Section; probes: Probe[]; answers: Record<string, number>; hasMore: boolean }) {
  const screens = useMemo<Screen[]>(() => {
    const out: Screen[] = [{ k: "head" }];
    // Primero el choque: lo que pensabas frente a lo que dice el plan, pregunta a pregunta.
    probes.forEach((probe) => (["you", "plan", "gap"] as const).forEach((k) => out.push({ k, probe })));
    // Después las cifras clave de la sección, con los mismos formatos.
    const st = section.stats;
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
        out.push({ k: "plan", probe, answer: va, real: vb, x: { lab: nx.label, said: "You have", vs: `vs ${word}` } });
        const pts = s.kind === "pct";
        out.push({ k: "gap", probe, answer: va, real: vb, x: { lab: s.label, verdict: va === vb ? `Right on the ${word}` : `${below ? "Below" : "Above"} the ${word}`, unitLabel: pts ? (below ? "points short" : "points over") : below ? "short" : "over" } });
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
    return out;
  }, [probes, section]);
  const light = (i: number) => {
    const sc = screens[i];
    if (!sc) return false;
    if (sc.k === "you") return true;
    return false;
  };
  const render = (i: number, active: boolean, openSheet: (rows: Rows) => void) => {
    const sc = screens[i];
    if (!sc) return null;
    if (sc.k === "head") {
      const h = section.headline;
      if (h && isShare(h) && typeof h.value === "number") return <RingScreen uid={`${section.id}-h`} kicker={section.title} label={h.label} value={h.value} canHold={section.id === "retirement"} active={active} />;
      if (h && typeof h.value === "number") return <MarqueeScreen kicker={section.title} label={h.label} kind={h.kind} value={h.value} variant={0} active={active} />;
      return <YouScreen probe={synth("text", section.title, "neutral", [1])} answer={0} tone="neutral" active={active} x={{ lab: "Your plan" }} />;
    }
    if (sc.k === "ring") return <RingScreen uid={`${section.id}-${sc.i}`} kicker={section.title} label={sc.stat.label} value={sc.stat.value as number} canHold={false} active={active} />;
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
    if (sc.k === "plan") return <PlanScreen probe={p} answer={a} real={real} tone={p.tone} active={active} onNumbers={open} x={sc.x} />;
    return <GapScreen probe={p} answer={a} real={real} tone={p.tone} active={active} onNumbers={open} x={sc.x} />;
  };
  return <StoryEngine n={screens.length} render={render} light={light} label={`${section.title} recap`} hasMore={hasMore} />;
}

// ---- La portada del análisis como historia ----
type CoverScreen = { k: "score" } | { k: "pillars" } | { k: "move"; i: number } | { k: "comb" };

export function CoverStory({ analysis, hasMore }: { analysis: Analysis; hasMore: boolean }) {
  const s = analysis.score;
  const screens = useMemo<CoverScreen[]>(() => [{ k: "score" }, { k: "pillars" }, ...s.moves.map((_, i) => ({ k: "move", i }) as CoverScreen), ...(s.combined ? [{ k: "comb" } as CoverScreen] : [])], [s]);
  const render = (i: number, active: boolean, openSheet: (rows: Rows) => void) => {
    const sc = screens[i];
    if (!sc) return null;
    if (sc.k === "score") return <ScoreScreen s={s} active={active} onMeaning={() => openSheet([["Your score", `${s.value} / 100 · ${s.band}`], ["What it means", s.message]])} />;
    if (sc.k === "pillars") return <PillarsScreen pillars={s.pillars} active={active} />;
    if (sc.k === "move") return <MoveScreen m={s.moves[sc.i]} i={sc.i} n={s.moves.length} active={active} />;
    const c = s.combined;
    if (!c) return null;
    return <CombinedScreen c={c} before={s.value} active={active} onNote={() => openSheet([["Steps", c.moves.join(" · ")], ["Score after", String(c.scoreAfter)], ["Note", c.note]])} />;
  };
  return <StoryEngine n={screens.length} render={render} light={(i) => screens[i]?.k === "pillars"} label="Your financial health recap" hasMore={hasMore} />;
}
