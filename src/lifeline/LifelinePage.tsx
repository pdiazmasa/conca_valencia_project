// Página principal y de sección para el formato Life line.
// Coloca cada hito del plan sobre los años y las edades reales de la familia.
// Móvil (< 1024 px): escenas apiladas con línea vertical. PC (≥ 1024 px): una sola pantalla con mapa horizontal.
import {
  useLayoutEffect,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { formatStat } from "../data";
import { plainLabel } from "../dashboard/charts";
import { useFitToViewport } from "../dashboard/useFitToViewport";
import type { PageProps } from "../formats/types";
import {
  buildLifeline,
  formatHouseholdAges,
  type ChristmasDot,
  type Fix,
  type LifelineData,
  type Moment,
} from "./moments";

const SHORT_MONTHS = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ADVISOR_FALLBACK =
  "No single step in your plan fixes this. It's the first thing to raise with your advisor.";
const FOOTER_TEXT = "Every date and number comes from your Sherpas plan.";
const STEPS_NOTE =
  "Dates stay as your plan projects them; your score shows what each step changes.";

type Mode = "nothing" | "steps";

/* ------------------------------------------------------------------ */
/* Utilidades de vista                                                 */
/* ------------------------------------------------------------------ */

const cssVars = (vars: Record<string, string | number>): CSSProperties => vars as CSSProperties;

// PC (≥ 1024 px) frente a móvil; el mismo corte que usa useFitToViewport.
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false
  );
}

// Marca cuándo un elemento entra en pantalla por primera vez (para animar la cuadrícula de puntos).
function useSeen<T extends Element>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

// Ancho útil de un elemento, actualizado al redimensionar (no se ve afectado por transform: scale).
function useElementWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Etiqueta corta para los marcadores del mapa (el texto completo sigue en el panel).
function shortLabel(m: Moment): string {
  switch (m.id) {
    case "savings-run-out":
      return "Savings run out";
    case "money-lasts":
      return "Money lasts";
    case "probe-tarjeta":
      return "Card payment";
    case "probe-seguro":
    case "protection-life-gap":
      return "Life cover";
    case "probe-colchon":
      return "Cash cushion";
    case "probe-destino":
      return "Retirement saving";
    case "savings-deficit":
      return "Overspending";
    case "protection-umbrella":
      return "No umbrella";
    case "wealth-today":
      return "Net worth";
    case "wealth-end":
      return "Net worth at end";
    default:
      break;
  }
  if (m.id.startsWith("card-")) return "Card paid off";
  const text = m.label.replace(" and ", " & ");
  return text.length > 24 ? `${text.slice(0, 23).trimEnd()}…` : text;
}

function dateLabelOf(m: Moment): string {
  return m.month ? `${SHORT_MONTHS[m.month]} ${m.year}` : String(m.year);
}

function findFix(m: Moment, fixes: Fix[]): Fix | null {
  return m.tone === "bad" && m.fixKey ? fixes.find((f) => f.fixKey === m.fixKey) ?? null : null;
}

function hasStep(m: Moment, fixes: Fix[]): boolean {
  return m.tone === "bad" && (findFix(m, fixes) !== null || Boolean(m.recommendation));
}

// Acción del paso sin la coletilla explicativa.
function cleanActionOf(fix: Fix): string {
  const match = fix.action.match(
    / (to (raise|remove|reach|clear|keep|lift)\b|and clear\b|so (that )?\b|for the next\b| — )/i
  );
  return match ? fix.action.slice(0, match.index).trim() : fix.action;
}

function effectOf(fix: Fix, scoreTogether: number | null): string {
  return fix.scoreAfter === fix.scoreBefore && scoreTogether !== null
    ? `Counts toward ${fix.scoreBefore} → ${scoreTogether} together`
    : `Score ${fix.scoreBefore} → ${fix.scoreAfter}`;
}

