import {
  formatStat,
  type Analysis,
  type Family,
  type Member,
  type Section,
} from "../data";
import { plainLabel, type CapItem } from "./charts";

// Estructura común devuelta por las funciones <nombre>Story(props).
export type ChartStory = {
  takeaway: string;
  more: string[];
};

// ============================================================================
// 1. PillarPoints: "Where your points come from"
// ============================================================================

export type PillarPointRow = {
  name: string;
  earned: number;
  max: number;
  score?: number;
};

export type PillarPointsProps = {
  pillars: PillarPointRow[];
  scoreValue: number;
  caps?: CapItem[];
};

// Parsea cadenas tipo "26/30" en { earned: 26, max: 30 }.
function parsePointsPair(raw?: string): { earned: number; max: number } | null {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const earned = Number(m[1]);
  const max = Number(m[2]);
  if (!Number.isFinite(earned) || !Number.isFinite(max) || max <= 0) return null;
  return { earned, max };
}

// Traduce el motivo técnico de un tope (cap) a lenguaje llano para la frase resumen.
function plainCapReason(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("revolving") || lower.includes("apr") || lower.includes("card")) {
    return "high-interest credit card debt";
  }
  if (lower.includes("mortality") || lower.includes("life")) {
    return "low life insurance coverage";
  }
  if (lower.includes("umbrella") || lower.includes("liability")) {
    return "missing umbrella coverage";
  }
  if (lower.includes("liquidity") || lower.includes("emergency")) {
    return "low emergency cash";
  }
  if (lower.includes("withdrawal")) {
    return "a high retirement withdrawal rate";
  }
  return plainLabel(reason).toLowerCase();
}

// Construye las props de PillarPoints a partir de Analysis["score"], o null si faltan datos.
export function buildPillarPointsProps(
  score: Analysis["score"]
): PillarPointsProps | null {
  if (!score.pillars || score.pillars.length === 0) return null;

  const rows: PillarPointRow[] = [];
  for (const p of score.pillars) {
    const parsed = parsePointsPair(p.points);
    if (!parsed) continue;
    rows.push({
      name: p.name,
      earned: parsed.earned,
      max: parsed.max,
      score: p.score,
    });
  }

  if (rows.length === 0) return null;

  const caps = (score as { caps?: CapItem[] }).caps ?? [];
  return {
    pillars: rows,
    scoreValue: score.value,
    caps,
  };
}

