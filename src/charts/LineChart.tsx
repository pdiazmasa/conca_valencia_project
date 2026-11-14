import { useId, useRef, useState, type PointerEvent } from "react";
import "./charts.css";

// Gráfica de línea al estilo Trade Republic: trazo limpio de 2px a todo el ancho,
// sin ejes ni rejilla, con línea base en y=0 y consulta interactiva (scrub) al arrastrar.

export type LinePoint = { x: number; y: number };
export type LineMarker = { x: number; label: string };

const compactUSD = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCompactUSD = (v: number) =>
  v < 0 ? `-$${compactUSD.format(Math.abs(v))}` : `$${compactUSD.format(v)}`;

export type LineChartProps = {
  points: LinePoint[];
  tone: "good" | "bad" | "neutral";
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  markers?: LineMarker[];
  height?: number;
  onScrub?: (p: LinePoint | null) => void;
};

const VB_W = 440;

export function LineChart({
  points,
  tone,
  formatX,
  formatY,
  markers = [],
  height = 180,
  onScrub,
}: LineChartProps) {
  const clipId = `lc${useId().replace(/:/g, "")}`;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scrub, setScrub] = useState<LinePoint | null>(null);
  const draggingRef = useRef(false);

  const hasPoints = points.length > 0;
  const first = hasPoints ? points[0] : { x: 0, y: 0 };
  const last = hasPoints ? points[points.length - 1] : { x: 0, y: 0 };

  const minX = hasPoints ? Math.min(...points.map((p) => p.x)) : 0;
  const maxX = hasPoints ? Math.max(...points.map((p) => p.x)) : 1;
  const spanX = maxX - minX || 1;

  // Incluimos siempre y=0 en el dominio vertical para situar la línea base.
  const rawMinY = hasPoints ? Math.min(0, ...points.map((p) => p.y)) : 0;
  const rawMaxY = hasPoints ? Math.max(0, ...points.map((p) => p.y)) : 1;
  const spanY = rawMaxY - rawMinY || 1;

  const pctX = (x: number) => Math.min(100, Math.max(0, ((x - minX) / spanX) * 100));
  const pctY = (y: number) => Math.min(100, Math.max(0, (1 - (y - rawMinY) / spanY) * 100));

  const svgX = (x: number) => (pctX(x) / 100) * VB_W;
  const svgY = (y: number) => (pctY(y) / 100) * height;

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${svgX(p.x).toFixed(2)} ${svgY(p.y).toFixed(2)}`)
    .join(" ");

  const zeroY = svgY(0);

  const pickNearest = (clientX: number): LinePoint | null => {
    const stage = stageRef.current;
    if (!stage || !hasPoints) return null;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return points[0];
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const targetX = minX + ratio * spanX;
    let best = points[0];
    let bestDist = Math.abs(best.x - targetX);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - targetX);
      if (dist < bestDist) {
        best = points[i];
        bestDist = dist;
      }
    }
    return best;
  };

  const updateScrub = (clientX: number) => {
    const nearest = pickNearest(clientX);
    setScrub(nearest);
    onScrub?.(nearest);
  };

  const endScrub = () => {
    if (!draggingRef.current && scrub === null) return;
    draggingRef.current = false;
    setScrub(null);
    onScrub?.(null);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!hasPoints) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateScrub(e.clientX);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateScrub(e.clientX);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    endScrub();
  };

  const scrubX = scrub ? pctX(scrub.x) : 0;
  const scrubY = scrub ? pctY(scrub.y) : 0;
  const scrubEdge = scrubX < 16 ? "edge-l" : scrubX > 84 ? "edge-r" : "";

  const ariaLabel = hasPoints
    ? `Trend from ${formatX(first.x)} (${formatY(first.y)}) to ${formatX(last.x)} (${formatY(last.y)}).`
    : "Chart with no data.";

  return (
    <div className={`line-chart tone-${tone}`} role="img" aria-label={ariaLabel}>
      <div className="line-chart-stage" ref={stageRef} style={{ height }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={endScrub} onLostPointerCapture={endScrub}>
        <svg className="line-chart-svg" viewBox={`0 0 ${VB_W} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <clipPath id={clipId}>
              <rect className="line-chart-clip-rect" x={0} y={0} width={VB_W} height={height} />
            </clipPath>
          </defs>
          <line className="line-chart-zero" x1={0} y1={zeroY} x2={VB_W} y2={zeroY} />
          {hasPoints && <path className="line-chart-path" d={d} clipPath={`url(#${clipId})`} />}
        </svg>

        {markers.map((m) => {
          const mx = pctX(m.x);
          const edge = mx > 75 ? "edge-r" : "";
          return (
            <div key={`${m.x}-${m.label}`} className={`line-chart-marker ${edge}`} style={{ left: `${mx}%` }} aria-hidden="true">
              <span className="line-chart-marker-label">{m.label}</span>
            </div>
          );
        })}

        {scrub && (
          <>
            <div className={`line-chart-scrub-label ${scrubEdge}`} style={{ left: `${scrubX}%` }} aria-hidden="true">
              {formatY(scrub.y)} · {formatX(scrub.x)}
            </div>
            <div className="line-chart-scrub-line" style={{ left: `${scrubX}%` }} aria-hidden="true" />
            <div className="line-chart-scrub-dot" style={{ left: `${scrubX}%`, top: `${scrubY}%` }} aria-hidden="true" />
          </>
        )}
      </div>

      {hasPoints && (
        <div className="line-chart-ends" aria-hidden="true">
          <span>{formatX(first.x)}</span>
          <span>{formatX(last.x)}</span>
        </div>
      )}
    </div>
  );
}

// DATOS DE EJEMPLO SOLO PARA PRUEBAS VISUALES — NO USAR EN PRODUCCIÓN.
// Serie inventada de 30 puntos (edad 35 a 93) para validar el componente en aislamiento.
const DEMO_POINTS: LinePoint[] = Array.from({ length: 30 }, (_, i) => {
  const age = 35 + i * 2;
  const peak = 65;
  const y =
    age <= peak
      ? Math.round(18000 + (age - 35) * 9500 + Math.sin(i * 0.7) * 8000)
      : Math.max(0, Math.round(303000 - (age - peak) * 13500));
  return { x: age, y };
});

// Componente de demostración SOLO para pruebas visuales (no usar en producción).
export function LineChartDemo() {
  const [active, setActive] = useState<LinePoint | null>(null);
  const fmtAge = (v: number) => `age ${Math.round(v)}`;
  const fmtMoney = (v: number) =>
    `$${Math.round(v).toLocaleString("en-US")}`;

  const shown = active ?? DEMO_POINTS[DEMO_POINTS.length - 1];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <p className="eyebrow">Visual demo (sample data)</p>
      <p className="stat-value sm" style={{ marginTop: 4 }}>
        {fmtMoney(shown.y)} <span className="stat-unit">· {fmtAge(shown.x)}</span>
      </p>
      <LineChart
        points={DEMO_POINTS}
        tone="bad"
        formatX={fmtAge}
        formatY={fmtMoney}
        markers={[
          { x: 87, label: "Runs out" },
          { x: 91, label: "End of plan" },
        ]}
        onScrub={setActive}
      />
    </div>
  );
}
