import { useRef, type CSSProperties } from "react";
import { StatTile, SectionChart, SectionTable } from "../analysis/AnalysisBlocks";
import { LineChart, formatCompactUSD, type LineMarker } from "../charts/LineChart";
import {
  familyAge,
  formatStat,
  formatValue,
  peopleOf,
  revealContext,
  truthValue,
  type Probe,
} from "../data";
import type { PageProps } from "../formats/types";
import { ChartCard, ChartExpand } from "./ChartCard";
import {
  KeyInsight,
  pickKeyInsightProbe,
  GuessGap,
  ScoreGauge,
  PillarRadar,
  MovesWaterfall,
  TargetBars,
  Ring,
  MonthBoxes,
  VsBar,
  DebtBars,
  StackBar,
  BalanceBar,
  plainLabel,
  shortCapReason,
  type CapItem,
  type VsBarRow,
  type DebtBarRow,
} from "./charts";
import {
  PillarPoints,
  buildPillarPointsProps,
  pillarPointsStory,
  FamilyTimeline,
  buildFamilyTimelineProps,
  familyTimelineStory,
  MonthlyDebt,
  buildMonthlyDebtProps,
  monthlyDebtStory,
  SwingRange,
  buildSwingRangeProps,
  swingRangeStory,
  AdvisorPriorities,
  buildAdvisorPrioritiesProps,
  advisorPrioritiesStory,
} from "./moreCharts";
import { useFitToViewport } from "./useFitToViewport";
import "./dashboard.css";
import "./moreCharts.css";

// Reparte las 4 columnas de la rejilla de portada entre las tarjetas que existen en una fila.
// Con 3 tarjetas sobra una columna: se la queda la primera de `prefer` que esté. Devuelve las 4 celdas
// de grid-template-areas, o null si la fila queda vacía.
function coverAreaRow(ids: string[], prefer: string[]): string | null {
  if (ids.length === 0) return null;
  const base = Math.floor(4 / ids.length);
  const extra = 4 - base * ids.length;
  const wide = extra > 0 ? (prefer.find((id) => ids.includes(id)) ?? ids[0]) : null;
  return ids.flatMap((id) => Array<string>(base + (id === wide ? extra : 0)).fill(id)).join(" ");
}

// grid-template-areas de la portada en PC según las tarjetas que existan. En pareja la app oculta
// GuessGap con CSS, así que se calcula también esa variante (FamilyTimeline se queda 2 columnas).
function coverAreas(present: Record<string, boolean>, withGuess: boolean): string {
  const row1 = coverAreaRow(
    ["insight", "gauge", "radar", "points"].filter((id) => present[id]),
    ["radar", "gauge"]
  );
  const row2 = coverAreaRow(
    ["guess", "moves", "timeline", "prio"].filter((id) => present[id] && (withGuess || id !== "guess")),
    ["timeline", "moves"]
  );
  return ["head head head head", row1, row2]
    .filter((row): row is string => Boolean(row))
    .map((row) => `"${row}"`)
    .join(" ");
}

// Construye título, frase resumen (takeaway) y explicación (more) para la tarjeta KeyInsight.
function keyInsightCopy(
  probe: Probe,
  currentAge: number | null,
  scoreValue: number
): { title: string; takeaway: string; howToRead: string } {
  const t = probe.truth;

  if (probe.id === "ahorros") {
    const startAge = currentAge ?? 40;
    const runOutAge = t.age ?? startAge;
    const endAge = t.endOfPlanAge ?? 91;
    const gapYears = Math.max(0, endAge - runOutAge);
    return {
      title: `Your savings run out at ${runOutAge}`,
      takeaway: `Your plan runs until age ${endAge}, leaving a ${gapYears}-year gap uncovered.${
        scoreValue >= 70 ? " A high overall score doesn't mean your savings last." : ""
      }`,
      howToRead: `The horizontal timeline runs from your age today (${startAge}) to the end of your plan (${endAge}). The dark segment shows the years your projected savings cover, and the red segment after age ${runOutAge} marks the uncovered years where savings are depleted.`,
    };
  }

  if (probe.id === "destino") {
    const toRet = t.toRetirement ?? 0;
    const totalSaved = t.totalSaved ?? 0;
    const otherSaved = Math.max(0, totalSaved - toRet);
    return {
      title: `${formatStat("usd", toRet)} of your ${formatStat("usd", totalSaved)} yearly savings goes to retirement`,
      takeaway: `Out of ${formatStat("usd", totalSaved)} saved each year, ${formatStat("usd", otherSaved)} goes toward non-retirement goals.`,
      howToRead: `The full bar represents your total yearly savings (${formatStat("usd", totalSaved)}). The left slice marks how much is directed to retirement (${formatStat("usd", toRet)}), while the gray remainder (${formatStat("usd", otherSaved)}) goes to other accounts.`,
    };
  }

  if (probe.id === "tarjeta") {
    const payment = t.payment ?? 0;
    const principal = t.value ?? 0;
    const interest = t.interest ?? Math.max(0, payment - principal);
    const aprPct = Math.round((t.apr ?? 0) * 1000) / 10;
    const balance = t.balance ?? 0;
    return {
      title: `Of every ${formatStat("usd", payment)} card payment, only ${formatStat("usd", principal)} reduces your debt`,
      takeaway: `${formatStat("usd", interest)} of every payment goes straight to interest at ${aprPct}% APR on your ${formatStat("usd", balance)} balance.`,
      howToRead: `The bar splits a single ${formatStat("usd", payment)} credit card payment into two parts: the dark section on the left (${formatStat("usd", principal)}) lowers your balance, and the red section on the right (${formatStat("usd", interest)}) goes to interest charges.`,
    };
  }

  const val = truthValue(probe) ?? 0;
  return {
    title: `Your plan: ${formatValue(probe.input, val)}`,
    takeaway: revealContext(probe) || probe.question,
    howToRead:
      "This highlight surfaces the single most urgent gap between a healthy benchmark and what your financial plan currently shows.",
  };
}