// Barras horizontales de puntos conseguidos vs máximo por pilar; marca el pilar con más puntos perdidos ("Biggest gap").
export function PillarPoints({ pillars, scoreValue }: PillarPointsProps) {
  if (!pillars || pillars.length === 0) return null;

  const maxPossible = Math.max(...pillars.map((p) => p.max), 1);
  const totalEarned = pillars.reduce((s, p) => s + p.earned, 0);
  const totalMax = pillars.reduce((s, p) => s + p.max, 0);
  const showTotal = totalEarned === scoreValue;

  // Índice del pilar con más puntos perdidos (max - earned).
  let biggestGapIdx = -1;
  let biggestGapVal = 0;
  pillars.forEach((p, idx) => {
    const lost = p.max - p.earned;
    if (lost > biggestGapVal) {
      biggestGapVal = lost;
      biggestGapIdx = idx;
    }
  });

  const vbW = 340;
  const rowH = 50;
  const vbH = pillars.length * rowH;
  const trackX = 4;
  const trackW = vbW - 8;

  const ariaDesc = pillars
    .map((p, idx) => {
      const clean = plainLabel(p.name);
      const tag = idx === biggestGapIdx ? " (Biggest gap)" : "";
      return `${clean}: ${p.earned} of ${p.max}${tag}`;
    })
    .join("; ");

  return (
    <div className="dbx-mc-wrap dbx-mc-pillars">
      <div className="dbx-mc-head">
        <p className="eyebrow">Where your points come from</p>
        {showTotal && (
          <span className="dbx-mc-total">{`${totalEarned} of ${totalMax} pts`}</span>
        )}
      </div>

      <div className="dbx-mc-chart-wrap">
        <svg
          className="dbx-mc-svg"
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Where your points come from: ${ariaDesc}.`}
        >
          {pillars.map((p, idx) => {
            const yBase = idx * rowH;
            const labelY = yBase + 16;
            const trackY = yBase + 25;
            const trackH = 11;
            const cleanName = plainLabel(p.name);
            const isBiggestGap = idx === biggestGapIdx;

            const maxW = Math.max(12, (p.max / maxPossible) * trackW);
            const earnedRatio = Math.min(1, Math.max(0, p.earned / maxPossible));
            const rawFillW = earnedRatio * trackW;
            const fillW = p.earned > 0 ? Math.max(6, rawFillW) : isBiggestGap ? 6 : 0;

            return (
              <g key={p.name} className="dbx-mc-pillar-row">
                <title>{`${cleanName}: ${p.earned} of ${p.max}${isBiggestGap ? " · Biggest gap" : ""}`}</title>

                <text
                  x={trackX}
                  y={labelY}
                  textAnchor="start"
                  className={`dbx-mc-pillar-label ${isBiggestGap ? "dbx-mc-pillar-label-gap" : ""}`}
                >
                  {cleanName}
                </text>

                {isBiggestGap && (
                  <g
                    transform={`translate(${Math.min(
                      vbW - 148,
                      trackX + cleanName.length * 6.8 + 8
                    )}, ${labelY - 11})`}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={70}
                      height={15}
                      rx={7.5}
                      className="dbx-mc-gap-pill"
                    />
                    <text
                      x={35}
                      y={10.5}
                      textAnchor="middle"
                      className="dbx-mc-gap-pill-text"
                    >
                      Biggest gap
                    </text>
                  </g>
                )}

                <text
                  x={trackX + trackW}
                  y={labelY}
                  textAnchor="end"
                  className={`dbx-mc-pillar-pts ${isBiggestGap ? "dbx-mc-pillar-pts-bad" : ""}`}
                >
                  {`${p.earned} of ${p.max}`}
                </text>

                {/* Fondo sutil del ancho total para comparar pesos entre pilares */}
                <rect
                  x={trackX}
                  y={trackY}
                  width={trackW}
                  height={trackH}
                  rx={5.5}
                  className="dbx-mc-pillar-bg-track"
                />

                {/* Pista del máximo de puntos que aporta este pilar */}
                <rect
                  x={trackX}
                  y={trackY}
                  width={maxW}
                  height={trackH}
                  rx={5.5}
                  className="dbx-mc-pillar-max-track"
                />

                {/* Puntos conseguidos (muesca en --ember si es el mayor hueco) */}
                {fillW > 0 && (
                  <rect
                    x={trackX}
                    y={trackY}
                    width={fillW}
                    height={trackH}
                    rx={5.5}
                    className={`dbx-mc-pillar-fill ${
                      isBiggestGap ? "dbx-mc-pillar-fill-bad" : ""
                    }`}
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

// Resumen narrativo y guía de lectura en inglés llano para PillarPoints.
export function pillarPointsStory(props: PillarPointsProps): ChartStory {
  const { pillars, scoreValue, caps = [] } = props;
  if (!pillars || pillars.length === 0) {
    return {
      takeaway: "Your score is built from the points earned across five financial areas.",
      more: [
        "Each bar compares the points you earn today with the maximum points available in that area.",
        "The area with the most missing points is where your score has the most room to grow.",
      ],
    };
  }

  const totalEarned = pillars.reduce((s, p) => s + p.earned, 0);
  const totalMax = pillars.reduce((s, p) => s + p.max, 0);
  const diff = Math.abs(totalEarned - scoreValue);
  const primaryCap =
    caps.length > 0 ? [...caps].sort((a, b) => a.cappedAt - b.cappedAt)[0] : null;

  const biggest = pillars.reduce(
    (worst, cur) => (cur.max - cur.earned > worst.max - worst.earned ? cur : worst),
    pillars[0]
  );
  const strongest = pillars.reduce(
    (best, cur) => (cur.earned / cur.max > best.earned / best.max ? cur : best),
    pillars[0]
  );
  const lost = biggest.max - biggest.earned;
  const biggestLabel = plainLabel(biggest.name);
  const strongestLabel = plainLabel(strongest.name);

  if (diff > 1 && primaryCap) {
    return {
      takeaway: `Your areas add up to ${totalEarned} points, but ${plainCapReason(primaryCap.reason)} holds your score at ${scoreValue}.`,
      more: [
        `Across the five areas you earn ${totalEarned} out of ${totalMax} raw points, while a score cap limits your overall score to ${scoreValue} until that risk is addressed.`,
        "In each row, the dark bar shows the points you already have and the grey track shows the maximum points that area can contribute.",
        `Your biggest point gap is in ${biggestLabel} (${biggest.earned} of ${biggest.max}), while ${strongestLabel} (${strongest.earned} of ${strongest.max}) is your strongest area.`,
      ],
    };
  }

  if (diff > 0) {
    // Cuando difiere por 1 punto (redondeo de cada pilar), omitimos la suma para no contradecir la nota.
    return {
      takeaway:
        lost > 0
          ? `Your biggest gap is in ${biggestLabel}, where you earn ${biggest.earned} of ${biggest.max} points (${lost} points left on the table).`
          : "You earn the full points available across every area.",
      more: [
        "In each row, the dark bar shows the points you already have and the grey track shows the maximum points that area can contribute.",
        `Holding onto your strength in ${strongestLabel} (${strongest.earned} of ${strongest.max}) while closing the gap in ${biggestLabel} is where the most points are.`,
      ],
    };
  }

  return {
    takeaway:
      lost > 0
        ? `Your biggest gap is in ${biggestLabel}, where you earn ${biggest.earned} of ${biggest.max} points (${lost} points left on the table).`
        : `You earn the full ${totalEarned} of ${totalMax} points across every area.`,
    more: [
      `Together your five areas add up to ${totalEarned} out of ${totalMax} points, matching your overall score.`,
      "In each row, the dark bar shows the points you already have and the grey track shows the maximum points that area can contribute.",
      `Holding onto your strength in ${strongestLabel} (${strongest.earned} of ${strongest.max}) while closing the gap in ${biggestLabel} is where the most points are.`,
    ],
  };
}

// ============================================================================
// 2. FamilyTimeline: "Your family's timeline"
// ============================================================================

export type TimelineMilestone = {
  label: string;
  /** Edad del adulto principal cuando ocurre el hito (coordenada común en el eje horizontal). */
  clientAge: number;
  /** Etiqueta de edad o año tal como figura en los datos (ej. "62", "2038"). */
  badge: string;
  /** Nombre del miembro del hogar al que pertenece el hito. */
  personName: string;
  /** En --ember cuando representa agotamiento de ahorros. */
  bad?: boolean;
  kind: "retire" | "college" | "home" | "runout" | "end";
};

export type TimelinePersonRow = {
  name: string;
  role: string;
  age: number;
};

export type FamilyTimelineProps = {
  members: TimelinePersonRow[];
  startAge: number;
  endAge: number;
  milestones: TimelineMilestone[];
};

const BASE_PLAN_YEAR = 2026;

// Construye las props de FamilyTimeline desde Family y Analysis (o devuelve null si faltan datos).
export function buildFamilyTimelineProps(
  family: Family,
  analysis: Analysis
): FamilyTimelineProps | null {
  const household: Member[] = family.household ?? [];
  if (household.length === 0) return null;

  const client = household.find((m) => m.role === "client") ?? household[0];
  const startAge = client.age;

  const retSection = analysis.sections.find((s) => s.id === "retirement");
  const ahorrosProbe = family.probes.find((p) => p.id === "ahorros");

  // Fin del plan (de retirement.stats o de la sonda "ahorros").
  let endAge: number | null = null;
  const planEndStat = retSection?.stats.find((st) => st.label === "Plan runs until");
  if (planEndStat && typeof planEndStat.value === "number") {
    endAge = planEndStat.value;
  } else if (typeof ahorrosProbe?.truth.endOfPlanAge === "number") {
    endAge = ahorrosProbe.truth.endOfPlanAge;
  }

  const milestones: TimelineMilestone[] = [];

  // Textos del análisis donde ya aparecen años explícitos de universidad o compra de vivienda.
  const narrativeChunks: string[] = [
    ...(analysis?.summary ?? []),
    ...(analysis?.sections.flatMap((s) => s.observations) ?? []),
  ];
  const fullText = narrativeChunks.join(" ");

  // 1. Año de compra de casa si figura explícitamente en los textos (ej. "January 2027 home purchase").
  const homeMatch =
    fullText.match(/\b(20\d{2})\s+home\s+purchase\b/i) ??
    fullText.match(/\bhome\s+purchase[^.;]*?\b(20\d{2})\b/i);
  if (homeMatch) {
    const homeYear = Number(homeMatch[1]);
    if (Number.isFinite(homeYear)) {
      const offset = Math.max(0, homeYear - BASE_PLAN_YEAR);
      milestones.push({
        label: "Home purchase",
        clientAge: startAge + offset,
        badge: String(homeYear),
        personName: client.name,
        kind: "home",
      });
    }
  }

  // 2. Universidad de los hijos si figura el año junto a su nombre en los textos del plan.
  for (const member of household) {
    if (member.role !== "child") continue;
    const escaped = member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mAfter = fullText.match(
      new RegExp(`\\b${escaped}\\b(?:\\s+starts\\s+college|\\s+starting)?\\s+in\\s+(?:[A-Z][a-z]+\\s+)?(20\\d{2})\\b`, "i")
    );
    const mBefore = fullText.match(
      new RegExp(`\\b(20\\d{2})\\s+for\\s+${escaped}\\b`, "i")
    );
    const yearStr = mAfter?.[1] ?? mBefore?.[1];
    if (yearStr) {
      const colYear = Number(yearStr);
      if (Number.isFinite(colYear)) {
        const offset = Math.max(0, colYear - BASE_PLAN_YEAR);
        milestones.push({
          label: `${member.name} college`,
          clientAge: startAge + offset,
          badge: String(colYear),
          personName: member.name,
          kind: "college",
        });
      }
    }
  }

  // 3. Jubilación de cada adulto desde los stats de la sección retirement.
  if (retSection) {
    for (const st of retSection.stats) {
      if (st.kind === "age" && typeof st.value === "number" && st.label.endsWith("retires at")) {
        const personPrefix = st.label.slice(0, -"retires at".length).trim();
        const matchedMember =
          household.find((m) => m.name.toLowerCase() === personPrefix.toLowerCase()) ??
          client;
        const offset = Math.max(0, st.value - matchedMember.age);
        milestones.push({
          label: `${matchedMember.name} retires`,
          clientAge: startAge + offset,
          badge: `Age ${st.value}`,
          personName: matchedMember.name,
          kind: "retire",
        });
      }
    }
  }

  // 4. Edad a la que se agotan los ahorros (sonda "ahorros" o stat "Savings run out at").
  let runOutAge: number | null = null;
  if (ahorrosProbe?.truth.depletes && typeof ahorrosProbe.truth.age === "number") {
    runOutAge = ahorrosProbe.truth.age;
  } else {
    const runOutStat = retSection?.stats.find((st) => st.label === "Savings run out at");
    if (runOutStat && typeof runOutStat.value === "number") {
      runOutAge = runOutStat.value;
    } else if (
      retSection?.chart?.kind === "line" &&
      typeof retSection.chart.markAge === "number"
    ) {
      runOutAge = retSection.chart.markAge;
    }
  }

  if (runOutAge !== null) {
    milestones.push({
      label: "Savings run out",
      clientAge: runOutAge,
      badge: `Age ${runOutAge}`,
      personName: client.name,
      bad: true,
      kind: "runout",
    });
  }

  // 5. Fin del plan.
  if (endAge !== null) {
    milestones.push({
      label: "Plan ends",
      clientAge: endAge,
      badge: `Age ${endAge}`,
      personName: client.name,
      kind: "end",
    });
  }

  if (milestones.length === 0) return null;

  const resolvedEndAge =
    endAge ?? Math.max(...milestones.map((m) => m.clientAge), startAge + 30);

  return {
    members: household.map((m) => ({ name: m.name, role: m.role, age: m.age })),
    startAge,
    endAge: resolvedEndAge,
    milestones,
  };
}

// Línea temporal horizontal con una fila por miembro del hogar y marcadores de hitos del plan.
export function FamilyTimeline({
  members,
  startAge,
  endAge,
  milestones,
}: FamilyTimelineProps) {
  if (!members || members.length === 0 || !milestones || milestones.length === 0) {
    return null;
  }

  const vbW = 340;
  const padL = 88;
  const padR = 16;
  const trackW = vbW - padL - padR;
  const topH = 22;
  const rowH = 46;
  const vbH = topH + members.length * rowH + 6;
  const span = Math.max(1, endAge - startAge);

  const xForAge = (cAge: number) => {
    const ratio = Math.min(1, Math.max(0, (cAge - startAge) / span));
    return padL + ratio * trackW;
  };

  const runOutMs = milestones.find((m) => m.kind === "runout" || m.bad);
  const runOutX = runOutMs ? xForAge(runOutMs.clientAge) : null;

  const sortedMilestones = [...milestones].sort((a, b) => a.clientAge - b.clientAge);

  // Líneas guía verticales suaves para los hitos principales.
  const uniqueGuideAges = Array.from(
    new Set(sortedMilestones.map((m) => m.clientAge))
  );

  const ariaSummary = sortedMilestones
    .map((m) => `${m.label} (${m.badge})`)
    .join(", ");

  return (
    <div className="dbx-mc-wrap dbx-mc-timeline">
      <div className="dbx-mc-head">
        <p className="eyebrow">Your family&apos;s timeline</p>
        <span className="dbx-mc-total">{`Age ${startAge} → ${endAge}`}</span>
      </div>

      <div className="dbx-mc-chart-wrap">
        <svg
          className="dbx-mc-svg"
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Family timeline from age ${startAge} to ${endAge}: ${ariaSummary}.`}
        >
          {/* Cabecera del eje horizontal */}
          <text
            x={padL}
            y={14}
            textAnchor="start"
            className="dbx-mc-tl-axis-label"
          >
            {`Today (${startAge})`}
          </text>
          <text
            x={padL + trackW}
            y={14}
            textAnchor="end"
            className="dbx-mc-tl-axis-label"
          >
            {`Plan ends (${endAge})`}
          </text>

          {/* Guías verticales de hitos */}
          {uniqueGuideAges.map((cAge) => {
            const gx = xForAge(cAge);
            const isBadGuide = runOutMs && Math.abs(cAge - runOutMs.clientAge) < 0.5;
            return (
              <line
                key={`guide-${cAge}`}
                x1={gx}
                y1={topH + 4}
                x2={gx}
                y2={vbH - 8}
                className={`dbx-mc-tl-guide ${isBadGuide ? "dbx-mc-tl-guide-bad" : ""}`}
              />
            );
          })}

          {/* Una fila por cada miembro del hogar */}
          {members.map((member, idx) => {
            const yBase = topH + idx * rowH;
            const trackY = yBase + 26;
            const isClient = idx === 0 || member.role === "client";
            const personMilestones = sortedMilestones.filter(
              (m) => m.personName.toLowerCase() === member.name.toLowerCase()
            );

            return (
              <g key={`${member.name}-${idx}`} className="dbx-mc-tl-row">
                {/* Nombre y edad actual a la izquierda */}
                <text
                  x={4}
                  y={trackY - 3}
                  textAnchor="start"
                  className="dbx-mc-tl-name"
                >
                  {member.name}
                </text>
                <text
                  x={4}
                  y={trackY + 11}
                  textAnchor="start"
                  className="dbx-mc-tl-age"
                >
                  {`Age ${member.age} now`}
                </text>

                {/* Pista horizontal del miembro */}
                {isClient && runOutX !== null ? (
                  <>
                    <line
                      x1={padL}
                      y1={trackY}
                      x2={runOutX}
                      y2={trackY}
                      className="dbx-mc-tl-track-ok"
                      strokeLinecap="round"
                    />
                    <line
                      x1={runOutX}
                      y1={trackY}
                      x2={padL + trackW}
                      y2={trackY}
                      className="dbx-mc-tl-track-bad"
                      strokeLinecap="round"
                    />
                  </>
                ) : (
                  <line
                    x1={padL}
                    y1={trackY}
                    x2={padL + trackW}
                    y2={trackY}
                    className="dbx-mc-tl-track"
                    strokeLinecap="round"
                  />
                )}

                {/* Punto de edad actual (Hoy) */}
                <circle
                  cx={padL}
                  cy={trackY}
                  r={4.5}
                  className="dbx-mc-tl-dot-now"
                >
                  <title>{`${member.name}: age ${member.age} today`}</title>
                </circle>

                {/* Marcadores de hitos de esta persona */}
                {personMilestones.map((ms, mIdx) => {
                  const mx = xForAge(ms.clientAge);
                  const isBad = Boolean(ms.bad);
                  // Alternamos arriba/abajo cuando hay varios hitos en la misma fila para evitar solapes.
                  const placeBelow = personMilestones.length > 1 && mIdx % 2 === 1;
                  const labelY = placeBelow ? trackY + 16 : trackY - 9;
                  const anchor: "start" | "middle" | "end" =
                    mx > vbW - 42 ? "end" : mx < padL + 28 ? "start" : "middle";

                  const shortTag =
                    ms.kind === "retire"
                      ? `Retire ${ms.badge.replace("Age ", "")}`
                      : ms.kind === "college"
                        ? `College ${ms.badge}`
                        : ms.kind === "home"
                          ? `Home ${ms.badge}`
                          : ms.kind === "runout"
                            ? `Out ${ms.badge.replace("Age ", "")}`
                            : `${ms.badge.replace("Age ", "")}`;

                  return (
                    <g key={`${ms.label}-${ms.clientAge}`}>
                      <title>{`${ms.label}: ${ms.badge}`}</title>
                      <circle
                        cx={mx}
                        cy={trackY}
                        r={isBad ? 6 : 5}
                        className={isBad ? "dbx-mc-tl-dot-bad" : "dbx-mc-tl-dot"}
                      />
                      <text
                        x={mx}
                        y={labelY}
                        textAnchor={anchor}
                        className={`dbx-mc-tl-tag ${
                          isBad
                            ? "dbx-mc-tl-tag-bad"
                            : ms.kind === "end"
                              ? "dbx-mc-tl-tag-muted"
                              : ""
                        }`}
                      >
                        {shortTag}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Leyenda de hitos debajo de la gráfica para lectura inmediata en móvil */}
      <div className="dbx-mc-tl-chips" aria-label="Timeline milestones">
        {sortedMilestones.map((ms) => (
          <span
            key={`${ms.label}-${ms.badge}`}
            className={`dbx-mc-tl-chip ${ms.bad ? "dbx-mc-tl-chip-bad" : ""}`}
          >
            {`${ms.label} · ${ms.badge}`}
          </span>
        ))}
      </div>
    </div>
  );
}

// Resumen narrativo y guía de lectura en inglés llano para FamilyTimeline.
export function familyTimelineStory(props: FamilyTimelineProps): ChartStory {
  const { members, startAge, endAge, milestones } = props;
  const runOut = milestones.find((m) => m.kind === "runout" || m.bad);
  const retirements = milestones.filter((m) => m.kind === "retire");
  const colleges = milestones.filter((m) => m.kind === "college");
  const home = milestones.find((m) => m.kind === "home");

  const takeaway = runOut
    ? `Your plan runs from age ${startAge} to ${endAge}, but liquid savings are projected to run out at ${runOut.badge.toLowerCase()}.`
    : `Your timeline tracks ${members.length} household ${
        members.length === 1 ? "member" : "members"
      } from age ${startAge} to ${endAge}, with savings lasting through the entire plan.`;

  const milestoneHighlights: string[] = [];
  if (home) milestoneHighlights.push(`a home purchase in ${home.badge}`);
  if (colleges.length > 0) {
    milestoneHighlights.push(
      colleges.map((c) => `${c.label.replace(" college", "")}'s college in ${c.badge}`).join(" and ")
    );
  }
  if (retirements.length > 0) {
    milestoneHighlights.push(
      retirements.map((r) => `${r.label} at ${r.badge.toLowerCase()}`).join(" and ")
    );
  }

  return {
    takeaway,
    more: [
      "Each horizontal row represents one person in your household, starting at their current age on the left and moving forward to the end of the plan on the right.",
      milestoneHighlights.length > 0
        ? `Key checkpoints along the way include ${milestoneHighlights.join(", ")}.`
        : "Dots along the tracks mark the key retirement and plan-end checkpoints recorded in your plan.",
      runOut
        ? `The red marker at ${runOut.badge.toLowerCase()} highlights the point where projected spending exhausts liquid savings before age ${endAge}.`
        : `Because there is no red depletion marker on the track, your projected savings hold up all the way to age ${endAge}.`,
    ],
  };
}

// ============================================================================
// 3. MonthlyDebt: "Where your monthly debt payments go"
// ============================================================================

export type MonthlyDebtItem = {
  name: string;
  monthly: number;
  rate: number;
  balance?: number;
};

export type MonthlyDebtProps = {
  rows: MonthlyDebtItem[];
  totalMonthly?: number | null;
};

// Construye las props de MonthlyDebt desde la Section "debt" (o null si no hay deudas).
export function buildMonthlyDebtProps(section: Section): MonthlyDebtProps | null {
  if (section.id !== "debt" || !section.table || section.table.rows.length === 0) {
    return null;
  }

  const cols = section.table.columns.map((c) => c.toLowerCase());
  const nameIdx = Math.max(0, cols.indexOf("debt"));
  const balIdx = cols.indexOf("balance");
  const rateIdx = cols.indexOf("rate");
  const monthlyIdx = cols.indexOf("monthly");

  if (monthlyIdx === -1 || rateIdx === -1) return null;

  const numFromCell = (
    cell: string | { kind: string; value: number } | undefined
  ): number => {
    if (typeof cell === "object" && cell !== null && typeof cell.value === "number") {
      return cell.value;
    }
    if (typeof cell === "string") {
      const parsed = Number(cell.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const rows: MonthlyDebtItem[] = [];
  for (const r of section.table.rows) {
    const rawName = r[nameIdx];
    const name =
      typeof rawName === "string" ? rawName : String(rawName?.value ?? "Debt");
    const monthly = numFromCell(r[monthlyIdx]);
    const rate = numFromCell(r[rateIdx]);
    const balance = balIdx >= 0 ? numFromCell(r[balIdx]) : undefined;
    if (monthly > 0) {
      rows.push({ name, monthly, rate, balance });
    }
  }

  if (rows.length === 0) return null;

  const totalStat = section.stats.find(
    (st) => st.label === "Monthly debt payments" && typeof st.value === "number"
  );
  const totalMonthly =
    totalStat && typeof totalStat.value === "number" ? totalStat.value : null;

  return { rows, totalMonthly };
}

// Barras horizontales con la cuota mensual de cada deuda y su APR (en --ember si APR >= 15 %).
export function MonthlyDebt({ rows, totalMonthly }: MonthlyDebtProps) {
  if (!rows || rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => b.monthly - a.monthly);
  const maxMonthly = Math.max(...sorted.map((r) => r.monthly), 1);

  const vbW = 340;
  const rowH = 46;
  const vbH = sorted.length * rowH;
  const trackX = 4;
  const rateColW = 66;
  const trackW = vbW - trackX - rateColW;

  const ariaDesc = sorted
    .map(
      (r) =>
        `${r.name}: ${formatStat("usd", r.monthly)} per month at ${formatStat("pct", r.rate)} APR`
    )
    .join("; ");

  return (
    <div className="dbx-mc-wrap dbx-mc-monthly-debt">
      <div className="dbx-mc-head">
        <p className="eyebrow">Where your monthly debt payments go</p>
        {typeof totalMonthly === "number" && totalMonthly > 0 && (
          <span className="dbx-mc-total">{`${formatStat("usd", totalMonthly)}/mo`}</span>
        )}
      </div>

      <div className="dbx-mc-chart-wrap">
        <svg
          className="dbx-mc-svg"
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Monthly debt payments: ${ariaDesc}.`}
        >
          {sorted.map((row, idx) => {
            const yBase = idx * rowH;
            const labelY = yBase + 15;
            const trackY = yBase + 23;
            const trackH = 10;
            const isHighApr = row.rate >= 0.15;
            const fillW = Math.max(6, (row.monthly / maxMonthly) * trackW);
            const rateText = `${formatStat("pct", row.rate)} APR`;

            return (
              <g key={`${row.name}-${idx}`} className="dbx-mc-debt-row">
                <title>
                  {`${row.name}: ${formatStat("usd", row.monthly)}/mo (${rateText})`}
                </title>

                <text
                  x={trackX}
                  y={labelY}
                  textAnchor="start"
                  className="dbx-mc-debt-name"
                >
                  {row.name}
                </text>

                <text
                  x={trackX + trackW}
                  y={labelY}
                  textAnchor="end"
                  className="dbx-mc-debt-amount"
                >
                  {`${formatStat("usd", row.monthly)}/mo`}
                </text>

                <rect
                  x={trackX}
                  y={trackY}
                  width={trackW}
                  height={trackH}
                  rx={5}
                  className="dbx-mc-debt-track"
                />

                <rect
                  x={trackX}
                  y={trackY}
                  width={fillW}
                  height={trackH}
                  rx={5}
                  className={`dbx-mc-debt-fill ${
                    isHighApr ? "dbx-mc-debt-fill-bad" : ""
                  }`}
                />

                <text
                  x={vbW - 4}
                  y={trackY + 8.5}
                  textAnchor="end"
                  className={`dbx-mc-debt-rate ${
                    isHighApr ? "dbx-mc-debt-rate-bad" : ""
                  }`}
                >
                  {rateText}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// Resumen narrativo y guía de lectura en inglés llano para MonthlyDebt.
export function monthlyDebtStory(props: MonthlyDebtProps): ChartStory {
  const { rows, totalMonthly } = props;
  if (!rows || rows.length === 0) {
    return {
      takeaway: "You have no monthly debt payments.",
      more: [
        "Each bar shows the monthly payment for a loan or credit card alongside its yearly interest rate (APR).",
        "Balances at 15% APR or above appear in red because interest eats up a large part of every payment.",
      ],
    };
  }

  const sortedByPayment = [...rows].sort((a, b) => b.monthly - a.monthly);
  const biggestPayment = sortedByPayment[0];
  const highApr = [...rows].sort((a, b) => b.rate - a.rate).find((r) => r.rate >= 0.15);
  const sumMonthly = rows.reduce((s, r) => s + r.monthly, 0);
  const totalDisplay = formatStat("usd", totalMonthly ?? sumMonthly);

  const takeaway = highApr
    ? `You pay ${totalDisplay} a month toward debt; ${biggestPayment.name} takes the largest payment (${formatStat("usd", biggestPayment.monthly)}/mo), while ${highApr.name} costs the most in interest at ${formatStat("pct", highApr.rate)} APR.`
    : `Your monthly debt payments total ${totalDisplay}, led by ${biggestPayment.name} at ${formatStat("usd", biggestPayment.monthly)} a month.`;

  return {
    takeaway,
    more: [
      "The length of each bar shows the monthly payment leaving your bank account, and the figure on the right shows that debt's interest rate (APR).",
      "Any debt charging 15% APR or more is marked in red because high interest slows down how fast your monthly payment reduces the balance.",
      "Looking at monthly cost next to APR helps you separate big, low-rate payments (like a mortgage) from smaller, expensive balances worth clearing first.",
    ],
  };
}

// ============================================================================
// 4. SwingRange: "How bumpy the last 3 years were"
// ============================================================================

export type SwingRangeProps = {
  /** Crecimiento medio anual de los últimos 3 años en tanto por uno (ej. 0.1167). */
  growth: number;
  /** Desviación típica anual ("Ups and downs per year") en tanto por uno (ej. 0.0748). */
  swing: number;
};

// Construye las props de SwingRange desde la Section "portfolio" (o null si faltan datos).
export function buildSwingRangeProps(section: Section): SwingRangeProps | null {
  if (section.id !== "portfolio") return null;

  const headline = section.headline;
  if (
    !headline ||
    typeof headline.label !== "string" ||
    !/growth/i.test(headline.label) ||
    typeof headline.value !== "number" ||
    !Number.isFinite(headline.value)
  ) {
    return null;
  }

  const swingStat = section.stats.find(
    (st) => st.label === "Ups and downs per year" && typeof st.value === "number"
  );
  if (
    !swingStat ||
    typeof swingStat.value !== "number" ||
    !Number.isFinite(swingStat.value) ||
    swingStat.value <= 0
  ) {
    return null;
  }

  return { growth: headline.value, swing: swingStat.value };
}

// Gráfico horizontal de la oscilación anual de los últimos 3 años: media (growth) y banda ±swing con 0% marcado.
export function SwingRange({ growth, swing }: SwingRangeProps) {
  if (
    typeof growth !== "number" ||
    !Number.isFinite(growth) ||
    typeof swing !== "number" ||
    !Number.isFinite(swing) ||
    swing <= 0
  ) {
    return null;
  }

  const growthPct = formatStat("pct", growth);
  const growthLabel = `${growth >= 0 ? "+" : ""}${growthPct} a year`;
  const swingPct = formatStat("pct", swing);
  const bandLabel = `ups and downs ±${swingPct}`;

  const bandStart = growth - swing;
  const bandEnd = growth + swing;

  const minVal = Math.min(0, bandStart);
  const maxVal = Math.max(0.12, bandEnd);

  // Escala visual con margen a izquierda y derecha
  const scaleMin = Math.min(-0.04, Math.floor((minVal - 0.02) * 20) / 20);
  const scaleMax = Math.max(0.2, Math.ceil((maxVal + 0.03) * 20) / 20);
  const scaleSpan = scaleMax - scaleMin;

  const vbW = 340;
  const vbH = 88;
  const padX = 14;
  const trackW = vbW - padX * 2;
  const trackY = 28;
  const trackH = 14;

  const xForVal = (v: number) => padX + ((v - scaleMin) / scaleSpan) * trackW;

  const zeroX = xForVal(0);
  const growthX = xForVal(growth);
  const bandX = xForVal(bandStart);
  const bandRightX = xForVal(bandEnd);
  const bandW = Math.max(12, bandRightX - bandX);

  return (
    <div className="dbx-mc-wrap dbx-mc-swing">
      <div className="dbx-mc-head">
        <p className="eyebrow">How bumpy the last 3 years were</p>
        <span className="dbx-mc-total">{growthLabel}</span>
      </div>

      <div className="dbx-mc-chart-wrap">
        <svg
          className="dbx-mc-svg"
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`How bumpy the last 3 years were: average yearly growth of ${growthLabel}, with ups and downs of ±${swingPct}.`}
        >
          {/* Marca del 0% y valor en la media */}
          <text
            x={zeroX}
            y={18}
            textAnchor="middle"
            className="dbx-mc-swing-zero-label"
          >
            0%
          </text>
          <text
            x={growthX}
            y={18}
            textAnchor="middle"
            className="dbx-mc-swing-val"
          >
            {growthLabel}
          </text>

          {/* Pista horizontal de fondo */}
          <rect
            x={padX}
            y={trackY}
            width={trackW}
            height={trackH}
            rx={trackH / 2}
            className="dbx-mc-swing-track"
          />

          {/* Banda de oscilación alrededor de la media (growth - swing a growth + swing) */}
          <rect
            x={bandX}
            y={trackY}
            width={bandW}
            height={trackH}
            rx={trackH / 2}
            className="dbx-mc-swing-band"
          />

          {/* Línea del 0% en el eje */}
          <line
            x1={zeroX}
            y1={trackY - 4}
            x2={zeroX}
            y2={trackY + trackH + 4}
            className={
              zeroX >= bandX && zeroX <= bandRightX
                ? "dbx-mc-swing-zero"
                : "dbx-mc-swing-zero-tick"
            }
          />

          {/* Marcas verticales en los bordes de la banda */}
          <line
            x1={bandX}
            y1={trackY - 2}
            x2={bandX}
            y2={trackY + trackH + 2}
            className="dbx-mc-swing-edge"
          />
          <line
            x1={bandRightX}
            y1={trackY - 2}
            x2={bandRightX}
            y2={trackY + trackH + 2}
            className="dbx-mc-swing-edge"
          />

          {/* Punto en la media (growth) */}
          <circle
            cx={growthX}
            cy={trackY + trackH / 2}
            r={5}
            className="dbx-mc-swing-dot"
          >
            <title>{`${growthLabel} · ${bandLabel}`}</title>
          </circle>

          {/* Corchete inferior que abarca la banda */}
          <path
            d={`M ${bandX} ${trackY + trackH + 6} L ${bandX} ${trackY + trackH + 12} L ${bandRightX} ${trackY + trackH + 12} L ${bandRightX} ${trackY + trackH + 6}`}
            className="dbx-mc-swing-bracket"
          />
          <text
            x={growthX}
            y={trackY + trackH + 28}
            textAnchor="middle"
            className="dbx-mc-swing-band-label"
          >
            {bandLabel}
          </text>
        </svg>
      </div>

      <p className="dbx-mc-caption">
        Last 3 years, as reported in your plan. Past results don&apos;t promise future ones.
      </p>
    </div>
  );
}

// Resumen narrativo y guía de lectura en inglés llano para SwingRange.
export function swingRangeStory(props: SwingRangeProps): ChartStory {
  const growthPct = formatStat("pct", props.growth);
  const swingPct = formatStat("pct", props.swing);
  return {
    takeaway: `Over the last 3 years your investments grew ${growthPct} a year on average, with ups and downs of about ${swingPct} a year.`,
    more: [
      "The dot marks the average yearly growth; the band shows how much results moved around it.",
      "These are past results from your plan, not a forecast.",
    ],
  };
}

// ============================================================================
// 5. AdvisorPriorities: "Your advisor's recommendations"
// ============================================================================

export type AdvisorPriorityItem = {
  title: string;
  detail?: string;
};

export type AdvisorPrioritiesProps = {
  items: AdvisorPriorityItem[];
};

// Divide una recomendación global en un titular en negrita y una línea de detalle opcional.
function splitRecommendationText(raw: string): AdvisorPriorityItem {
  const clean = raw.trim();
  // 1. Si trae guion largo o dos puntos ("Título — detalle" o "Título: detalle"), partimos ahí.
  for (const sep of [" — ", " – ", ": "]) {
    const idx = clean.indexOf(sep);
    if (idx > 0 && idx < clean.length - sep.length) {
      const head = clean.slice(0, idx).trim();
      const tail = clean.slice(idx + sep.length).trim();
      const capTail = tail.charAt(0).toUpperCase() + tail.slice(1);
      return { title: head, detail: capTail };
    }
  }

  // 2. Si tiene una cláusula explicativa tras coma (", since...", ", because...", ", and...", etc.),
  // dejamos la acción principal como título en negrita y la razón como detalle.
  const clauseMatch = clean.match(
    /^(.+?),\s+((?:starting with|since|because|and|so that|so|given that|especially|such as|which)\b.+)$/i
  );
  if (clauseMatch) {
    const head = clauseMatch[1].trim();
    const tail = clauseMatch[2].trim();
    const capTail = tail.charAt(0).toUpperCase() + tail.slice(1);
    return { title: head, detail: capTail };
  }

  return { title: clean };
}

// Construye las props de AdvisorPriorities desde Analysis (o null si no hay recomendaciones).
export function buildAdvisorPrioritiesProps(
  analysis: Analysis
): AdvisorPrioritiesProps | null {
  const rawList = analysis.recommendations;
  if (!rawList || rawList.length === 0) return null;

  const items = rawList
    .map((r) => (typeof r === "string" ? r.trim() : ""))
    .filter(Boolean)
    .map(splitRecommendationText);

  return items.length > 0 ? { items } : null;
}

// Lista numerada visual (1, 2, 3...) de las recomendaciones del asesor con línea vertical conectora.
export function AdvisorPriorities({ items }: AdvisorPrioritiesProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="dbx-mc-wrap dbx-mc-priorities">
      <div className="dbx-mc-head">
        <p className="eyebrow">Your advisor&apos;s recommendations</p>
        <span className="dbx-mc-total">{`${items.length} recommendations`}</span>
      </div>

      <ol className="dbx-mc-prio-list">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li
              key={`${idx}-${item.title.slice(0, 24)}`}
              className="dbx-mc-prio-item"
            >
              <div className="dbx-mc-prio-rail" aria-hidden="true">
                <span className="dbx-mc-prio-num">{idx + 1}</span>
                {!isLast && <span className="dbx-mc-prio-line" />}
              </div>

              <div className="dbx-mc-prio-body">
                <strong className="dbx-mc-prio-title">{item.title}</strong>
                {item.detail && <p className="dbx-mc-prio-detail">{item.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Resumen narrativo y guía de lectura en inglés llano para AdvisorPriorities.
export function advisorPrioritiesStory(props: AdvisorPrioritiesProps): ChartStory {
  const { items } = props;
  if (!items || items.length === 0) {
    return {
      takeaway: "Your plan has no extra recommendations right now.",
      more: [],
    };
  }

  return {
    takeaway: `Your plan lists ${items.length} recommendations for your household.`,
    more: [
      "They come straight from your Sherpas plan, in the order the plan lists them.",
      "Each bold line is the recommendation; the line below explains why it matters.",
      "On the next steps screen you pick the one to start with.",
    ],
  };
}
