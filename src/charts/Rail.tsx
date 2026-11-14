import "./charts.css";

// Gráfica de una dimensión al estilo Trade Republic: línea fina a todo el ancho,
// sin ejes ni rejilla. Marca hueca = tu respuesta; punto = el plan, que sale desde
// tu respuesta y se desliza hasta el valor real (lo mueve `planNow`, animado fuera).

export type RailBand = { from: number; to: number; label: string };
export type RailTick = { value: number; label: string };

type Props = {
  min: number;
  max: number;
  you: number;
  planNow: number;
  tone: "good" | "bad" | "neutral";
  format: (v: number) => string;
  band?: RailBand;
  ticks?: RailTick[];
  arrived: boolean;
};

export function Rail({ min, max, you, planNow, tone, format, band, ticks = [], arrived }: Props) {
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const youX = pct(you);
  const planX = pct(planNow);
  const lo = Math.min(youX, planX);
  const hi = Math.max(youX, planX);
  // Si las dos marcas quedan muy juntas, la etiqueta de "Tú" baja para no pisarse.
  const youBelow = Math.abs(youX - planX) < 22;
  // Etiquetas pegadas a un extremo: se alinean hacia dentro para no salirse.
  const edge = (x: number) => (x < 12 ? "edge-l" : x > 88 ? "edge-r" : "");

  return (
    <div className={`rail tone-${tone}`} role="img" aria-label={`You: ${format(you)}. Your plan: ${format(planNow)}.`}>
      <div className="rail-area">
        {band && (
          <div className="rail-band" style={{ left: `${pct(band.from)}%`, width: `${Math.max(pct(band.to) - pct(band.from), 1.2)}%` }}>
            <span>{band.label}</span>
          </div>
        )}
        <div className="rail-line" />
        <div className="rail-gap" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        {ticks.map((t) => (
          <div key={t.label} className="rail-tick" style={{ left: `${pct(t.value)}%` }}>
            <span>{t.label}</span>
          </div>
        ))}
        <div className={`rail-mark rail-you ${youBelow ? "below" : ""} ${edge(youX)}`} style={{ left: `${youX}%` }}>
          <span className="rail-label">You · {format(you)}</span>
        </div>
        <div className={`rail-mark rail-plan ${arrived ? "arrived" : ""} ${edge(planX)}`} style={{ left: `${planX}%` }}>
          <span className="rail-label">Plan</span>
        </div>
      </div>
      <div className="rail-ends">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
