import { useId } from "react";
import { formatStat, formatValue, truthValue, type Probe } from "../data";

// Tipos de datos que reciben las gráficas del dashboard a partir del JSON precalculado.
export type CapItem = {
  reason: string;
  cappedAt: number;
};

export type PillarItem = {
  name: string;
  score: number;
  points?: string;
};

export type MoveItem = {
  title: string;
  action?: string;
  effort?: string;
  scoreBefore: number;
  scoreAfter: number;
};

export type CombinedMoves = {
  moves: string[];
  scoreAfter: number;
  note: string;
};

export type TargetBarItem = {
  label: string;
  value: number;
  target?: number;
};

// Reemplaza jerga técnica por lenguaje llano según las reglas de comprensión.
export function plainLabel(text: string): string {
  if (text.includes("Liquidity")) return "Cash for emergencies";
  return text.replace(/mortality coverage/gi, "life insurance");
}

// Mapa simple para resumir los motivos de cap a 2-3 palabras con fallback al texto completo.
export function shortCapReason(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("revolving") || lower.includes("apr") || lower.includes("card")) {
    return "Card debt";
  }
  if (lower.includes("mortality") || lower.includes("life")) {
    return "Life cover";
  }
  if (lower.includes("umbrella") || lower.includes("liability")) {
    return "Umbrella cover";
  }
  if (lower.includes("liquidity") || lower.includes("emergency")) {
    return "Emergency cash";
  }
  if (lower.includes("withdrawal")) {
    return "Withdrawal rate";
  }
  if (lower.includes("debt")) {
    return "High debt";
  }
  return plainLabel(reason);
}

export type GuessGapProps = {
  probes: Probe[];
  answers: Record<string, number>;
};