// Vista de análisis para el formato Dashboard (adultos de 30 a 54 años), centrada en gráficas y texto mínimo.
export function DashboardFull({
  family,
  analysis,
  page,
  answers,
  Reveal,
}: PageProps): JSX.Element {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  // En PC escala la página para que quepa en la ventana sin scroll vertical; en móvil no hace nada.
  useFitToViewport(outer, inner, { deps: [family.id, page] });

  if (page.kind === "cover") {
    const s = analysis.score;
    // Acceso seguro a `caps` sin modificar el tipo global Analysis en src/data.ts.
    const caps = (s as { caps?: CapItem[] }).caps ?? [];
    const currentAge = familyAge(family);
    const keyProbe = pickKeyInsightProbe(family.probes);
    const insightMeta = keyProbe ? keyInsightCopy(keyProbe, currentAge, s.value) : null;

    const adultsNames =
      family.name || peopleOf(family).map((p) => p.name).join(" & ");
    const householdCount = family.household?.length ?? peopleOf(family).length;

    const comparableProbes = family.probes.filter((p) => truthValue(p) !== null);
    const closeCount = comparableProbes.filter((p) => {
      const plan = truthValue(p)!;
      const you = answers[p.id] ?? p.input.initial;
      const span = p.input.max - p.input.min || 1;
      return Math.abs(you - plan) <= 0.1 * span;
    }).length;

    const strongest =
      s.pillars.length > 0
        ? s.pillars.reduce((best, cur) => (cur.score > best.score ? cur : best), s.pillars[0])
        : null;
    const weakest =
      s.pillars.length > 0
        ? s.pillars.reduce((worst, cur) => (cur.score < worst.score ? cur : worst), s.pillars[0])
        : null;

    const maxIndivAfter =
      s.moves.length > 0 ? Math.max(...s.moves.map((m) => m.scoreAfter)) : s.value;

    const bestMove =
      s.moves.length > 0
        ? s.moves.reduce(
            (best, cur) =>
              cur.scoreAfter - cur.scoreBefore > best.scoreAfter - best.scoreBefore
                ? cur
                : best,
            s.moves[0]
          )
        : null;

    const unlockLine = s.combined
      ? `Together: ${s.value} → ${s.combined.scoreAfter}`
      : `Best single step: ${s.value} → ${maxIndivAfter}`;

    const guessTakeaway =
      closeCount === comparableProbes.length
        ? `You nailed all ${comparableProbes.length} estimates—your intuition matches your financial plan.`
        : closeCount === 0
          ? `All ${comparableProbes.length} of your guesses differed noticeably from what your plan actually shows.`
          : `You were close on ${closeCount} of ${comparableProbes.length} questions; the widest gaps show where your plan surprises you.`;

    const gaugeTakeaway = s.combined
      ? `Your score is ${s.value}/100 (${s.band}), and taking all recommended steps lifts it to ${s.combined.scoreAfter}.`
      : maxIndivAfter > s.value
        ? `Your score is ${s.value}/100 (${s.band}), and your best single step lifts it to ${maxIndivAfter}.`
        : `Your financial health score stands at ${s.value}/100 (${s.band}).`;

    const radarTakeaway =
      strongest && weakest
        ? `Your strongest area is ${plainLabel(strongest.name)} (${strongest.score}/100); ${plainLabel(weakest.name)} (${weakest.score}/100) is pulling your score down.`
        : "How your financial health breaks down across the five core areas.";

    const waterfallTakeaway =
      s.combined && bestMove
        ? `All steps together raise your score from ${s.value} to ${s.combined.scoreAfter}, led by ${plainLabel(bestMove.title).toLowerCase()} (+${bestMove.scoreAfter - bestMove.scoreBefore} pts).`
        : bestMove
          ? `${plainLabel(bestMove.title)} gives your score the biggest single lift (+${bestMove.scoreAfter - bestMove.scoreBefore} pts, to ${bestMove.scoreAfter}).`
          : "Points each recommended step adds to your current score.";

    const timelineProps = buildFamilyTimelineProps(family, analysis);
    const timelineStory = timelineProps ? familyTimelineStory(timelineProps) : null;

    const pillarPtsProps = buildPillarPointsProps(s);
    const pillarPtsStory = pillarPtsProps ? pillarPointsStory(pillarPtsProps) : null;

    const prioritiesProps = buildAdvisorPrioritiesProps(analysis);
    const prioritiesStory = prioritiesProps
      ? advisorPrioritiesStory(prioritiesProps)
      : null;

    // Plantillas de la rejilla de PC según las tarjetas presentes (la variante de pareja sin GuessGap
    // la elige el CSS con `.is-couple`, porque es la app quien oculta esa tarjeta).
    const present = {
      insight: Boolean(keyProbe && insightMeta),
      gauge: true,
      radar: true,
      points: Boolean(pillarPtsProps && pillarPtsStory),
      guess: true,
      moves: s.moves.length > 0,
      timeline: Boolean(timelineProps && timelineStory),
      prio: Boolean(prioritiesProps && prioritiesStory),
    };
    const coverStyle = {
      "--dbx-areas": coverAreas(present, true),
      "--dbx-areas-couple": coverAreas(present, false),
    } as CSSProperties;

    return (
      <div className="dbx-fit" ref={outer}>
        <div className="dbx-root dbx-cover" ref={inner} style={coverStyle}>
          {/* Cabecera de portada con nombres, título, frase guía, chips y resumen del asesor */}
          <header className="card dbx-head">
            <p className="eyebrow dbx-head-eyebrow">{adultsNames}</p>
            <h1 className="dbx-head-title">Your plan at a glance</h1>
            <p className="dbx-head-lede">
              Every chart comes with one line that sums it up. Tap + whenever you want the full story.
            </p>

            <div className="dbx-head-chips" aria-label="Plan highlights">
              <span className={`badge ${s.value < 40 ? "badge-outline" : "badge-soft"} dbx-head-chip`}>
                {`Score ${s.value}/100 · ${s.band}`}
              </span>
              <span className="badge badge-soft dbx-head-chip">
                {`${householdCount} in household`}
              </span>
              <span className="badge badge-soft dbx-head-chip">
                {`${closeCount} of ${comparableProbes.length} guesses close`}
              </span>
            </div>

            {analysis.summary && analysis.summary.length > 0 && (
              <ChartExpand label="Read your advisor's summary" className="dbx-head-summary">
                <div className="dbx-more-body">
                  {analysis.summary.map((paragraph, idx) => (
                    <p key={idx} className="dbx-more-text">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </ChartExpand>
            )}
          </header>

          {/* Tarjeta 0: "The one thing to know" con el giro principal del plan */}
          {keyProbe && insightMeta && (
            <ChartCard
              eyebrow="The one thing to know"
              title={insightMeta.title}
              takeaway={insightMeta.takeaway}
              tone="alert"
              className="dbx-insight-card dbx-a-insight"
              more={
                <div className="dbx-more-body">
                  <p className="dbx-more-text">{insightMeta.howToRead}</p>
                </div>
              }
            >
              <KeyInsight
                probe={keyProbe}
                currentAge={currentAge}
                scoreValue={s.value}
              />
            </ChartCard>
          )}

          {/* Tarjeta 1: Comparación entre lo que la familia cree y lo que dice su plan */}
          <ChartCard
            eyebrow="Your guesses vs your plan"
            title="How well do you know your plan?"
            badge={
              <span className="badge badge-soft dbx-guess-badge">
                {`${closeCount} of ${comparableProbes.length} close`}
              </span>
            }
            takeaway={guessTakeaway}
            className="dbx-guess-card dbx-a-guess"
            more={
              <div className="dbx-more-body">
                <p className="dbx-more-text">
                  Each horizontal track spans the full range of possible answers for that question.
                  The hollow dot marks your guess (You) and the solid dot marks the actual number
                  from your plan (Plan). A red line and dot mean the plan figure is a warning sign
                  worth addressing.
                </p>
              </div>
            }
          >
            <GuessGap probes={family.probes} answers={answers} />
          </ChartCard>

          {/* Línea temporal familiar con edades actuales e hitos del plan */}
          {timelineProps && timelineStory && (
            <ChartCard
              eyebrow="Your family's timeline"
              badge={
                <span className="dbx-mc-total">{`Age ${timelineProps.startAge} → ${timelineProps.endAge}`}</span>
              }
              takeaway={timelineStory.takeaway}
              className="dbx-card dbx-a-timeline"
              more={
                <div className="dbx-more-body">
                  {timelineStory.more.map((paragraph, idx) => (
                    <p key={idx} className="dbx-more-text">
                      {paragraph}
                    </p>
                  ))}
                </div>
              }
            >
              <FamilyTimeline {...timelineProps} />
            </ChartCard>
          )}

          {/* Cabecera principal con el arco semicircular de salud financiera */}
          <ChartCard
            eyebrow="Your financial health"
            badge={
              <span className={`badge ${s.value < 40 ? "badge-outline" : "badge-soft"}`}>
                {s.band}
              </span>
            }
            takeaway={gaugeTakeaway}
            tone={s.value < 40 ? "alert" : "default"}
            className="dbx-hero-card dbx-a-gauge"
            more={
              <div className="dbx-more-body">
                <p className="dbx-more-text">
                  The solid arc shows your current score from 0 to 100, while the dashed extension
                  shows how high your score can climb if you complete the suggested steps. Red tick
                  marks across the arc indicate score caps—issues that hold your total score below a
                  ceiling until fixed.
                </p>
                {s.message && <p className="dbx-more-text">{s.message}</p>}
              </div>
            }
          >
            <ScoreGauge
              value={s.value}
              band={s.band}
              potential={s.combined?.scoreAfter}
              caps={caps}
            />
          </ChartCard>

          {/* Rejilla de 2 columnas en contenedores amplios (>= 760px) para las tarjetas de análisis */}
          <div className="dbx-cover-grid">
            <ChartCard
              eyebrow="Score by area"
              takeaway={radarTakeaway}
              className="dbx-card dbx-a-radar"
              more={
                <div className="dbx-more-body">
                  <p className="dbx-more-text">
                    Each spoke of the pentagon represents one of the five pillars of your plan,
                    scaled from 0 at the center to 100 on the outer ring. A wider, balanced shape
                    means steadier coverage across every area, while red dots flag any pillar scoring
                    below 40.
                  </p>
                </div>
              }
            >
              <PillarRadar pillars={s.pillars} />
            </ChartCard>

            {pillarPtsProps && pillarPtsStory && (
              <ChartCard
                eyebrow="Where your points come from"
                takeaway={pillarPtsStory.takeaway}
                className="dbx-card dbx-a-points"
                more={
                  <div className="dbx-more-body">
                    {pillarPtsStory.more.map((paragraph, idx) => (
                      <p key={idx} className="dbx-more-text">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                }
              >
                <PillarPoints {...pillarPtsProps} />
              </ChartCard>
            )}

            {s.moves.length > 0 && (
              <ChartCard
                eyebrow="What moves your score"
                badge={<span className="dbx-wf-unlock">{unlockLine}</span>}
                takeaway={waterfallTakeaway}
                className="dbx-card dbx-a-moves"
                more={
                  <div className="dbx-more-body">
                    <p className="dbx-more-text">
                      {`The first bar on the left is your current score (${s.value}), and each middle bar shows how many points that single action adds on its own, with its effort level underneath.${
                        s.combined
                          ? ` The final bar on the right shows your combined score (${s.combined.scoreAfter}) when you complete all steps together.`
                          : " Steps are compared individually against your starting score rather than stacked."
                      }`}
                    </p>
                    <ol className="dbx-moves-list">
                      {s.moves.map((m) => {
                        const delta = m.scoreAfter - m.scoreBefore;
                        return (
                          <li key={m.title} className="dbx-move-item">
                            <div className="dbx-move-head">
                              <b className="dbx-move-title">{plainLabel(m.title)}</b>
                              <div className="dbx-move-badges">
                                <span className="badge badge-soft">{`${m.effort} effort`}</span>
                                <span className="badge badge-solid">
                                  {delta >= 0 ? `+${delta}` : delta}
                                </span>
                              </div>
                            </div>
                            <p className="dbx-move-action">{m.action}</p>
                          </li>
                        );
                      })}
                    </ol>
                    {s.combined && (
                      <p className="dbx-combined-note">{s.combined.note}</p>
                    )}
                  </div>
                }
              >
                {caps.length > 0 && (
                  <div className="dbx-cap-chips" aria-label="Score caps">
                    <span className="dbx-cap-label">Capped by</span>
                    {caps.map((c, idx) => (
                      <span
                        key={`${c.cappedAt}-${idx}`}
                        className="badge badge-outline dbx-cap-chip"
                        title={`${plainLabel(c.reason)} (cap ${c.cappedAt})`}
                      >
                        {`${shortCapReason(c.reason)} (${c.cappedAt})`}
                      </span>
                    ))}
                  </div>
                )}

                <MovesWaterfall
                  before={s.value}
                  moves={s.moves}
                  combined={s.combined}
                />
              </ChartCard>
            )}
          </div>

          {/* Prioridades ordenadas del asesor al cierre de la portada */}
          {prioritiesProps && prioritiesStory && (
            <ChartCard
              eyebrow="What your advisor would do first"
              badge={
                <span className="dbx-mc-total">{`${prioritiesProps.items.length} steps`}</span>
              }
              takeaway={prioritiesStory.takeaway}
              className="dbx-card dbx-a-prio"
              more={
                <div className="dbx-more-body">
                  {prioritiesStory.more.map((paragraph, idx) => (
                    <p key={idx} className="dbx-more-text">
                      {paragraph}
                    </p>
                  ))}
                </div>
              }
            >
              <AdvisorPriorities {...prioritiesProps} />
            </ChartCard>
          )}
        </div>
      </div>
    );
  }

  const { section, probes } = page;
  const consumedLabels = new Set<string>();

  const findNumericStat = (label: string): number | null => {
    const found = section.stats.find((st) => st.label === label);
    return found && typeof found.value === "number" ? found.value : null;
  };

  // Hitos de edad ordenados para la sección de jubilación (líneas verticales sin texto y leyenda en fila debajo).
  type RetirementMilestone = {
    age: number;
    label: string;
    bad?: boolean;
  };
  const retirementMilestones: RetirementMilestone[] = [];
  if (section.id === "retirement") {
    for (const st of section.stats) {
      if (st.kind === "age" && typeof st.value === "number") {
        if (st.label.endsWith("retires at")) {
          const person = st.label.slice(0, -"retires at".length).trim();
          retirementMilestones.push({ age: st.value, label: `${person} retires` });
        } else if (st.label === "Savings run out at") {
          retirementMilestones.push({
            age: st.value,
            label: "Savings run out",
            bad: true,
          });
        } else if (st.label === "Plan runs until") {
          retirementMilestones.push({ age: st.value, label: "Plan ends" });
        }
      }
    }
    retirementMilestones.sort((a, b) => a.age - b.age);
  }
  const retirementMarkers: LineMarker[] = retirementMilestones.map((m) => ({
    x: m.age,
    label: "",
  }));

  // Datos específicos para cada sección visual
  const shareSavedVal =
    section.id === "savings" ? findNumericStat("Share of income saved") : null;
  if (shareSavedVal !== null) consumedLabels.add("Share of income saved");

  const debtVsIncomeVal =
    section.id === "debt" ? findNumericStat("Debt payments vs income") : null;
  if (debtVsIncomeVal !== null) consumedLabels.add("Debt payments vs income");

  const wealthAssets =
    section.id === "wealth" ? findNumericStat("Total assets") : null;
  const wealthDebts =
    section.id === "wealth" ? findNumericStat("Total debts") : null;
  if (wealthAssets !== null && wealthDebts !== null) {
    consumedLabels.add("Total assets");
    consumedLabels.add("Total debts");
  }
  if (section.id === "wealth") {
    for (const st of section.stats) {
      if (st.label.startsWith("Biggest asset")) {
        consumedLabels.add(st.label);
      }
    }
  }
  // En cartera, "Stocks today" y "Stocks in target mix" ya salen en la leyenda Today → Target.
  const stocksTodayVal =
    section.id === "portfolio" ? findNumericStat("Stocks today") : null;
  const stocksTargetVal =
    section.id === "portfolio" ? findNumericStat("Stocks in target mix") : null;
  if (section.id === "portfolio") {
    consumedLabels.add("Stocks today");
    consumedLabels.add("Stocks in target mix");
  }

  // Emparejamiento de coberturas para VsBar en protection
  const protectionRows: VsBarRow[] = [];
  if (section.id === "protection") {
    const pairs: [string, string][] = [
      ["Life insurance (you)", "Recommended minimum (you)"],
      ["Life insurance (partner)", "Recommended minimum (partner)"],
      ["Umbrella policy", "Umbrella recommended"],
    ];
    for (const [haveLbl, recLbl] of pairs) {
      const haveVal = findNumericStat(haveLbl);
      const recVal = findNumericStat(recLbl);
      if (haveVal !== null && recVal !== null) {
        protectionRows.push({ label: haveLbl, have: haveVal, recommended: recVal });
        consumedLabels.add(haveLbl);
        consumedLabels.add(recLbl);
      }
    }
  }

  // Filas de deuda para DebtBars a partir de section.table
  const debtRows: DebtBarRow[] = [];
  if (section.id === "debt" && section.table) {
    for (const r of section.table.rows) {
      const name = typeof r[0] === "string" ? r[0] : String(r[0]?.value ?? "");
      const balCell = r[1];
      const rateCell = r[2];
      const balance =
        typeof balCell === "object" && balCell !== null ? Number(balCell.value) : 0;
      const rate =
        typeof rateCell === "object" && rateCell !== null ? Number(rateCell.value) : 0;
      debtRows.push({ name, balance, rate });
    }
  }

  // KPIs restantes (excluyendo los stats ya convertidos en gráfica)
  const remainingStats = section.stats.filter((st) => !consumedLabels.has(st.label));

  // Cifras clave de la línea de patrimonio (hoy, máximo y final), leídas tal cual de los
  // puntos de la serie: la gráfica no tiene eje vertical con cifras y así se sabe cuánto es.
  const nwPoints = section.chart && section.chart.kind === "line" ? section.chart.points : [];
  const nwFigures =
    nwPoints.length > 0
      ? (() => {
          const first = nwPoints[0];
          const last = nwPoints[nwPoints.length - 1];
          const peak = nwPoints.reduce((m, p) => (p[1] > m[1] ? p : m), first);
          return [
            { label: `Today · age ${first[0]}`, value: first[1], bad: false },
            { label: `Peak · age ${peak[0]}`, value: peak[1], bad: false },
            { label: `At age ${last[0]}`, value: last[1], bad: last[1] < 0 },
          ];
        })()
      : [];

  // Configuración del ChartCard principal de cada sección (eyebrow, takeaway, tone y explicación de lectura)
  const sectionCardMeta = ((): {
    eyebrow: string;
    takeaway: string;
    howToRead: string;
    tone: "default" | "alert";
  } => {
    switch (section.id) {
      case "retirement": {
        const markAge = section.chart?.kind === "line" ? section.chart.markAge : null;
        const pctHeadline =
          section.headline && section.headline.kind === "pct"
            ? Number(section.headline.value)
            : null;
        const isAlert = markAge !== null || (pctHeadline !== null && pctHeadline < 0.5);
        const takeaway =
          markAge !== null
            ? `Your savings are projected to run out at age ${markAge}${
                pctHeadline !== null
                  ? `, covering ${formatStat("pct", pctHeadline)} of your retirement spending need`
                  : ""
              }.`
            : nwFigures.length === 3
              ? `Your projected net worth moves from ${formatCompactUSD(nwFigures[0].value)} today to ${formatCompactUSD(nwFigures[2].value)} at the end of your plan${
                  pctHeadline !== null
                    ? ` (${formatStat("pct", pctHeadline)} of retirement spending covered)`
                    : ""
                }.`
              : "Projected net worth across your retirement timeline.";
        return {
          eyebrow: "Retirement readiness",
          takeaway,
          howToRead:
            "The ring at the top shows the share of your retirement spending covered by your plan. Below it, the line tracks your projected net worth by age from today through the end of the plan, with summary figures for today, your peak, and the final year. Vertical dashed lines and badges below mark retirement ages and any point where savings run out (in red).",
          tone: isAlert ? "alert" : "default",
        };
      }

      case "wealth": {
        const nwVal = Number(section.headline?.value ?? 0);
        const topSegment =
          section.chart?.kind === "bars" && section.chart.items.length > 0
            ? [...section.chart.items].sort((a, b) => b.value - a.value)[0]
            : null;
        return {
          eyebrow: "Net worth & asset mix",
          takeaway: `Your net worth is ${formatStat("usd", nwVal)} (${formatStat("usd", wealthAssets ?? 0)} in assets minus ${formatStat("usd", wealthDebts ?? 0)} in debts)${
            topSegment ? `, led by ${plainLabel(topSegment.label).toLowerCase()}` : ""
          }.`,
          howToRead:
            "The top bars compare everything you own (Total assets, in dark ink) against everything you owe (Total debts, in gray) to arrive at your net worth. The stacked bar below breaks down 100% of your assets from largest to smallest category so you can see how your wealth is divided.",
          tone: nwVal < 0 ? "alert" : "default",
        };
      }

      case "debt": {
        const sortedDebts = [...debtRows].sort((a, b) => b.balance - a.balance);
        const largestDebt = sortedDebts[0] ?? null;
        const highRateDebt = sortedDebts.find((r) => r.rate >= 0.15) ?? null;
        const isAlert =
          (debtVsIncomeVal !== null && debtVsIncomeVal >= 0.36) || Boolean(highRateDebt);
        const takeaway =
          debtRows.length > 0 && largestDebt
            ? `You carry ${
                section.headline
                  ? formatStat(section.headline.kind, section.headline.value)
                  : formatStat("usd", largestDebt.balance)
              } in total debt${
                debtVsIncomeVal !== null
                  ? ` (${formatStat("pct", debtVsIncomeVal)} of income goes to payments)`
                  : ""
              }${
                highRateDebt
                  ? `, including ${highRateDebt.name} at ${formatStat("pct", highRateDebt.rate)} APR`
                  : `, with ${largestDebt.name} as your largest balance`
              }.`
            : "You carry no debt balances and have zero monthly payments.";
        return {
          eyebrow: "Debt & monthly burden",
          takeaway,
          howToRead:
            "The ring shows the share of your gross income used for monthly debt payments (36% or higher is flagged in red). Below, each horizontal bar is sized to that loan's balance from largest to smallest, with its interest rate (APR) on the right—any rate of 15% or higher is highlighted in red.",
          tone: isAlert ? "alert" : "default",
        };
      }

      case "savings": {
        const takeaway =
          section.headline && shareSavedVal !== null
            ? `You save ${formatStat(section.headline.kind, section.headline.value)} a year (${formatStat("pct", shareSavedVal)} of your income) across your accounts.`
            : section.headline
              ? `You save ${formatStat(section.headline.kind, section.headline.value)} a year toward your future goals.`
              : "Where each dollar of your yearly income goes.";
        return {
          eyebrow: "Annual savings & cash flow",
          takeaway,
          howToRead:
            "The headline and ring show how much you save each year in dollars and as a share of your income. The horizontal bars below show where your yearly income goes across spending, taxes, and savings; vertical tick marks indicate the target level for each category.",
          tone: "default",
        };
      }

      case "protection": {
        const monthsVal =
          section.headline && section.headline.kind === "months"
            ? Number(section.headline.value)
            : null;
        const shortfalls = protectionRows.filter((r) => r.have < r.recommended);
        const isAlert = (monthsVal !== null && monthsVal < 4) || shortfalls.length > 0;
        const takeaway =
          monthsVal !== null
            ? `Your emergency cash covers ${formatStat("months", monthsVal)}, and ${
                shortfalls.length > 0
                  ? `${shortfalls.length} of ${protectionRows.length} insurance policies fall short of recommended minimums`
                  : "your insurance policies meet recommended minimums"
              }.`
            : "Current protection versus recommended minimums; shortfalls are shown in red.";
        return {
          eyebrow: "Emergency cash & insurance",
          takeaway,
          howToRead:
            "Each of the 12 boxes at the top represents one month of living expenses covered by your emergency cash (fewer than 4 months is shown in red). In the bars below, the solid fill shows the insurance coverage you have today while the vertical line marks the recommended minimum—any shortfall is highlighted in red.",
          tone: isAlert ? "alert" : "default",
        };
      }

      case "portfolio": {
        const takeaway =
          stocksTodayVal !== null && stocksTargetVal !== null
            ? `Across all your money (cash included), ${formatStat("pct", stocksTodayVal)} is in stocks today versus your ${formatStat("pct", stocksTargetVal)} target mix.`
            : "Today's split of all your money versus your target mix.";
        return {
          eyebrow: "Investment mix",
          takeaway,
          howToRead:
            "The top stacked bar (Today) shows how 100% of your money—including cash—is currently divided across asset classes, while the bottom bar (Target) shows the mix recommended for your plan. In the legend below, each category lists your current percentage followed by an arrow to its target percentage.",
          tone: "default",
        };
      }

      default:
        return {
          eyebrow: section.chart?.title ?? section.title,
          takeaway:
            section.observations[0] ?? `Key figures for ${section.title.toLowerCase()}.`,
          howToRead:
            "This chart summarizes the main figures and benchmarks from your financial plan for this section.",
          tone: "default",
        };
    }
  })();

  return (
    <div className="dbx-fit" ref={outer}>
      <div className="dbx-root dbx-section" ref={inner}>
        {/* 1. Título de sección (en PC lleva a la derecha la cifra principal) */}
        <div className="dbx-section-header">
          <h1 className="a-title">{section.title}</h1>
          {section.headline && (
            <div className="dbx-section-fig">
              <span className="eyebrow">{plainLabel(section.headline.label)}</span>
              <span className="stat-value">
                {formatStat(section.headline.kind, section.headline.value)}
              </span>
            </div>
          )}
        </div>

        {/* 2. Gráfica principal de la sección con ChartCard (incluye explicación + observaciones/recomendaciones) */}
        <ChartCard
          eyebrow={sectionCardMeta.eyebrow}
          takeaway={sectionCardMeta.takeaway}
          tone={sectionCardMeta.tone}
          className="dbx-chart-card dbx-main-card"
          more={
            <div className="dbx-more-body">
              <p className="dbx-more-text">{sectionCardMeta.howToRead}</p>

              {section.id === "debt" && section.table && (
                <div className="dbx-table-wrap">
                  <SectionTable table={section.table} />
                </div>
              )}

              {section.observations.length > 0 && (
                <div className="dbx-more-block">
                  <p className="eyebrow">Key observations</p>
                  <ul className="dbx-recs-list">
                    {section.observations.map((obs, idx) => (
                      <li key={idx} className="dbx-rec-item">
                        {obs}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {section.lookInto && (
                <div className="dbx-more-block">
                  <p className="eyebrow">Worth looking into</p>
                  <p className="dbx-look-text">{section.lookInto}</p>
                </div>
              )}

              {section.recommendations && section.recommendations.length > 0 && (
                <div className="dbx-more-block">
                  <p className="eyebrow">Recommendations</p>
                  <ul className="dbx-recs-list">
                    {section.recommendations.map((rec, idx) => (
                      <li key={idx} className="dbx-rec-item">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          }
        >
          {/* RETIREMENT: Ring de cobertura de ingresos + LineChart con hitos */}
          {section.id === "retirement" && (
            <div className="dbx-main-visual">
              {section.headline && section.headline.kind === "pct" && (
                <Ring
                  value={Number(section.headline.value)}
                  label={section.headline.label}
                  bad={Number(section.headline.value) < 0.5}
                />
              )}
              {section.chart && section.chart.kind === "line" && (
                <div className="a-chart">
                  <p className="eyebrow">{section.chart.title}</p>
                  {nwFigures.length > 0 && (
                    <div className="dbx-nw-figures">
                      {nwFigures.map((f) => (
                        <div key={f.label} className="dbx-nw-fig">
                          <span className="dbx-nw-label">{f.label}</span>
                          <span className={`dbx-nw-value${f.bad ? " dbx-nw-bad" : ""}`}>
                            {formatCompactUSD(f.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <LineChart
                    points={section.chart.points.map(([x, y]) => ({ x, y }))}
                    tone={section.chart.markAge !== null ? "bad" : "neutral"}
                    formatX={(v) => `Age ${Math.round(v)}`}
                    formatY={formatCompactUSD}
                    markers={retirementMarkers}
                  />
                  {retirementMilestones.length > 0 && (
                    <div className="dbx-milestone-legend" aria-label="Retirement milestones">
                      {retirementMilestones.map((m) => (
                        <span
                          key={`${m.label}-${m.age}`}
                          className={`badge ${
                            m.bad ? "badge-outline dbx-milestone-bad" : "badge-soft"
                          } dbx-milestone-chip`}
                        >
                          {`${m.label} · ${m.age}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WEALTH: BalanceBar (Net worth + Assets vs Debts) + StackBar 100% */}
          {section.id === "wealth" && (
            <div className="dbx-main-visual">
              <BalanceBar
                netWorth={Number(section.headline?.value ?? 0)}
                assets={wealthAssets ?? 0}
                debts={wealthDebts ?? 0}
                headlineLabel={section.headline?.label ?? "Net worth"}
              />
              {section.chart && section.chart.kind === "bars" && (
                <div className="a-chart">
                  <p className="eyebrow">{section.chart.title}</p>
                  <StackBar
                    segments={[...section.chart.items].sort((a, b) => b.value - a.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* DEBT: Headline + Ring de pagos vs ingresos + DebtBars */}
          {section.id === "debt" && (
            <div className="dbx-main-visual">
              <div className="dbx-split-hero">
                {section.headline && (
                  <div className="dbx-headline-compact">
                    <p className="eyebrow">{plainLabel(section.headline.label)}</p>
                    <p className="stat-value dbx-headline-value">
                      {formatStat(section.headline.kind, section.headline.value)}
                    </p>
                  </div>
                )}
                {debtVsIncomeVal !== null && (
                  <Ring
                    value={debtVsIncomeVal}
                    label="Debt payments vs income"
                    bad={debtVsIncomeVal >= 0.36}
                  />
                )}
              </div>
              {debtRows.length > 0 && (
                <div className="a-chart">
                  <p className="eyebrow">Balances by size</p>
                  <DebtBars rows={debtRows} />
                </div>
              )}
            </div>
          )}

          {/* SAVINGS: Headline + Ring de porcentaje ahorrado + TargetBars */}
          {section.id === "savings" && (
            <div className="dbx-main-visual">
              <div className="dbx-split-hero">
                {section.headline && (
                  <div className="dbx-headline-compact">
                    <p className="eyebrow">{plainLabel(section.headline.label)}</p>
                    <p className="stat-value dbx-headline-value">
                      {formatStat(section.headline.kind, section.headline.value)}
                    </p>
                  </div>
                )}
                {shareSavedVal !== null && (
                  <Ring value={shareSavedVal} label="Share of income saved" />
                )}
              </div>
              {section.chart && section.chart.kind === "bars" && (
                <div className="a-chart">
                  <p className="eyebrow">{section.chart.title}</p>
                  <TargetBars items={section.chart.items} ratio={section.chart.ratio} />
                </div>
              )}
            </div>
          )}

          {/* PROTECTION: MonthBoxes (12 casillas) + VsBar (have vs recommended) */}
          {section.id === "protection" && (
            <div className="dbx-main-visual">
              {section.headline && section.headline.kind === "months" && (
                <MonthBoxes
                  months={Number(section.headline.value)}
                  label={section.headline.label}
                />
              )}
              {protectionRows.length > 0 && (
                <div className="a-chart">
                  <p className="eyebrow">Coverage vs recommended minimum</p>
                  <VsBar rows={protectionRows} />
                </div>
              )}
            </div>
          )}

          {/* PORTFOLIO: Crecimiento anual como StatTile normal + dos StackBar (Today y Target) con leyenda compartida */}
          {section.id === "portfolio" && (
            <div className="dbx-main-visual">
              {section.headline && (
                <div className="dbx-headline-tile">
                  <StatTile
                    stat={{ ...section.headline, label: plainLabel(section.headline.label) }}
                  />
                </div>
              )}
              {section.chart && section.chart.kind === "bars" && (
                <div className="a-chart dbx-portfolio-stacks">
                  {/* Esta barra reparte TODO el dinero (efectivo incluido). La sonda "mezcla" mide otra
                      cosa (el primer grupo de objetivos), así que lo decimos para que no parezca una contradicción. */}
                  <p className="eyebrow">All your money, cash included</p>
                  <StackBar
                    rowLabel="Today"
                    segments={section.chart.items.map((i) => ({
                      label: i.label,
                      value: i.value,
                    }))}
                    showLegend={false}
                  />
                  <StackBar
                    rowLabel="Target"
                    segments={section.chart.items.map((i) => ({
                      label: i.label,
                      value: i.target ?? 0,
                    }))}
                    compareSegments={section.chart.items.map((i) => ({
                      label: i.label,
                      value: i.value,
                    }))}
                    showLegend={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Fallback por si alguna sección futura tuviera otro id */}
          {!["retirement", "wealth", "debt", "savings", "protection", "portfolio"].includes(
            section.id
          ) &&
            section.chart && <SectionChart chart={section.chart} />}
        </ChartCard>

        {/* Columna derecha en PC (stats, tarjeta secundaria y reveals); en móvil es transparente */}
        <div className="dbx-side">
          {/* Gráfica adicional en debt: reparto de pagos mensuales y APR por deuda */}
          {(() => {
            const monthlyDebtProps =
              section.id === "debt" ? buildMonthlyDebtProps(section) : null;
            if (!monthlyDebtProps) return null;
            const story = monthlyDebtStory(monthlyDebtProps);
            return (
              <ChartCard
                eyebrow="Where your monthly debt payments go"
                badge={
                  typeof monthlyDebtProps.totalMonthly === "number" &&
                  monthlyDebtProps.totalMonthly > 0 ? (
                    <span className="dbx-mc-total">{`${formatStat("usd", monthlyDebtProps.totalMonthly)}/mo`}</span>
                  ) : undefined
                }
                takeaway={story.takeaway}
                className="dbx-chart-card dbx-side-card"
                more={
                  <div className="dbx-more-body">
                    {story.more.map((paragraph, idx) => (
                      <p key={idx} className="dbx-more-text">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                }
              >
                <MonthlyDebt {...monthlyDebtProps} />
              </ChartCard>
            );
          })()}

          {/* Gráfica adicional en portfolio: rango de oscilación anual típica (-X% a +X%) */}
          {(() => {
            const swingProps =
              section.id === "portfolio" ? buildSwingRangeProps(section) : null;
            if (!swingProps) return null;
            const story = swingRangeStory(swingProps);
            const pct = formatStat("pct", swingProps.swing);
            return (
              <ChartCard
                eyebrow="How much your investments can move in a year"
                badge={<span className="dbx-mc-total">{`-${pct} to +${pct}`}</span>}
                takeaway={story.takeaway}
                className="dbx-chart-card dbx-side-card"
                more={
                  <div className="dbx-more-body">
                    {story.more.map((paragraph, idx) => (
                      <p key={idx} className="dbx-more-text">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                }
              >
                <SwingRange {...swingProps} />
              </ChartCard>
            );
          })()}

          {/* 3. Reveals de sondas respondidas por la familia */}
          {probes.length > 0 && (
            <section className="card a-probes dbx-probes">
              {probes.map((p, i) => (
                <Reveal
                  key={p.id}
                  family={family}
                  probe={p}
                  answer={answers[p.id] ?? p.input.initial}
                  index={i}
                  total={probes.length}
                  animate={true}
                />
              ))}
            </section>
          )}

          {/* 4. KPIs restantes en rejilla compacta */}
          {remainingStats.length > 0 && (
            <section className="card dbx-kpi-card">
              <div className="dbx-stats-grid">
                {remainingStats.map((st) => (
                  <StatTile key={st.label} stat={{ ...st, label: plainLabel(st.label) }} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