function withPeriod(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

// Lo que va a cambiar cada paso en el contexto de un momento malo (paso del plan, recomendación o asesor).
function StepView({
  moment,
  fixes,
  scoreTogether,
}: {
  moment: Moment;
  fixes: Fix[];
  scoreTogether: number | null;
}) {
  const fix = findFix(moment, fixes);
  if (fix) {
    return (
      <div className="lfl-step">
        <span className="lfl-step-kicker">Plan step</span>
        <div className="lfl-step-head">
          <span className="lfl-step-title">{plainLabel(fix.title)}</span>
          <span className="lfl-step-score">{effectOf(fix, scoreTogether)}</span>
        </div>
        <p className="lfl-step-action">{cleanActionOf(fix)}</p>
      </div>
    );
  }
  if (moment.recommendation) {
    return (
      <div className="lfl-step">
        <span className="lfl-step-kicker">Your plan recommends:</span>
        <p className="lfl-step-action">{moment.recommendation}</p>
        <p className="lfl-step-advisor">Raise it with your advisor.</p>
      </div>
    );
  }
  return (
    <div className="lfl-step">
      <p className="lfl-step-advisor">{ADVISOR_FALLBACK}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Piezas compartidas                                                  */
/* ------------------------------------------------------------------ */

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="lfl-toggle" role="group" aria-label="Timeline mode">
      <button
        type="button"
        className={`lfl-toggle-btn ${mode === "nothing" ? "lfl-toggle-active" : ""}`}
        onClick={() => setMode("nothing")}
        aria-pressed={mode === "nothing"}
      >
        If nothing changes
      </button>
      <button
        type="button"
        className={`lfl-toggle-btn ${mode === "steps" ? "lfl-toggle-active" : ""}`}
        onClick={() => setMode("steps")}
        aria-pressed={mode === "steps"}
      >
        With your plan&apos;s steps
      </button>
    </div>
  );
}

// El titular grande con la cifra clave en rojo cuando es una mala noticia.
function LeadTitle({ title, bad }: { title: string; bad: boolean }) {
  if (!bad) return <>{title}</>;
  const match = title.match(/\$?\d[\d,]*(?:\.\d+)?/);
  if (!match || match.index === undefined) return <span className="lfl-bad">{title}</span>;
  const end = match.index + match[0].length;
  return (
    <>
      {title.slice(0, match.index)}
      <span className="lfl-bad">{match[0]}</span>
      {title.slice(end)}
    </>
  );
}

function FamilyAges({ data }: { data: LifelineData }) {
  return (
    <ul className="lfl-family" aria-label="Your family today">
      {data.people.map((p) => (
        <li key={p.name} className="lfl-family-item">
          <span className="lfl-family-name">{p.name}</span>
          <span className="lfl-family-age">{p.age}</span>
        </li>
      ))}
    </ul>
  );
}

// Nota "60 → 78": en "If nothing changes" la cifra de llegada queda atenuada.
function ScoreNote({
  from,
  to,
  dim,
  className = "",
}: {
  from: number;
  to: number | null;
  dim?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`lfl-note ${className}`}
      aria-label={to !== null ? `Score ${from} to ${to}` : `Score ${from}`}
    >
      <span>{from}</span>
      {to !== null && (
        <>
          <span className="lfl-note-arrow" aria-hidden="true">
            {" → "}
          </span>
          <span className={dim ? "lfl-note-dim" : ""} aria-hidden="true">
            {to}
          </span>
        </>
      )}
    </p>
  );
}