// Comparativa visual por fila entre la estimación de la familia ("You") y el dato del plan ("Plan").
export function GuessGap({ probes, answers }: GuessGapProps) {
  const comparable = probes.filter((p) => truthValue(p) !== null);
  const closeCount = comparable.filter((p) => {
    const plan = truthValue(p)!;
    const you = answers[p.id] ?? p.input.initial;
    const span = p.input.max - p.input.min || 1;
    return Math.abs(you - plan) <= 0.1 * span;
  }).length;

  const vbW = 300;
  const vbH = 50;
  const padX = 16;
  const trackW = vbW - padX * 2;
  const trackY = 25;

  return (
    <div className="dbx-guess-wrap">
      <div className="dbx-guess-header">
        <div>
          <p className="eyebrow">Your guesses vs your plan</p>
          <h2 className="dbx-guess-title">How well do you know your plan?</h2>
        </div>
        <span className="badge badge-soft dbx-guess-badge">
          {`${closeCount} of ${comparable.length} close`}
        </span>
      </div>

      <ul className="dbx-guess-list">
        {probes.map((p) => {
          const plan = truthValue(p);
          const you = answers[p.id] ?? p.input.initial;

          if (plan === null) {
            return (
              <li key={p.id} className="dbx-guess-row">
                <p className="dbx-guess-question">{p.question}</p>
                <p className="dbx-guess-whole-plan">
                  Savings last for the whole plan
                </p>
              </li>
            );
          }

          const min = p.input.min;
          const max = p.input.max;
          const span = max - min || 1;
          const isBad = p.tone === "bad";

          const youX =
            padX + Math.min(1, Math.max(0, (you - min) / span)) * trackW;
          const planX =
            padX + Math.min(1, Math.max(0, (plan - min) / span)) * trackW;

          const youFmt = formatValue(p.input, you);
          const planFmt = formatValue(p.input, plan);

          const anchorFor = (x: number): "start" | "middle" | "end" => {
            if (x < 34) return "start";
            if (x > vbW - 34) return "end";
            return "middle";
          };

          return (
            <li key={p.id} className="dbx-guess-row">
              <p className="dbx-guess-question">{p.question}</p>
              <div className="dbx-guess-meta">
                <span>
                  You: <strong>{youFmt}</strong>
                </span>
                <span className={isBad ? "tone-bad" : ""}>
                  Plan: <strong>{planFmt}</strong>
                </span>
              </div>

              <div className="dbx-chart-wrap">
                <svg
                  className="dbx-svg dbx-guess-svg"
                  viewBox={`0 0 ${vbW} ${vbH}`}
                  role="img"
                  aria-label={`${p.question} You guessed ${youFmt}, plan is ${planFmt}.`}
                >
                  {/* Eje base entre el mínimo y el máximo de la sonda */}
                  <line
                    x1={padX}
                    y1={trackY}
                    x2={vbW - padX}
                    y2={trackY}
                    className="dbx-guess-track"
                    strokeLinecap="round"
                  />

                  {/* Segmento que conecta la estimación del usuario con el valor del plan */}
                  <line
                    x1={youX}
                    y1={trackY}
                    x2={planX}
                    y2={trackY}
                    className={`dbx-guess-segment ${isBad ? "dbx-is-bad" : ""}`}
                    strokeLinecap="round"
                  />

                  {/* Punto hueco: respuesta del usuario ("You") */}
                  <g className="dbx-guess-you-node">
                    <title>{`You: ${youFmt}`}</title>
                    <circle
                      cx={youX}
                      cy={trackY}
                      r={5.5}
                      className="dbx-guess-you-dot"
                    />
                    <text
                      x={youX}
                      y={trackY + 19}
                      textAnchor={anchorFor(youX)}
                      className="dbx-guess-dot-label dbx-guess-you-label"
                    >
                      You
                    </text>
                  </g>

                  {/* Punto relleno: valor real del plan ("Plan") */}
                  <g className="dbx-guess-plan-node">
                    <title>{`Plan: ${planFmt}`}</title>
                    <circle
                      cx={planX}
                      cy={trackY}
                      r={6}
                      className={`dbx-guess-plan-dot ${isBad ? "dbx-is-bad-dot" : ""}`}
                    />
                    <text
                      x={planX}
                      y={trackY - 10}
                      textAnchor={anchorFor(planX)}
                      className={`dbx-guess-dot-label dbx-guess-plan-label ${
                        isBad ? "dbx-is-bad-text" : ""
                      }`}
                    >
                      Plan
                    </text>
                  </g>
                </svg>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Mini-leyenda gráfica en lugar de texto explicativo */}
      <div className="dbx-guess-legend" aria-label="Legend: hollow dot is You, solid dot is Plan">
        <span className="dbx-guess-legend-item">
          <span className="dbx-guess-legend-dot dbx-guess-legend-you" aria-hidden="true" />
          You
        </span>
        <span className="dbx-guess-legend-item">
          <span className="dbx-guess-legend-dot dbx-guess-legend-plan" aria-hidden="true" />
          Plan
        </span>
      </div>
    </div>
  );
}

// Sujetamos cualquier puntuación al rango 0..100 para las coordenadas geométricas.
const clampScore = (v: number) => Math.min(100, Math.max(0, v));

// Convierte un valor 0..100 en coordenadas (x, y) sobre un semicírculo superior.
function polarSemi(cx: number, cy: number, r: number, score: number): { x: number; y: number } {
  const s = clampScore(score);
  const rad = Math.PI * (1 - s / 100);
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

// Construye el comando SVG de un arco semicircular entre dos puntuaciones (0..100).
function describeSemiArc(cx: number, cy: number, r: number, fromScore: number, toScore: number): string {
  const a = clampScore(fromScore);
  const b = clampScore(toScore);
  if (Math.abs(b - a) < 0.01) return "";
  const start = polarSemi(cx, cy, r, a);
  const end = polarSemi(cx, cy, r, b);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

// Deduce el nombre de la banda cuando no se recibe explícitamente por prop.
function defaultBand(score: number): string {
  if (score < 40) return "critical";
  if (score < 60) return "vulnerable";
  if (score < 80) return "stable";
  return "strong";
}

export type ScoreGaugeProps = {
  value: number;
  band?: string;
  potential?: number;
  caps?: CapItem[];
};

// Arco semicircular 0-100 con el score actual, tramo potencial y marcas de límite (caps).
export function ScoreGauge({ value, band, potential, caps = [] }: ScoreGaugeProps) {
  const cx = 160;
  const cy = 126;
  const r = 96;

  const safeValue = clampScore(value);
  const resolvedBand = band ?? defaultBand(safeValue);
  const hasPotential = typeof potential === "number" && potential > safeValue;
  const safePotential = hasPotential ? clampScore(potential) : undefined;
  const isBad = safeValue < 40;

  const trackPath = describeSemiArc(cx, cy, r, 0, 100);
  const valuePath = describeSemiArc(cx, cy, r, 0, safeValue);
  const potentialPath =
    safePotential !== undefined ? describeSemiArc(cx, cy, r, safeValue, safePotential) : "";

  const potentialAnchor =
    safePotential !== undefined ? polarSemi(cx, cy, r + 20, safePotential) : null;

  const ariaParts = [
    `Financial health score ${safeValue} out of 100, band ${resolvedBand}.`,
    safePotential !== undefined ? `Potential score up to ${safePotential}.` : "",
    caps.length > 0
      ? `Score caps: ${caps.map((c) => `${plainLabel(c.reason)} capped at ${c.cappedAt}`).join("; ")}.`
      : "",
  ].filter(Boolean);

  return (
    <div className="dbx-chart-wrap">
      <svg
        className="dbx-svg dbx-gauge-svg"
        viewBox="0 0 320 156"
        role="img"
        aria-label={ariaParts.join(" ")}
      >
        {/* Pista base 0..100 */}
        <path
          d={trackPath}
          className="dbx-gauge-track"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tramo potencial punteado desde el valor actual hasta combined.scoreAfter */}
        {potentialPath && (
          <path
            d={potentialPath}
            className="dbx-gauge-potential"
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Arco del score actual */}
        {valuePath && (
          <path
            d={valuePath}
            pathLength={100}
            className={`dbx-gauge-fill ${isBad ? "dbx-is-bad" : ""}`}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Marcas finas en cada cap (límite que frena la puntuación) */}
        {caps.map((cap, idx) => {
          const inner = polarSemi(cx, cy, r - 11, cap.cappedAt);
          const outer = polarSemi(cx, cy, r + 11, cap.cappedAt);
          return (
            <g key={`${cap.cappedAt}-${idx}`} className="dbx-gauge-cap">
              <title>{`${plainLabel(cap.reason)} (capped at ${cap.cappedAt})`}</title>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                className="dbx-gauge-cap-line"
              />
            </g>
          );
        })}

        {/* Etiqueta del potencial ("Up to N") */}
        {potentialAnchor && safePotential !== undefined && (
          <text
            x={Math.min(296, Math.max(24, potentialAnchor.x))}
            y={Math.max(16, potentialAnchor.y - 2)}
            textAnchor={
              potentialAnchor.x > cx + 20
                ? "start"
                : potentialAnchor.x < cx - 20
                  ? "end"
                  : "middle"
            }
            className="dbx-gauge-up-to"
          >
            {`Up to ${safePotential}`}
          </text>
        )}

        {/* Puntuación grande y banda en el centro */}
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          className={`dbx-gauge-score ${isBad ? "dbx-is-bad-text" : ""}`}
        >
          {safeValue}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" className="dbx-gauge-band">
          {`/ 100 · ${resolvedBand}`}
        </text>

        {/* Extremos de escala */}
        <text x={cx - r} y={cy + 20} textAnchor="middle" className="dbx-svg-axis-label">
          0
        </text>
        <text x={cx + r} y={cy + 20} textAnchor="middle" className="dbx-svg-axis-label">
          100
        </text>
      </svg>
    </div>
  );
}

// Formatea los nombres de los 5 pilares evitando jerga ("Liquidity" -> "Cash for emergencies").
function shortPillarLabel(name: string): string {
  if (name.includes("Liquidity")) return "Cash for emergencies";
  const lower = name.toLowerCase();
  if (lower.includes("saving")) return "Savings";
  if (lower.includes("debt")) return "Debt";
  if (lower.includes("invest")) return "Investments";
  if (lower.includes("insur") || lower.includes("protect")) return "Protection";
  const clean = plainLabel(name);
  return clean.length > 14 ? `${clean.slice(0, 13)}…` : clean;
}

export type PillarRadarProps = {
  pillars: PillarItem[];
};

// Radar de 5 ejes (0-100) con anillos guía, polígono relleno suave y valor en cada vértice.
export function PillarRadar({ pillars }: PillarRadarProps) {
  const count = pillars.length || 5;
  const cx = 160;
  const cy = 122;
  const maxR = 64;
  const levels = [25, 50, 75, 100];

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / count;

  const pointAt = (i: number, val: number) => {
    const a = angleFor(i);
    const r = (clampScore(val) / 100) * maxR;
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
    };
  };

  const polygonPoints = pillars
    .map((p, i) => {
      const pt = pointAt(i, p.score);
      return `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
    })
    .join(" ");

  const ariaSummary = pillars
    .map((p) => `${plainLabel(p.name)}: ${p.score} out of 100`)
    .join(", ");

  return (
    <div className="dbx-chart-wrap">
      <svg
        className="dbx-svg dbx-radar-svg"
        viewBox="0 0 320 244"
        role="img"
        aria-label={`Score by area radar chart: ${ariaSummary}.`}
      >
        {/* Pentágonos concéntricos de referencia */}
        {levels.map((lvl) => {
          const ring = Array.from({ length: count }, (_, i) => {
            const pt = pointAt(i, lvl);
            return `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
          }).join(" ");
          return <polygon key={lvl} points={ring} className="dbx-radar-ring" />;
        })}

        {/* Ejes desde el centro hasta cada vértice */}
        {pillars.map((p, i) => {
          const outer = pointAt(i, 100);
          return (
            <line
              key={p.name}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              className="dbx-radar-axis"
            />
          );
        })}

        {/* Polígono relleno con las puntuaciones reales */}
        {pillars.length > 0 && (
          <polygon points={polygonPoints} className="dbx-radar-area" />
        )}

        {/* Vértices y etiquetas con puntuación */}
        {pillars.map((p, i) => {
          const vertex = pointAt(i, p.score);
          const labelPos = pointAt(i, 128);
          const cos = Math.cos(angleFor(i));
          const sin = Math.sin(angleFor(i));
          // En la base del pentágono (sin > 0.5) centramos y separamos para que "Cash for emergencies" quepa íntegro.
          const isBottom = sin > 0.5;
          const anchor = isBottom
            ? "middle"
            : Math.abs(cos) < 0.25
              ? "middle"
              : cos > 0
                ? "start"
                : "end";
          const labelX = isBottom
            ? cos < 0
              ? Math.max(76, labelPos.x - 14)
              : Math.min(244, labelPos.x + 14)
            : labelPos.x;
          const dyLabel = sin < -0.5 ? -8 : isBottom ? 8 : -2;
          const isLow = p.score < 40;
          const displayName = shortPillarLabel(p.name);

          return (
            <g key={p.name} className="dbx-radar-node">
              <title>{`${plainLabel(p.name)}: ${p.score}/100${p.points ? ` (${p.points})` : ""}`}</title>
              <circle
                cx={vertex.x}
                cy={vertex.y}
                r={3.5}
                className={`dbx-radar-dot ${isLow ? "dbx-is-bad-dot" : ""}`}
              />
              <text
                x={labelX}
                y={labelPos.y + dyLabel}
                textAnchor={anchor}
                className="dbx-radar-label"
              >
                {displayName}
              </text>
              <text
                x={labelX}
                y={labelPos.y + dyLabel + 15}
                textAnchor={anchor}
                className={`dbx-radar-value ${isLow ? "dbx-is-bad-text" : ""}`}
              >
                {p.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Acorta el título de cada move para que quepa bajo su barra sin solaparse.
function shortMoveTitle(title: string, maxLen = 11): string {
  const clean = plainLabel(title).trim();
  const lower = clean.toLowerCase();
  if (lower.includes("revolving") || lower.includes("card")) return "Pay card";
  if (lower.includes("life") || lower.includes("mortality")) return "Life cover";
  if (lower.includes("umbrella")) return "Umbrella";
  if (lower.includes("withdrawal")) return "Withdrawals";
  if (lower.includes("growth") || lower.includes("glide")) return "Mix shift";
  if (lower.includes("annual savings")) return "Save more";
  if (lower.includes("coverage gap")) return "Home cover";
  if (lower.includes("concentration")) return "Diversify";
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

export type MovesWaterfallProps = {
  before: number;
  moves: MoveItem[];
  combined?: CombinedMoves | null;
};

// Gráfica de cascada (0-100): score inicial, escalón por cada move con badge de esfuerzo y barra final combinada.
export function MovesWaterfall({ before, moves, combined }: MovesWaterfallProps) {
  const vbW = 340;
  const vbH = 232;
  const padL = 30;
  const padR = 12;
  const padT = 24;
  const padB = 64;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;

  const yFor = (score: number) => padT + (1 - clampScore(score) / 100) * plotH;

  // Construimos las columnas: barra inicial, escalones y barra final opcional.
  type Column = {
    key: string;
    fullTitle: string;
    shortLabel: string;
    effort?: string;
    kind: "base" | "step" | "total";
    from: number;
    to: number;
    delta: number;
    badgeText: string;
  };

  const columns: Column[] = [];
  const startScore = clampScore(before);

  columns.push({
    key: "current",
    fullTitle: `Current score: ${startScore}`,
    shortLabel: "Now",
    kind: "base",
    from: 0,
    to: startScore,
    delta: startScore,
    badgeText: String(startScore),
  });

  let running = startScore;
  moves.forEach((m, idx) => {
    const cleanTitle = plainLabel(m.title);
    const delta = m.scoreAfter - m.scoreBefore;
    const stepStart = running;
    const stepEnd = clampScore(stepStart + delta);
    running = stepEnd;
    const sign = delta >= 0 ? `+${delta}` : String(delta);
    columns.push({
      key: `${m.title}-${idx}`,
      fullTitle: `${cleanTitle} (${sign} pts${m.effort ? `, ${m.effort} effort` : ""})`,
      shortLabel: shortMoveTitle(cleanTitle),
      effort: m.effort,
      kind: "step",
      from: stepStart,
      to: stepEnd,
      delta,
      badgeText: sign,
    });
  });

  if (combined) {
    const finalScore = clampScore(combined.scoreAfter);
    columns.push({
      key: "combined",
      fullTitle: `All together: ${finalScore} out of 100`,
      shortLabel: "Together",
      kind: "total",
      from: 0,
      to: finalScore,
      delta: finalScore - startScore,
      badgeText: String(finalScore),
    });
  }

  const colCount = columns.length;
  const slotW = plotW / Math.max(colCount, 1);
  const barW = Math.min(38, Math.max(20, slotW * 0.56));

  const ariaSteps = [
    `Starting score ${startScore}`,
    ...moves.map((m) => {
      const d = m.scoreAfter - m.scoreBefore;
      return `${plainLabel(m.title)} ${d >= 0 ? `+${d}` : d}${m.effort ? ` (${m.effort} effort)` : ""}`;
    }),
    combined ? `All together ${combined.scoreAfter}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="dbx-chart-wrap">
      <svg
        className="dbx-svg dbx-waterfall-svg"
        viewBox={`0 0 ${vbW} ${vbH}`}
        role="img"
        aria-label={`Score waterfall chart: ${ariaSteps}.`}
      >
        {/* Líneas guía horizontales del eje 0..100 */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line
                x1={padL}
                y1={y}
                x2={vbW - padR}
                y2={y}
                className="dbx-wf-grid"
              />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="dbx-svg-axis-label">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Columnas y conectores en cascada */}
        {columns.map((col, i) => {
          const centerX = padL + i * slotW + slotW / 2;
          const x = centerX - barW / 2;
          const topScore = Math.max(col.from, col.to);
          const bottomScore = Math.min(col.from, col.to);
          const yTop = yFor(topScore);
          const yBottom = yFor(bottomScore);
          // Si el escalón es +0, dibujamos un trazo visible de 3px para que se aprecie el nivel.
          const rawHeight = Math.abs(yBottom - yTop);
          const h = col.kind === "step" && col.delta === 0 ? 3 : Math.max(3, rawHeight);
          const barY = col.kind === "step" && col.delta === 0 ? yTop - 1.5 : yTop;

          const prev = i > 0 ? columns[i - 1] : null;
          const prevCenterX = prev ? padL + (i - 1) * slotW + slotW / 2 : 0;
          const connectorY = prev ? yFor(prev.to) : 0;

          const pillW = Math.min(slotW - 4, 48);
          const pillY = vbH - padB + 26;

          return (
            <g key={col.key} className={`dbx-wf-col dbx-wf-${col.kind}`}>
              <title>{col.fullTitle}</title>

              {prev && (
                <line
                  x1={prevCenterX + barW / 2}
                  y1={connectorY}
                  x2={x}
                  y2={connectorY}
                  className="dbx-wf-connector"
                />
              )}

              <rect
                x={x}
                y={barY}
                width={barW}
                height={h}
                rx={5}
                className={`dbx-wf-bar dbx-wf-bar-${col.kind} ${
                  col.kind === "step" && col.delta === 0 ? "dbx-wf-bar-zero" : ""
                }`}
              />

              <text
                x={centerX}
                y={Math.max(12, barY - 6)}
                textAnchor="middle"
                className="dbx-wf-value"
              >
                {col.badgeText}
              </text>

              <text
                x={centerX}
                y={vbH - padB + 17}
                textAnchor="middle"
                className="dbx-wf-label"
              >
                {col.shortLabel}
              </text>

              {/* Badge pequeño de esfuerzo bajo cada escalón */}
              {col.effort && (
                <g className="dbx-wf-effort-group">
                  <rect
                    x={centerX - pillW / 2}
                    y={pillY}
                    width={pillW}
                    height={16}
                    rx={8}
                    className="dbx-wf-effort-pill"
                  />
                  <text
                    x={centerX}
                    y={pillY + 11.5}
                    textAnchor="middle"
                    className="dbx-wf-effort-text"
                  >
                    {col.effort === "medium" ? "med" : col.effort}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type TargetBarsProps = {
  items: TargetBarItem[];
  ratio?: boolean;
};

// Barras horizontales en SVG comparando valor actual frente a objetivo opcional.
export function TargetBars({ items, ratio = false }: TargetBarsProps) {
  const kind = ratio ? "pct" : "usd";
  const fmt = (v: number) => formatStat(kind, v);

  const maxVal = Math.max(
    ...items.map((item) => Math.max(item.value, item.target ?? 0)),
    1
  );

  const vbW = 340;
  const rowH = 44;
  const vbH = Math.max(48, items.length * rowH + 6);
  const trackX = 4;
  const trackW = vbW - 8;

  const ariaDesc = items
    .map(
      (i) =>
        `${plainLabel(i.label)}: ${fmt(i.value)}${
          i.target !== undefined ? ` (target ${fmt(i.target)})` : ""
        }`
    )
    .join(", ");

  return (
    <div className="dbx-chart-wrap">
      <svg
        className="dbx-svg dbx-targetbars-svg"
        viewBox={`0 0 ${vbW} ${vbH}`}
        role="img"
        aria-label={`Comparison bars: ${ariaDesc}.`}
      >
        {items.map((item, idx) => {
          const yBase = idx * rowH;
          const labelY = yBase + 15;
          const trackY = yBase + 23;
          const trackH = 9;
          const displayLabel = plainLabel(item.label);

          const fillRatio = Math.min(1, Math.max(0, item.value / maxVal));
          const fillW = fillRatio * trackW;

          const hasTarget = typeof item.target === "number";
          const targetRatio = hasTarget
            ? Math.min(1, Math.max(0, (item.target ?? 0) / maxVal))
            : null;
          const targetX = targetRatio !== null ? trackX + targetRatio * trackW : null;

          return (
            <g key={item.label} className="dbx-tbar-row">
              <title>
                {`${displayLabel}: ${fmt(item.value)}${
                  hasTarget && item.target !== undefined
                    ? ` · target ${fmt(item.target)}`
                    : ""
                }`}
              </title>

              {/* Cabecera con nombre e importe/porcentaje */}
              <text x={trackX} y={labelY} textAnchor="start" className="dbx-tbar-label">
                {displayLabel}
              </text>
              <text
                x={trackX + trackW}
                y={labelY}
                textAnchor="end"
                className="dbx-tbar-amount"
              >
                {fmt(item.value)}
                {hasTarget && item.target !== undefined && (
                  <tspan className="dbx-tbar-target-text">{` · target ${fmt(item.target)}`}</tspan>
                )}
              </text>

              {/* Pista gris de fondo */}
              <rect
                x={trackX}
                y={trackY}
                width={trackW}
                height={trackH}
                rx={4.5}
                className="dbx-tbar-track"
              />

              {/* Barra de valor actual */}
              {fillW > 0 && (
                <rect
                  x={trackX}
                  y={trackY}
                  width={Math.max(4, fillW)}
                  height={trackH}
                  rx={4.5}
                  className="dbx-tbar-fill"
                />
              )}

              {/* Marca vertical del target cuando existe */}
              {targetX !== null && (
                <g className="dbx-tbar-target-mark">
                  <line
                    x1={targetX}
                    y1={trackY - 4}
                    x2={targetX}
                    y2={trackY + trackH + 4}
                    className="dbx-tbar-target-line"
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- 5. Ring: anillo de porcentaje 0-1 (clamp visual a 100%, texto real) ----
export type RingProps = {
  value: number;
  label: string;
  bad?: boolean;
};

export function Ring({ value, label, bad = false }: RingProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const pctText = formatStat("pct", value);
  const cleanLabel = plainLabel(label);

  const cx = 48;
  const cy = 48;
  const r = 38;

  return (
    <div className="dbx-ring-wrap">
      <svg
        className="dbx-svg dbx-ring-svg"
        viewBox="0 0 96 96"
        role="img"
        aria-label={`${cleanLabel}: ${pctText}`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          className="dbx-ring-track"
          fill="none"
        />
        {clamped > 0.001 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            pathLength={100}
            strokeDasharray={`${(clamped * 100).toFixed(2)} 100`}
            transform={`rotate(-90 ${cx} ${cy})`}
            className={`dbx-ring-fill ${bad ? "dbx-is-bad" : ""}`}
            fill="none"
            strokeLinecap="round"
          />
        )}
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          className={`dbx-ring-value ${bad ? "dbx-is-bad-text" : ""}`}
        >
          {pctText}
        </text>
      </svg>
      <p className="eyebrow dbx-ring-label">{cleanLabel}</p>
    </div>
  );
}

// ---- 6a. MonthBoxes: 12 casillas para meses cubiertos por el fondo de emergencia ----
export type MonthBoxesProps = {
  months: number;
  label?: string;
};

export function MonthBoxes({ months, label = "Emergency cash covers" }: MonthBoxesProps) {
  const filled = Math.min(12, Math.max(0, Math.round(months)));
  const isBad = months < 4;
  const cleanLabel = plainLabel(label);
  const displayMonths = formatStat("months", months);

  const vbW = 340;
  const vbH = 30;
  const gap = 5;
  const boxW = (vbW - gap * 11) / 12;
  const boxH = 22;

  return (
    <div className="dbx-mboxes-wrap">
      <div className="dbx-mboxes-head">
        <p className="eyebrow">{cleanLabel}</p>
        <span className={`dbx-mboxes-val ${isBad ? "tone-bad" : ""}`}>
          {displayMonths}
        </span>
      </div>
      <div className="dbx-chart-wrap">
        <svg
          className="dbx-svg dbx-mboxes-svg"
          viewBox={`0 0 ${vbW} ${vbH}`}
          role="img"
          aria-label={`${cleanLabel}: ${displayMonths} (${filled} of 12 boxes filled)`}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const x = i * (boxW + gap);
            const isOn = i < filled;
            return (
              <rect
                key={i}
                x={x}
                y={4}
                width={boxW}
                height={boxH}
                rx={5}
                className={`dbx-mbox ${
                  isOn ? (isBad ? "dbx-mbox-bad" : "dbx-mbox-on") : "dbx-mbox-off"
                }`}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---- 6b. VsBar: barras "you have" vs marca "recommended" (rojo solo si have < recommended) ----
export type VsBarRow = {
  label: string;
  have: number;
  recommended: number;
};

export type VsBarProps = {
  rows: VsBarRow[];
};

export function VsBar({ rows }: VsBarProps) {
  if (rows.length === 0) return null;

  const vbW = 340;
  const rowH = 52;
  const vbH = rows.length * rowH;
  const trackX = 6;
  const trackW = vbW - 12;

  const ariaDesc = rows
    .map(
      (r) =>
        `${plainLabel(r.label)}: you have ${formatStat("usd", r.have)}, recommended ${formatStat(
          "usd",
          r.recommended
        )}`
    )
    .join("; ");

  return (
    <div className="dbx-chart-wrap">
      <svg
        className="dbx-svg dbx-vsbar-svg"
        viewBox={`0 0 ${vbW} ${vbH}`}
        role="img"
        aria-label={`Coverage comparison: ${ariaDesc}.`}
      >
        {rows.map((row, idx) => {
          const yBase = idx * rowH;
          const labelY = yBase + 16;
          const trackY = yBase + 25;
          const trackH = 10;
          const isShort = row.have < row.recommended;
          const maxVal = Math.max(row.have, row.recommended, 1);
          const haveRatio = Math.min(1, Math.max(0, row.have / maxVal));
          const recRatio = Math.min(1, Math.max(0, row.recommended / maxVal));
          const haveW = haveRatio * trackW;
          const recX = trackX + recRatio * trackW;
          const clean = plainLabel(row.label);

          return (
            <g key={row.label} className="dbx-vs-row">
              <title>
                {`${clean}: have ${formatStat("usd", row.have)} vs recommended ${formatStat(
                  "usd",
                  row.recommended
                )}`}
              </title>

              <text x={trackX} y={labelY} textAnchor="start" className="dbx-tbar-label">
                {clean}
              </text>
              <text x={trackX + trackW} y={labelY} textAnchor="end" className="dbx-tbar-amount">
                <tspan className={isShort ? "dbx-is-bad-text" : ""}>
                  {formatStat("usd", row.have)}
                </tspan>
                <tspan className="dbx-tbar-target-text">
                  {` / rec. ${formatStat("usd", row.recommended)}`}
                </tspan>
              </text>

              <rect
                x={trackX}
                y={trackY}
                width={trackW}
                height={trackH}
                rx={5}
                className="dbx-tbar-track"
              />

              {/* Barra de cobertura actual (si es 0 y falta cobertura, pintamos una muesca roja) */}
              {(haveW > 0 || isShort) && (
                <rect
                  x={trackX}
                  y={trackY}
                  width={haveW > 0 ? Math.max(6, haveW) : 6}
                  height={trackH}
                  rx={5}
                  className={`dbx-tbar-fill ${isShort ? "dbx-is-bad-fill" : ""}`}
                />
              )}

              {/* Marca vertical del mínimo recomendado */}
              <line
                x1={recX}
                y1={trackY - 4}
                x2={recX}
                y2={trackY + trackH + 4}
                className={`dbx-vs-rec-line ${isShort ? "dbx-is-bad" : ""}`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- 7. DebtBars: barras ordenadas por balance desc con rate a la derecha (rate >= 0.15 en rojo) ----
export type DebtBarRow = {
  name: string;
  balance: number;
  rate: number;
};

export type DebtBarsProps = {
  rows: DebtBarRow[];
};

export function DebtBars({ rows }: DebtBarsProps) {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => b.balance - a.balance);
  const maxBalance = Math.max(...sorted.map((r) => r.balance), 1);

  const vbW = 340;
  const rowH = 46;
  const vbH = sorted.length * rowH;
  const trackX = 4;
  const rateColW = 58;
  const trackW = vbW - trackX - rateColW;

  const ariaDesc = sorted
    .map(
      (r) =>
        `${r.name}: ${formatStat("usd", r.balance)} at ${formatStat("pct", r.rate)}`
    )
    .join("; ");

  return (
    <div className="dbx-chart-wrap">
      <svg
        className="dbx-svg dbx-debtbars-svg"
        viewBox={`0 0 ${vbW} ${vbH}`}
        role="img"
        aria-label={`Debts by balance: ${ariaDesc}.`}
      >
        {sorted.map((row, idx) => {
          const yBase = idx * rowH;
          const labelY = yBase + 15;
          const trackY = yBase + 23;
          const trackH = 10;
          const isHighRate = row.rate >= 0.15;
          const fillW = Math.max(6, (row.balance / maxBalance) * trackW);
          const rateText = formatStat("pct", row.rate);

          return (
            <g key={`${row.name}-${idx}`} className="dbx-dbar-row">
              <title>{`${row.name}: ${formatStat("usd", row.balance)} (${rateText} APR)`}</title>

              <text x={trackX} y={labelY} textAnchor="start" className="dbx-tbar-label">
                {row.name}
              </text>
              <text
                x={trackX + trackW}
                y={labelY}
                textAnchor="end"
                className="dbx-tbar-amount"
              >
                {formatStat("usd", row.balance)}
              </text>

              <rect
                x={trackX}
                y={trackY}
                width={trackW}
                height={trackH}
                rx={5}
                className="dbx-tbar-track"
              />

              <rect
                x={trackX}
                y={trackY}
                width={fillW}
                height={trackH}
                rx={5}
                className={`dbx-tbar-fill ${isHighRate ? "dbx-is-bad-fill" : ""}`}
              />

              {/* Etiqueta de tipo de interés a la derecha */}
              <text
                x={vbW - 4}
                y={trackY + 8.5}
                textAnchor="end"
                className={`dbx-dbar-rate ${isHighRate ? "dbx-is-bad-text" : ""}`}
              >
                {rateText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- 8a. StackBar: barra 100% apilada en tonos de gris con leyenda de porcentajes ----
const STACK_TONES = ["#0a0a0a", "#404040", "#737373", "#a3a3a3", "#d4d4d4"];

export type StackSegment = {
  label: string;
  value: number;
};

export type StackBarProps = {
  segments: StackSegment[];
  rowLabel?: string;
  showLegend?: boolean;
  compareSegments?: StackSegment[];
};

export function StackBar({
  segments,
  rowLabel,
  showLegend = true,
  compareSegments,
}: StackBarProps) {
  // Id único por instancia para el clipPath (evita choques entre varias barras).
  const clipId = `dbx-stack-clip-${useId().replace(/:/g, "")}`;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  const compareTotal = compareSegments
    ? compareSegments.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1
    : null;

  const vbW = 340;
  const vbH = 26;
  const barH = 18;
  const barY = 4;

  let cursorX = 0;
  const rects = segments.map((s, idx) => {
    const share = Math.max(0, s.value) / total;
    const w = share * vbW;
    const x = cursorX;
    cursorX += w;
    return {
      label: plainLabel(s.label),
      share,
      x,
      w,
      color: STACK_TONES[idx % STACK_TONES.length],
    };
  });

  const ariaDesc = rects
    .map((r) => `${r.label} ${formatStat("pct", r.share)}`)
    .join(", ");

  return (
    <div className="dbx-stack-wrap">
      {rowLabel && (
        <div className="dbx-stack-head">
          <span className="dbx-stack-row-label">{rowLabel}</span>
        </div>
      )}
      <div className="dbx-chart-wrap">
        <svg
          className="dbx-svg dbx-stack-svg"
          viewBox={`0 0 ${vbW} ${vbH}`}
          role="img"
          aria-label={`${rowLabel ? `${rowLabel}: ` : "Stacked breakdown: "}${ariaDesc}.`}
        >
          <clipPath id={clipId}>
            <rect x={0} y={barY} width={vbW} height={barH} rx={6} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            {rects.map((r, idx) => (
              <g key={r.label}>
                <title>{`${r.label}: ${formatStat("pct", r.share)}`}</title>
                <rect
                  x={r.x}
                  y={barY}
                  width={Math.max(0, r.w - (idx < rects.length - 1 ? 1.5 : 0))}
                  height={barH}
                  fill={r.color}
                />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {showLegend && (
        <ul className="dbx-stack-legend">
          {rects.map((r, idx) => {
            const cmpShare =
              compareSegments && compareTotal
                ? Math.max(0, compareSegments[idx]?.value ?? 0) / compareTotal
                : null;
            return (
              <li key={r.label} className="dbx-stack-legend-item">
                <span
                  className="dbx-stack-swatch"
                  style={{ background: r.color }}
                  aria-hidden="true"
                />
                <span className="dbx-stack-legend-label">{r.label}</span>
                <strong className="dbx-stack-legend-pct">
                  {cmpShare !== null
                    ? `${formatStat("pct", cmpShare)} → ${formatStat("pct", r.share)}`
                    : formatStat("pct", r.share)}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---- 8b. BalanceBar: Headline Net worth encima + dos barras proporcionales Assets vs Debts ----
export type BalanceBarProps = {
  netWorth: number;
  assets: number;
  debts: number;
  headlineLabel?: string;
};

export function BalanceBar({
  netWorth,
  assets,
  debts,
  headlineLabel = "Net worth",
}: BalanceBarProps) {
  const maxVal = Math.max(assets, debts, 1);
  const vbW = 340;
  const rowH = 42;
  const vbH = rowH * 2;
  const trackX = 4;
  const trackW = vbW - 8;

  const rows = [
    { label: "Total assets", value: assets, isDebt: false },
    { label: "Total debts", value: debts, isDebt: true },
  ];

  return (
    <div className="dbx-balance-wrap">
      <div className="dbx-balance-headline">
        <p className="eyebrow">{plainLabel(headlineLabel)}</p>
        <p className={`stat-value dbx-headline-value ${netWorth < 0 ? "tone-bad" : ""}`}>
          {formatStat("usd", netWorth)}
        </p>
      </div>

      <div className="dbx-chart-wrap">
        <svg
          className="dbx-svg dbx-balance-svg"
          viewBox={`0 0 ${vbW} ${vbH}`}
          role="img"
          aria-label={`${plainLabel(headlineLabel)} ${formatStat("usd", netWorth)}: Total assets ${formatStat(
            "usd",
            assets
          )}, Total debts ${formatStat("usd", debts)}.`}
        >
          {rows.map((r, idx) => {
            const yBase = idx * rowH;
            const labelY = yBase + 14;
            const trackY = yBase + 22;
            const trackH = 10;
            const fillW =
              r.value > 0 ? Math.max(6, (r.value / maxVal) * trackW) : 0;

            return (
              <g key={r.label}>
                <text x={trackX} y={labelY} textAnchor="start" className="dbx-tbar-label">
                  {r.label}
                </text>
                <text
                  x={trackX + trackW}
                  y={labelY}
                  textAnchor="end"
                  className="dbx-tbar-amount"
                >
                  {formatStat("usd", r.value)}
                </text>
                <rect
                  x={trackX}
                  y={trackY}
                  width={trackW}
                  height={trackH}
                  rx={5}
                  className="dbx-tbar-track"
                />
                {fillW > 0 && (
                  <rect
                    x={trackX}
                    y={trackY}
                    width={fillW}
                    height={trackH}
                    rx={5}
                    className={`dbx-tbar-fill ${r.isDebt ? "dbx-balance-debt-fill" : ""}`}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