// Cuadrícula de puntos: 1 punto = 1 Navidad. Se rellena con animación escalonada al aparecer.
function DotsGrid({ dots, cols }: { dots: ChristmasDot[]; cols: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const okCount = dots.filter((d) => d.state === "ok").length;
  const cardCount = dots.filter((d) => d.state === "card").length;
  const noSavCount = dots.filter((d) => d.state === "no-savings").length;
  const stateText = (s: ChristmasDot["state"]) =>
    s === "no-savings" ? "No savings left" : s === "card" ? "Paying the card" : "With savings";

  return (
    <div
      ref={ref}
      className={`lfl-dots ${seen ? "lfl-dots-in" : ""}`}
      style={cssVars({ "--lfl-cols": cols })}
      role="img"
      aria-label={`${dots.length} Christmases: ${okCount} with savings, ${cardCount} paying the card, ${noSavCount} with no savings left`}
    >
      {dots.map((dot, idx) => (
        <span
          key={dot.year}
          className={`lfl-dot lfl-dot-${dot.state}`}
          style={cssVars({ "--lfl-i": idx })}
          title={`Dec 25, ${dot.year} — ${stateText(dot.state)}`}
        />
      ))}
    </div>
  );
}

function DotsLegend({ dots }: { dots: ChristmasDot[] }) {
  const okCount = dots.filter((d) => d.state === "ok").length;
  const cardCount = dots.filter((d) => d.state === "card").length;
  const noSavCount = dots.filter((d) => d.state === "no-savings").length;
  return (
    <div className="lfl-legend">
      {okCount > 0 && (
        <span className="lfl-legend-item">
          <span className="lfl-legend-swatch lfl-swatch-ok" aria-hidden="true" />
          <span>{`With savings (${okCount})`}</span>
        </span>
      )}
      {cardCount > 0 && (
        <span className="lfl-legend-item lfl-bad">
          <span className="lfl-legend-swatch lfl-swatch-card" aria-hidden="true" />
          <span>{`Paying the card (${cardCount})`}</span>
        </span>
      )}
      {noSavCount > 0 && (
        <span className="lfl-legend-item lfl-bad">
          <span className="lfl-legend-swatch lfl-swatch-nosavings" aria-hidden="true" />
          <span>{`No savings (${noSavCount})`}</span>
        </span>
      )}
    </div>
  );
}

// Cifras grandes de resumen de la escena de Navidades (solo las malas; si no hay, las que tienen ahorros).
function DotsSummary({ dots }: { dots: ChristmasDot[] }) {
  const okCount = dots.filter((d) => d.state === "ok").length;
  const cardCount = dots.filter((d) => d.state === "card").length;
  const noSavCount = dots.filter((d) => d.state === "no-savings").length;
  const items: { n: number; text: string; bad: boolean }[] = [];
  if (noSavCount > 0) items.push({ n: noSavCount, text: "with no savings", bad: true });
  if (cardCount > 0) items.push({ n: cardCount, text: "with the card", bad: true });
  if (items.length === 0) items.push({ n: okCount, text: "with savings", bad: false });
  return (
    <div className="lfl-summary">
      {items.map((it) => (
        <p key={it.text} className="lfl-summary-item">
          <span className={`lfl-summary-n ${it.bad ? "lfl-bad" : ""}`}>{it.n}</span>
          <span className="lfl-summary-text">{it.text}</span>
        </p>
      ))}
    </div>
  );
}

// Fila de la línea vertical: año grande, línea fina, punto, título y detalle.
function LineRow({
  moment,
  agesText,
  showSteps,
  fixes,
  scoreTogether,
  index,
}: {
  moment: Moment;
  agesText: string;
  showSteps: boolean;
  fixes: Fix[];
  scoreTogether: number | null;
  index: number;
}) {
  const isBad = moment.tone === "bad";
  return (
    <li
      className={`lfl-lrow ${isBad ? "lfl-lrow-bad" : ""}`}
      style={cssVars({ "--lfl-i": index })}
    >
      <div className="lfl-lrow-when">
        <span className="lfl-lrow-month">{moment.month ? SHORT_MONTHS[moment.month] : ""}</span>
        <span className="lfl-lrow-year">{moment.year}</span>
      </div>
      <div className="lfl-lrow-rail" aria-hidden="true">
        <span
          className={`lfl-lrow-dot ${
            isBad ? "lfl-dotmark-bad" : moment.tone === "good" ? "lfl-dotmark-good" : ""
          }`}
        />
      </div>
      <div className="lfl-lrow-body">
        <h3 className="lfl-lrow-title">{moment.label}</h3>
        {moment.detail ? <p className="lfl-lrow-detail">{moment.detail}</p> : null}
        <p className="lfl-lrow-ages">{agesText}</p>
        {moment.source && (
          <details className="lfl-source">
            <summary className="lfl-source-summary">From your plan</summary>
            <p className="lfl-source-text">{moment.source}</p>
          </details>
        )}
        {showSteps && isBad && (
          <StepView moment={moment} fixes={fixes} scoreTogether={scoreTogether} />
        )}
      </div>
    </li>
  );
}

function LineList({
  moments,
  data,
  showSteps,
  label,
}: {
  moments: Moment[];
  data: LifelineData;
  showSteps: boolean;
  label: string;
}) {
  return (
    <ol className="lfl-line" aria-label={label}>
      {moments.map((moment, idx) => (
        <LineRow
          key={moment.id}
          moment={moment}
          agesText={formatHouseholdAges(data.people, data.startYear, moment.year)}
          showSteps={showSteps}
          fixes={data.fixes}
          scoreTogether={data.scoreTogether}
          index={idx}
        />
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Mapa horizontal (PC)                                                */
/* ------------------------------------------------------------------ */

const MAP_INSET = 18;
const ROW_H = 25;
const PIN_DOT = 12;

type Placed = { m: Moment; x: number; flip: boolean; row: number; label: string; step: boolean };

function LifeMap({
  data,
  pins,
  selectedId,
  onSelect,
  showSteps,
  trackRef,
  trackW,
}: {
  data: LifelineData;
  pins: Moment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showSteps: boolean;
  trackRef: RefObject<HTMLDivElement>;
  trackW: number;
}) {
  const W = trackW > 0 ? trackW : 520;
  const t0 = data.startYear;
  const frac = (m: Moment) => m.year + (m.month ? (m.month - 1) / 12 : 0);
  const endT = Math.ceil(Math.max(data.endYear, ...pins.map(frac)));
  const span = Math.max(1, endT - t0);
  const xOf = (t: number) => MAP_INSET + ((t - t0) / span) * (W - 2 * MAP_INSET);

  const { placed, rows } = useMemo(() => {
    const sorted = [...pins].sort((a, b) => frac(a) - frac(b));
    const taken: [number, number][][] = [];
    const out: Placed[] = sorted.map((m) => {
      const x = xOf(frac(m));
      const label = shortLabel(m);
      const step = showSteps && hasStep(m, data.fixes);
      const w = PIN_DOT + 8 + label.length * 6.8 + (step ? 46 : 0);
      const flip = x + w > W - 2;
      const lo = flip ? x + PIN_DOT / 2 - w : x - PIN_DOT / 2;
      const hi = lo + w;
      let row = 0;
      for (;;) {
        const list = taken[row] ?? (taken[row] = []);
        if (list.every(([a, b]) => hi + 6 <= a || lo - 6 >= b)) {
          list.push([lo, hi]);
          break;
        }
        row += 1;
      }
      return { m, x, flip, row, label, step };
    });
    return { placed: out, rows: Math.max(1, taken.length) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, W, showSteps, data.fixes, t0, span]);

  // Marcas del eje: el paso se adapta al ancho disponible.
  const ticks = useMemo(() => {
    const maxTicks = Math.max(2, Math.floor((W - 2 * MAP_INSET) / 62));
    const step = [1, 2, 5, 10, 20].find((s) => span / s <= maxTicks) ?? 20;
    const list: number[] = [];
    for (let y = t0; y <= endT; y += step) list.push(y);
    const last = list[list.length - 1];
    if (last !== endT && xOf(endT) - xOf(last) >= 46) list.push(endT);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, span, t0, endT]);

  const selected = placed.find((p) => p.m.id === selectedId) ?? null;
  const selX = selected ? selected.x : null;
  const zoneH = rows * ROW_H + 6;

  const move = (from: number, dir: number) => {
    const next = placed[from + dir];
    if (!next) return;
    onSelect(next.m.id);
    document.getElementById(`lfl-pin-${next.m.id}`)?.focus();
  };

  return (
    <div className="lfl-map" aria-label="Your life line, year by year">
      {/* Momentos */}
      <div className="lfl-map-row">
        <div className="lfl-map-gutter">Moments</div>
        <div className="lfl-map-track lfl-map-pins" ref={trackRef} style={{ height: zoneH }}>
          {placed.map((p) => (
            <span
              key={`stem-${p.m.id}`}
              className={`lfl-pin-stem ${p.m.tone === "bad" ? "lfl-pin-stem-bad" : ""}`}
              style={{ left: p.x, height: p.row * ROW_H + ROW_H / 2 }}
              aria-hidden="true"
            />
          ))}
          {placed.map((p, idx) => {
            const bad = p.m.tone === "bad";
            const isSel = p.m.id === selectedId;
            return (
              <button
                key={p.m.id}
                id={`lfl-pin-${p.m.id}`}
                type="button"
                className={`lfl-pin ${p.flip ? "lfl-pin-flip" : ""} ${bad ? "lfl-pin-bad" : ""}`}
                style={{
                  bottom: p.row * ROW_H,
                  height: ROW_H,
                  ...(p.flip
                    ? { right: W - p.x - PIN_DOT / 2 }
                    : { left: p.x - PIN_DOT / 2 }),
                }}
                aria-pressed={isSel}
                aria-label={`${dateLabelOf(p.m)}: ${p.m.label}${p.step ? " (plan step available)" : ""}`}
                onClick={() => onSelect(p.m.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    move(idx, 1);
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    move(idx, -1);
                  }
                }}
              >
                <span
                  className={`lfl-pin-dot ${
                    bad ? "lfl-dotmark-bad" : p.m.tone === "good" ? "lfl-dotmark-good" : ""
                  }`}
                  aria-hidden="true"
                />
                <span className="lfl-pin-label">{p.label}</span>
                {p.step && (
                  <span className="lfl-pin-step" aria-hidden="true">
                    Step
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Eje de años */}
      <div className="lfl-map-row lfl-map-axis-row">
        <div className="lfl-map-gutter">Year</div>
        <div className="lfl-map-track lfl-map-axis">
          {ticks.map((y) => {
            const x = xOf(y);
            const hide = selX !== null && Math.abs(x - selX) < 30;
            return (
              <span key={y} className="lfl-tick" style={{ left: x }}>
                <span className="lfl-tick-mark" aria-hidden="true" />
                <span className={`lfl-tick-year ${hide ? "lfl-tick-hidden" : ""}`}>{y}</span>
              </span>
            );
          })}
          {selected && selX !== null && (
            <span
              className={`lfl-tick-sel ${selected.m.tone === "bad" ? "lfl-tick-sel-bad" : ""}`}
              style={{ left: selX }}
            >
              {selected.m.year}
            </span>
          )}
        </div>
      </div>

      {/* Un carril por miembro con su edad en los años clave */}
      {data.people.map((person) => (
        <div className="lfl-map-row lfl-lane-row" key={person.name}>
          <div className="lfl-map-gutter lfl-lane-name" title={person.name}>
            {person.name}
          </div>
          <div className="lfl-map-track lfl-lane">
            <span className="lfl-lane-line" aria-hidden="true" />
            {ticks.map((y) => {
              const x = xOf(y);
              const hide = selX !== null && Math.abs(x - selX) < 26;
              return (
                <span
                  key={y}
                  className={`lfl-lane-age ${hide ? "lfl-tick-hidden" : ""}`}
                  style={{ left: x }}
                >
                  {person.age + (y - t0)}
                </span>
              );
            })}
            {selected && selX !== null && (
              <span className="lfl-lane-age lfl-lane-age-sel" style={{ left: selX }}>
                {person.age + (selected.m.year - t0)}
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Guía vertical del momento seleccionado */}
      {selX !== null && (
        <div className="lfl-map-guide-wrap" aria-hidden="true">
          <div className="lfl-map-gutter" />
          <div className="lfl-map-track">
            <span className="lfl-map-guide" style={{ left: selX }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Panel de detalle del momento seleccionado.
function DetailPanel({
  moment,
  data,
  showSteps,
}: {
  moment: Moment | null;
  data: LifelineData;
  showSteps: boolean;
}) {
  if (!moment) return <div className="lfl-panel" />;
  const bad = moment.tone === "bad";
  const withStep = showSteps && bad;
  return (
    <div className={`lfl-panel ${withStep ? "lfl-panel-two" : ""}`} aria-live="polite">
      <div className="lfl-panel-main">
        <p className="lfl-panel-meta">
          <span className={`lfl-panel-date ${bad ? "lfl-bad" : ""}`}>{dateLabelOf(moment)}</span>
          <span className="lfl-panel-ages">
            {formatHouseholdAges(data.people, data.startYear, moment.year)}
          </span>
        </p>
        <h3 className="lfl-panel-title">{moment.label}</h3>
        {moment.detail ? <p className="lfl-panel-detail">{moment.detail}</p> : null}
        {moment.source && (
          <details className="lfl-source">
            <summary className="lfl-source-summary">From your plan</summary>
            <p className="lfl-source-text">{moment.source}</p>
          </details>
        )}
      </div>
      {withStep && (
        <StepView moment={moment} fixes={data.fixes} scoreTogether={data.scoreTogether} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vistas                                                              */
/* ------------------------------------------------------------------ */

type ViewProps = {
  family: PageProps["family"];
  page: PageProps["page"];
  data: LifelineData;
  mode: Mode;
  setMode: (m: Mode) => void;
  scoreTo: number | null;
  scoreBannerText: string;
};

// Envoltorio que sale del contenedor estrecho y escala el bloque para que quepa sin scroll vertical.
function FitFrame({
  outer,
  inner,
  children,
}: {
  outer: RefObject<HTMLDivElement>;
  inner: RefObject<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div className="lfl-fit-outer" ref={outer}>
      <div className="lfl-fit-inner" ref={inner}>
        {children}
      </div>
    </div>
  );
}

function CoverDesktop({ family, page, data, mode, setMode, scoreTo, scoreBannerText }: ViewProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [trackRef, trackW] = useElementWidth<HTMLDivElement>();
  const coverMoments = useMemo(() => data.moments.filter((m) => m.cover), [data.moments]);
  const [selectedId, setSelectedId] = useState<string | null>(
    data.lead?.id ?? coverMoments[0]?.id ?? null
  );
  const showSteps = mode === "steps";
  const selected =
    data.moments.find((m) => m.id === selectedId) ?? data.lead ?? coverMoments[0] ?? null;

  useFitToViewport(outer, inner, { deps: [family.id, page, mode, selectedId, trackW] });

  const leadBad = data.lead?.tone === "bad";
  const dotCols = Math.max(8, Math.min(18, Math.ceil(data.dots.length / 3)));

  return (
    <div className="lfl-root lfl-desk">
      <FitFrame outer={outer} inner={inner}>
        <div className="lfl-stage">
          <section className="lfl-stage-left" aria-label="Where you stand today">
            <p className="lfl-eyebrow">{`YOUR LIFE LINE · ${data.startYear}`}</p>
            <h1 className="lfl-hero-title">
              <LeadTitle title={data.leadTitle} bad={leadBad} />
            </h1>
            <p className="lfl-hero-lede">{data.leadText}</p>
            <FamilyAges data={data} />
            <section className="lfl-dots-block" aria-label="Christmases in your plan">
              <div className="lfl-dots-head">
                <span className="lfl-eyebrow">Every Christmas from here</span>
                <span className="lfl-dots-sub">1 dot = 1 Christmas</span>
              </div>
              <DotsGrid dots={data.dots} cols={dotCols} />
              <DotsLegend dots={data.dots} />
            </section>
          </section>

          <section className="lfl-stage-right" aria-label="Your life line">
            <div className="lfl-stage-bar">
              <ModeToggle mode={mode} setMode={setMode} />
              <span className="lfl-hint">Select a marker for the detail</span>
            </div>
            <LifeMap
              data={data}
              pins={coverMoments}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              showSteps={showSteps}
              trackRef={trackRef}
              trackW={trackW}
            />
            <div className="lfl-stage-bottom">
              <div className="lfl-stage-bottom-main">
                <DetailPanel moment={selected} data={data} showSteps={showSteps} />
                <p className="lfl-footer">{FOOTER_TEXT}</p>
              </div>
              <div className="lfl-stage-note">
                <span className="lfl-eyebrow">{showSteps ? "Score with the steps" : "Your score"}</span>
                <ScoreNote from={data.score} to={scoreTo} dim={!showSteps} />
                {showSteps && <p className="lfl-note-caption">{scoreBannerText}</p>}
              </div>
            </div>
          </section>
        </div>
      </FitFrame>
    </div>
  );
}

function CoverMobile({ data, mode, setMode, scoreTo, scoreBannerText }: ViewProps) {
  const coverMoments = data.moments.filter((m) => m.cover);
  const showSteps = mode === "steps";
  const leadBad = data.lead?.tone === "bad";

  return (
    <div className="lfl-root lfl-mob">
      {/* 1. Hoy */}
      <section className="lfl-scene lfl-scene-today" aria-label="Today">
        <p className="lfl-eyebrow">{`YOUR LIFE LINE · ${data.startYear}`}</p>
        <h1 className="lfl-hero-title">
          <LeadTitle title={data.leadTitle} bad={leadBad} />
        </h1>
        <p className="lfl-hero-lede">{data.leadText}</p>
        <FamilyAges data={data} />
      </section>

      {/* 2. Navidades */}
      <section className="lfl-scene lfl-scene-xmas" aria-label="Christmases in your plan">
        <div className="lfl-dots-head">
          <span className="lfl-eyebrow">Every Christmas from here</span>
          <span className="lfl-dots-sub">1 dot = 1 Christmas</span>
        </div>
        <DotsGrid dots={data.dots} cols={8} />
        <DotsLegend dots={data.dots} />
        <DotsSummary dots={data.dots} />
      </section>

      {/* 3. Línea */}
      <section className="lfl-scene lfl-scene-line" aria-label="Your life line">
        <div className="lfl-sticky">
          <ModeToggle mode={mode} setMode={setMode} />
        </div>
        {showSteps && <p className="lfl-steps-note">{STEPS_NOTE}</p>}
        <LineList
          moments={coverMoments}
          data={data}
          showSteps={showSteps}
          label="Family timeline moments"
        />
      </section>

      {/* 4. Rescate */}
      <section className="lfl-scene lfl-scene-rescue" aria-label="What your plan's steps change">
        <p className="lfl-eyebrow">Your plan&apos;s steps</p>
        <h2 className="lfl-scene-title">What your plan&apos;s steps change.</h2>
        <ScoreNote from={data.score} to={scoreTo} className="lfl-note-big" />
        <p className="lfl-note-caption">{scoreBannerText}</p>
        {data.fixes.length > 0 && (
          <ol className="lfl-fixes" aria-label="Plan steps">
            {data.fixes.map((fix, idx) => (
              <li key={fix.title} className="lfl-fix">
                <span className="lfl-fix-n" aria-hidden="true">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="lfl-fix-body">
                  <h3 className="lfl-fix-title">{plainLabel(fix.title)}</h3>
                  <p className="lfl-fix-action">{cleanActionOf(fix)}</p>
                  <span className="lfl-fix-effect">{effectOf(fix, data.scoreTogether)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="lfl-footer">{FOOTER_TEXT}</p>
      </section>
    </div>
  );
}

type SectionPage = Extract<PageProps["page"], { kind: "section" }>;

type SectionViewProps = ViewProps & {
  page: SectionPage;
  answers: PageProps["answers"];
  Reveal: PageProps["Reveal"];
};

function SectionBlocks({
  family,
  page,
  answers,
  Reveal,
}: Pick<SectionViewProps, "family" | "page" | "answers" | "Reveal">) {
  const { probes } = page;
  if (probes.length === 0) return null;
  return (
    <div className="lfl-probes">
      {probes.map((probe, idx) => (
        <Reveal
          key={probe.id}
          family={family}
          probe={probe}
          answer={answers[probe.id] ?? Number.NaN}
          index={idx}
          total={probes.length}
          animate={true}
        />
      ))}
    </div>
  );
}

function HeadlineFallback({ page }: { page: SectionPage }) {
  const headline = page.section.headline;
  if (!headline) return null;
  return (
    <div className="lfl-headline-fallback">
      <p className="lfl-eyebrow">{headline.label}</p>
      <p className="lfl-headline-val">{formatStat(headline.kind, headline.value)}</p>
    </div>
  );
}

function SectionDesktop(props: SectionViewProps) {
  const { family, page, data, mode, setMode, answers, Reveal } = props;
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const { section } = page;
  const sectionMoments = data.moments.filter((m) => m.section === section.id);
  const showSteps = mode === "steps";

  useFitToViewport(outer, inner, { deps: [family.id, page, mode] });

  return (
    <div className="lfl-root lfl-desk">
      <FitFrame outer={outer} inner={inner}>
        <div className="lfl-stage lfl-stage-section">
          <section className="lfl-stage-left" aria-label={section.title}>
            <p className="lfl-eyebrow">YOUR LIFE LINE</p>
            <h1 className="lfl-section-title">{withPeriod(section.title)}</h1>
            <SectionBlocks family={family} page={page} answers={answers} Reveal={Reveal} />
            {sectionMoments.length === 0 && <HeadlineFallback page={page} />}
          </section>

          <section className="lfl-stage-right" aria-label={`${section.title} moments`}>
            {sectionMoments.length > 0 ? (
              <>
                <div className="lfl-stage-bar">
                  <ModeToggle mode={mode} setMode={setMode} />
                </div>
                <LineList
                  moments={sectionMoments}
                  data={data}
                  showSteps={showSteps}
                  label={`${section.title} moments`}
                />
              </>
            ) : (
              <p className="lfl-hint">No dated moments in this section.</p>
            )}
            <p className="lfl-footer lfl-footer-left">{FOOTER_TEXT}</p>
          </section>
        </div>
      </FitFrame>
    </div>
  );
}

function SectionMobile(props: SectionViewProps) {
  const { family, page, data, mode, setMode, answers, Reveal } = props;
  const { section } = page;
  const sectionMoments = data.moments.filter((m) => m.section === section.id);
  const showSteps = mode === "steps";

  return (
    <div className="lfl-root lfl-mob">
      <section className="lfl-scene lfl-scene-head" aria-label={section.title}>
        <p className="lfl-eyebrow">YOUR LIFE LINE</p>
        <h1 className="lfl-section-title">{withPeriod(section.title)}</h1>
        <SectionBlocks family={family} page={page} answers={answers} Reveal={Reveal} />
        {sectionMoments.length === 0 && <HeadlineFallback page={page} />}
      </section>

      {sectionMoments.length > 0 && (
        <section className="lfl-scene lfl-scene-line" aria-label={`${section.title} moments`}>
          <div className="lfl-sticky">
            <ModeToggle mode={mode} setMode={setMode} />
          </div>
          <LineList
            moments={sectionMoments}
            data={data}
            showSteps={showSteps}
            label={`${section.title} moments`}
          />
        </section>
      )}

      <p className="lfl-footer">{FOOTER_TEXT}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function LifelinePage({
  family,
  analysis,
  page,
  answers,
  Reveal,
}: PageProps): JSX.Element {
  const [mode, setMode] = useState<Mode>("nothing");
  const isDesktop = useIsDesktop();
  const data = useMemo(
    () => buildLifeline(family, analysis, new Date()),
    [family, analysis]
  );

  // Mayor salto de un paso cuando scoreTogether es null
  const bestSingleMove = useMemo(() => {
    if (data.fixes.length === 0) return null;
    return data.fixes.reduce((best, cur) =>
      cur.scoreAfter - cur.scoreBefore > best.scoreAfter - best.scoreBefore ? cur : best
    );
  }, [data.fixes]);

  const scoreTo =
    data.scoreTogether !== null ? data.scoreTogether : bestSingleMove ? bestSingleMove.scoreAfter : null;

  const scoreBannerText =
    data.scoreTogether !== null
      ? `Score ${data.score} → ${data.scoreTogether} if you take all the steps`
      : bestSingleMove
        ? `Score ${data.score} → ${bestSingleMove.scoreAfter} with your biggest single step (${bestSingleMove.title})`
        : `Score ${data.score}`;

  const base = { family, data, mode, setMode, scoreTo, scoreBannerText };

  if (page.kind === "cover") {
    return isDesktop ? (
      <CoverDesktop key={family.id} {...base} page={page} />
    ) : (
      <CoverMobile {...base} page={page} />
    );
  }

  return isDesktop ? (
    <SectionDesktop key={family.id} {...base} page={page} answers={answers} Reveal={Reveal} />
  ) : (
    <SectionMobile {...base} page={page} answers={answers} Reveal={Reveal} />
  );
}
