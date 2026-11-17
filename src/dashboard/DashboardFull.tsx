import { useEffect, useRef, useState, type ReactNode } from "react";
import { StatTile, SectionChart, SectionTable } from "../analysis/AnalysisBlocks";
import { useCouple } from "../analysis/CoupleReveal";
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
import { WidgetCard } from "./ChartCard";
import { CountUp } from "./CountUp";
import { WidgetDetailModal } from "./WidgetDetailModal";
import {
  KeyInsight,
  pickKeyInsightProbe,
  GuessGap,
  ScoreGauge,
  ScoreGaugeMini,
  PillarRadar,
  MovesWaterfall,
  plainLabel,
  shortCapReason,
  shortProbeLabel,
  type CapItem,
  type VsBarRow,
  type DebtBarRow,
} from "./charts";
import {
  BarRows,
  GuessList,
  GuessTrack,
  MiniBar,
  MonthGrid,
  MovesMini,
  PillarBars,
  RingStat,
  plainMove,
} from "./widgets";
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

// Construye título, frase resumen y explicación para el widget KeyInsight.
function keyInsightCopy(
  probe: Probe,
  currentAge: number | null,
  scoreValue: number
): { title: string; support: string; howToRead: string } {
  const t = probe.truth;

  if (probe.id === "ahorros") {
    const startAge = currentAge ?? 40;
    const runOutAge = t.age ?? startAge;
    const endAge = t.endOfPlanAge ?? 91;
    const gapYears = Math.max(0, endAge - runOutAge);
    return {
      title: `Your savings run out at ${runOutAge}`,
      support:
        scoreValue >= 70
          ? "A high score doesn't mean your savings last."
          : `Leaves a ${gapYears}-year gap before age ${endAge}.`,
      howToRead: `The horizontal timeline runs from your age today (${startAge}) to the end of your plan (${endAge}). The dark segment shows the years your projected savings cover, and the red segment after age ${runOutAge} marks the uncovered years where savings are depleted.`,
    };
  }

  if (probe.id === "destino") {
    const toRet = t.toRetirement ?? 0;
    const totalSaved = t.totalSaved ?? 0;
    const otherSaved = Math.max(0, totalSaved - toRet);
    return {
      title: `${formatStat("usd", toRet)} of ${formatStat("usd", totalSaved)} yearly savings goes to retirement`,
      support: `${formatStat("usd", otherSaved)} goes to non-retirement goals each year.`,
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
      title: `Of every ${formatStat("usd", payment)} card payment, only ${formatStat("usd", principal)} reduces debt`,
      support: `${formatStat("usd", interest)} goes to interest (${aprPct}% APR on ${formatStat("usd", balance)}).`,
      howToRead: `The bar splits a single ${formatStat("usd", payment)} credit card payment into two parts: the dark section on the left (${formatStat("usd", principal)}) lowers your balance, and the red section on the right (${formatStat("usd", interest)}) goes to interest charges.`,
    };
  }

  const val = truthValue(probe) ?? 0;
  return {
    title: `Your plan: ${formatValue(probe.input, val)}`,
    support: revealContext(probe) || probe.question,
    howToRead:
      "This highlight surfaces the single most urgent gap between a healthy benchmark and what your financial plan currently shows.",
  };
}

type DetailState = {
  id: string;
  triggerEl: HTMLElement | null;
} | null;

// Vista de análisis estilo pantalla de widgets iOS: máximo 4 widgets visibles por página y detalle en modal/hoja inferior.
export function DashboardFull({
  family,
  analysis,
  page,
  answers,
  Reveal,
}: PageProps): JSX.Element {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const couple = useCouple();
  const [detail, setDetail] = useState<DetailState>(null);

  const pageKey = page.kind === "cover" ? "cover" : page.section.id;
  useEffect(() => {
    setDetail(null);
  }, [family.id, pageKey]);

  // En PC ajusta la escala si hace falta para evitar scroll vertical; en móvil no hace nada.
  useFitToViewport(outer, inner, { deps: [family.id, pageKey] });

  const openDetail = (id: string, triggerEl: HTMLElement | null) => {
    setDetail({ id, triggerEl });
  };
  const closeDetail = () => setDetail(null);

  if (page.kind === "cover") {
    const s = analysis.score;
    const caps = (s as { caps?: CapItem[] }).caps ?? [];
    const currentAge = familyAge(family);
    const keyProbe = pickKeyInsightProbe(family.probes);
    const insightMeta = keyProbe ? keyInsightCopy(keyProbe, currentAge, s.value) : null;

    const adultsNames =
      family.name || peopleOf(family).map((p) => p.name).join(" & ");
    const hasAnswers = Object.keys(answers).length > 0;

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

    // Titular del widget de pasos: todos juntos si el plan lo da; si no, el mejor paso suelto.
    const moveTarget = s.combined ? s.combined.scoreAfter : maxIndivAfter;
    const capNames = caps.map((c) => shortCapReason(c.reason).toLowerCase()).join(" and ");

    const unlockLine = s.combined
      ? `Together: ${s.value} → ${s.combined.scoreAfter}`
      : `Best step: ${s.value} → ${maxIndivAfter}`;

    const timelineProps = buildFamilyTimelineProps(family, analysis);
    const timelineStory = timelineProps ? familyTimelineStory(timelineProps) : null;

    const pillarPtsProps = buildPillarPointsProps(s);
    const pillarPtsStory = pillarPtsProps ? pillarPointsStory(pillarPtsProps) : null;

    const prioritiesProps = buildAdvisorPrioritiesProps(analysis);
    const prioritiesStory = prioritiesProps ? advisorPrioritiesStory(prioritiesProps) : null;

    const handlePickFirstStep = () => {
      window.dispatchEvent(new CustomEvent("samepage:next-steps"));
    };

    const modalMeta = (() => {
      if (!detail) return null;
      switch (detail.id) {
        case "insight":
          return {
            eyebrow: "The one thing to know",
            title: insightMeta?.title ?? "Your plan at a glance",
            tone: keyProbe ? ("alert" as const) : ("default" as const),
            body: (
              <div className="dbx-detail-stack">
                {keyProbe && insightMeta && (
                  <section className="dbx-detail-card">
                    <KeyInsight
                      probe={keyProbe}
                      currentAge={currentAge}
                      scoreValue={s.value}
                      hideHeader
                    />
                    <p className="dbx-detail-text">{insightMeta.howToRead}</p>
                  </section>
                )}

                {timelineProps && timelineStory && (
                  <section className="dbx-detail-card">
                    <FamilyTimeline {...timelineProps} />
                    <p className="dbx-detail-lead">{timelineStory.takeaway}</p>
                    {timelineStory.more.map((paragraph, idx) => (
                      <p key={idx} className="dbx-detail-text">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                )}

                {analysis.summary && analysis.summary.length > 0 && (
                  <section className="dbx-detail-card">
                    <p className="dbx-eyebrow">Your advisor&apos;s summary</p>
                    {analysis.summary.map((paragraph, idx) => (
                      <p key={idx} className="dbx-detail-text">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                )}
              </div>
            ),
          };

        case "gauge":
        case "radar":
          return {
            eyebrow: detail.id === "radar" ? "Score by area" : "Your financial health",
            title: `${s.value} / 100 · ${s.band}`,
            tone: s.value < 40 ? ("alert" as const) : ("default" as const),
            body: (
              <div className="dbx-detail-stack">
                <section className="dbx-detail-card">
                  <ScoreGauge
                    value={s.value}
                    band={s.band}
                    potential={s.combined?.scoreAfter}
                    caps={caps}
                  />
                  {s.message && <p className="dbx-detail-lead">{s.message}</p>}
                  <p className="dbx-detail-text">
                    The solid arc shows your current score from 0 to 100, while the dashed extension
                    shows how high your score can climb if you complete the suggested steps. Red
                    tick marks indicate score caps—issues holding your score below a ceiling until
                    fixed.
                  </p>
                </section>

                <section className="dbx-detail-card">
                  <p className="dbx-eyebrow">Score by area</p>
                  <PillarRadar pillars={s.pillars} />
                  {strongest && weakest && (
                    <p className="dbx-detail-text">
                      {`Your strongest area is ${plainLabel(strongest.name)} (${strongest.score}/100); ${plainLabel(weakest.name)} (${weakest.score}/100) is pulling your score down.`}
                    </p>
                  )}
                </section>

                {pillarPtsProps && pillarPtsStory && (
                  <section className="dbx-detail-card">
                    <PillarPoints {...pillarPtsProps} />
                    <p className="dbx-detail-lead">{pillarPtsStory.takeaway}</p>
                    {pillarPtsStory.more.map((paragraph, idx) => (
                      <p key={idx} className="dbx-detail-text">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                )}
              </div>
            ),
          };

        case "guess":
          return {
            eyebrow: "Your guesses vs the plan",
            title: `${closeCount} of ${comparableProbes.length} guesses close`,
            tone: "default" as const,
            body: (
              <div className="dbx-detail-stack">
                <section className="dbx-detail-card">
                  <GuessGap probes={family.probes} answers={answers} />
                  <p className="dbx-detail-text">
                    Each horizontal track spans the range of possible answers for that question. The
                    hollow dot marks your guess (You) and the solid dot marks the actual figure from
                    your plan (Plan).
                  </p>
                </section>

                <section className="dbx-detail-card">
                  <p className="dbx-eyebrow">Score by area</p>
                  <PillarRadar pillars={s.pillars} />
                </section>

                {pillarPtsProps && pillarPtsStory && (
                  <section className="dbx-detail-card">
                    <PillarPoints {...pillarPtsProps} />
                    <p className="dbx-detail-lead">{pillarPtsStory.takeaway}</p>
                  </section>
                )}
              </div>
            ),
          };

        case "moves":
          return {
            eyebrow: "What moves your score",
            title: unlockLine,
            tone: "default" as const,
            body: (
              <div className="dbx-detail-stack">
                <section className="dbx-detail-card">
                  {caps.length > 0 && (
                    <div className="dbx-cap-chips" aria-label="Score caps">
                      <span className="dbx-cap-label">Capped by</span>
                      {caps.map((c, idx) => (
                        <span
                          key={`${c.cappedAt}-${idx}`}
                          className="badge badge-outline dbx-cap-chip"
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
                  <p className="dbx-detail-text">
                    {`The first bar on the left is your current score (${s.value}), and each middle bar shows how many points that single action adds on its own.${
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
                            <b className="dbx-move-title">{plainMove(m.title)}</b>
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
                  {s.combined && <p className="dbx-combined-note">{s.combined.note}</p>}
                </section>

                {prioritiesProps && prioritiesStory && (
                  <section className="dbx-detail-card">
                    <AdvisorPriorities {...prioritiesProps} />
                    <p className="dbx-detail-lead">{prioritiesStory.takeaway}</p>
                    {prioritiesStory.more.map((paragraph, idx) => (
                      <p key={idx} className="dbx-detail-text">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                )}
              </div>
            ),
          };

        default:
          return null;
      }
    })();

    return (
      <div className="dbx-fit" ref={outer}>
        <div className="dbx-root dbx-cover" ref={inner}>
          <header className="dbx-page-head">
            <p className="dbx-eyebrow dbx-page-who">{adultsNames}</p>
            <h1 className="dbx-page-title">Your plan at a glance</h1>
          </header>

          {/* Portada: 4 widgets. En pareja el CSS de la app oculta .dbx-guess-card y entra "Score by area" en su sitio. */}
          <div className={`dbx-grid dbx-grid-cover${!hasAnswers ? " dbx-no-guess" : ""}`}>
            {/* 1. Protagonista: "The one thing to know" con el botón azul "Pick your first step" */}
            <WidgetCard
              size="medium"
              eyebrow="The one thing to know"
              tone={keyProbe ? "alert" : "default"}
              className="dbx-a-insight"
              headline={
                <h2 className="dbx-w-title">
                  {insightMeta
                    ? insightMeta.title
                    : (prioritiesProps?.items[0]?.title ?? "Review your priority steps")}
                </h2>
              }
              support={
                insightMeta
                  ? insightMeta.support
                  : (analysis.summary?.[0] ?? "Tap Details for your full advisor summary.")
              }
              footerAction={
                <button
                  type="button"
                  className="dbx-pill-blue"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickFirstStep();
                  }}
                >
                  Pick your first step
                </button>
              }
              onOpen={(el) => openDetail("insight", el)}
            >
              {keyProbe && (
                <KeyInsight
                  probe={keyProbe}
                  currentAge={currentAge}
                  scoreValue={s.value}
                  hideHeader
                />
              )}
            </WidgetCard>

            {/* 2. Nota del plan: arco con la nota, el estado y "Up to N" */}
            <WidgetCard
              size="small"
              eyebrow="Your financial health"
              className="dbx-a-gauge"
              support={capNames ? `Capped by ${capNames}` : undefined}
              onOpen={(el) => openDetail("gauge", el)}
            >
              <ScoreGaugeMini
                value={s.value}
                band={s.band}
                potential={s.combined?.scoreAfter}
                caps={caps}
              />
            </WidgetCard>

            {/* 3a. "Your guesses vs the plan" (la clase dbx-guess-card la usa la app para ocultarlo en pareja) */}
            <WidgetCard
              size="small"
              eyebrow="Your guesses vs the plan"
              className="dbx-guess-card dbx-a-guess"
              headline={
                <p className="dbx-w-num">
                  <CountUp value={closeCount} />{" "}
                  <span className="dbx-w-unit">{`of ${comparableProbes.length} close`}</span>
                </p>
              }
              support={
                <span className="dbx-legend">
                  <span className="dbx-legend-item">
                    <i className="dbx-legend-dot dbx-legend-you" aria-hidden="true" />
                    You
                  </span>
                  <span className="dbx-legend-item">
                    <i className="dbx-legend-dot dbx-legend-plan" aria-hidden="true" />
                    Plan
                  </span>
                </span>
              }
              onOpen={(el) => openDetail("guess", el)}
            >
              <GuessList probes={family.probes} answers={answers} />
            </WidgetCard>

            {/* 3b. Sustituto en pareja (.is-couple) o sin respuestas (.dbx-no-guess): nota por área */}
            <WidgetCard
              size="small"
              eyebrow="Score by area"
              className="dbx-a-radar"
              onOpen={(el) => openDetail("radar", el)}
            >
              <PillarBars pillars={s.pillars} />
            </WidgetCard>

            {/* 4. "What moves your score": cada paso por separado; solo el titular usa "combined" */}
            <WidgetCard
              size="medium"
              eyebrow="What moves your score"
              className="dbx-a-moves"
              headline={
                <p className="dbx-w-num">
                  <CountUp value={s.value} />
                  <span className="dbx-w-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="dbx-sr-only"> to </span>
                  <CountUp value={moveTarget} delay={400} />{" "}
                  <span className="dbx-w-unit">
                    {s.combined ? "all steps together" : "best single step"}
                  </span>
                </p>
              }
              onOpen={(el) => openDetail("moves", el)}
            >
              <MovesMini moves={s.moves} />
            </WidgetCard>
          </div>
        </div>

        <WidgetDetailModal
          open={Boolean(modalMeta)}
          onClose={closeDetail}
          eyebrow={modalMeta?.eyebrow ?? ""}
          title={modalMeta?.title ?? ""}
          tone={modalMeta?.tone}
          returnFocusTo={detail?.triggerEl}
        >
          {modalMeta?.body}
        </WidgetDetailModal>
      </div>
    );
  }

  // ================= PÁGINAS DE SECCIÓN =================
  const { section, probes } = page;
  const findStat = (label: string) => section.stats.find((st) => st.label === label);
  const findNumericStat = (label: string): number | null => {
    const found = findStat(label);
    return found && typeof found.value === "number" ? found.value : null;
  };

  const probeYouValues = (p: Probe): number[] =>
    couple && couple.people.length > 1
      ? couple.people.map((_, i) => couple.answers[i]?.[p.id] ?? p.input.initial)
      : [answers[p.id] ?? p.input.initial];

  const probeYouSummary = (p: Probe): string => {
    const vals = probeYouValues(p);
    if (couple && couple.people.length > 1) {
      return couple.people
        .map((person, i) => `${person.name}: ${formatValue(p.input, vals[i])}`)
        .join(" · ");
    }
    return `You said ${formatValue(p.input, vals[0])}`;
  };

  // Datos específicos por sección (reutilizando exactamente la lógica y cifras existentes)
  type RetirementMilestone = { age: number; label: string; bad?: boolean };
  const retirementMilestones: RetirementMilestone[] = [];
  if (section.id === "retirement") {
    for (const st of section.stats) {
      if (st.kind === "age" && typeof st.value === "number") {
        if (st.label.endsWith("retires at")) {
          const person = st.label.slice(0, -"retires at".length).trim();
          retirementMilestones.push({ age: st.value, label: `${person} retires` });
        } else if (st.label === "Savings run out at") {
          retirementMilestones.push({ age: st.value, label: "Savings run out", bad: true });
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

  const nwPoints = section.chart && section.chart.kind === "line" ? section.chart.points : [];
  const nwFigures =
    nwPoints.length > 0
      ? (() => {
          const first = nwPoints[0];
          const last = nwPoints[nwPoints.length - 1];
          const peak = nwPoints.reduce((m, p) => (p[1] > m[1] ? p : m), first);
          return [
            { label: `Today · ${first[0]}`, value: first[1], bad: false },
            { label: `Peak · ${peak[0]}`, value: peak[1], bad: false },
            { label: `Age ${last[0]}`, value: last[1], bad: last[1] < 0 },
          ];
        })()
      : [];

  const shareSavedVal = section.id === "savings" ? findNumericStat("Share of income saved") : null;
  const leftOverVal = section.id === "savings" ? findNumericStat("Left over each year") : null;
  const grossIncomeVal = section.id === "savings" ? findNumericStat("Gross income") : null;

  const debtVsIncomeVal = section.id === "debt" ? findNumericStat("Debt payments vs income") : null;
  const allObligVal = section.id === "debt" ? findNumericStat("All obligations vs income") : null;
  const monthlyDebtVal = section.id === "debt" ? findNumericStat("Monthly debt payments") : null;

  const wealthAssets = section.id === "wealth" ? findNumericStat("Total assets") : null;
  const wealthDebts = section.id === "wealth" ? findNumericStat("Total debts") : null;
  const stocksTodayVal = section.id === "portfolio" ? findNumericStat("Stocks today") : null;
  const stocksTargetVal = section.id === "portfolio" ? findNumericStat("Stocks in target mix") : null;
  const swingVal = section.id === "portfolio" ? findNumericStat("Ups and downs per year") : null;
  const biggestSectorStat =
    section.id === "portfolio"
      ? section.stats.find((st) => st.label.startsWith("Biggest sector"))
      : undefined;

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
      }
    }
  }

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

  const monthlyDebtProps = section.id === "debt" ? buildMonthlyDebtProps(section) : null;
  const monthlyDebtStoryData = monthlyDebtProps ? monthlyDebtStory(monthlyDebtProps) : null;

  const swingProps = section.id === "portfolio" ? buildSwingRangeProps(section) : null;
  const swingStoryData = swingProps ? swingRangeStory(swingProps) : null;

  const sectionMeta = ((): {
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
            ? `Savings projected to run out at age ${markAge}.`
            : nwFigures.length === 3
              ? `Net worth moves from ${formatCompactUSD(nwFigures[0].value)} today to ${formatCompactUSD(nwFigures[2].value)}.`
              : "Projected net worth across your retirement timeline.";
        return {
          eyebrow: "Projected net worth",
          takeaway,
          howToRead:
            "The line tracks your projected net worth by age, from today to the end of your plan, with the figures for today, your peak and the final year. The vertical lines mark retirement ages and the point where savings run out, if they do.",
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
          eyebrow: "What you own",
          takeaway: topSegment
            ? `Led by ${plainLabel(topSegment.label).toLowerCase()} (${formatStat("pct", topSegment.value / Math.max(1, section.chart?.kind === "bars" ? section.chart.items.reduce((acc, i) => acc + i.value, 0) : 1))}).`
            : `${formatStat("usd", wealthAssets ?? 0)} assets minus ${formatStat("usd", wealthDebts ?? 0)} debts.`,
          howToRead:
            "Each bar is one type of asset, from largest to smallest. Net worth is everything you own minus everything you owe.",
          tone: nwVal < 0 ? "alert" : "default",
        };
      }

      case "debt": {
        const sortedDebts = [...debtRows].sort((a, b) => b.balance - a.balance);
        const highRateDebt = sortedDebts.find((r) => r.rate >= 0.15) ?? null;
        const isAlert =
          (debtVsIncomeVal !== null && debtVsIncomeVal >= 0.36) || Boolean(highRateDebt);
        const takeaway =
          highRateDebt
            ? `${highRateDebt.name} charges ${formatStat("pct", highRateDebt.rate)} APR.`
            : sortedDebts[0]
              ? `Largest balance: ${sortedDebts[0].name} (${formatStat("usd", sortedDebts[0].balance)}).`
              : "No debt balances and zero monthly payments.";
        return {
          eyebrow: "Debt & monthly burden",
          takeaway,
          howToRead:
            "Each bar is sized to that loan's balance, from largest to smallest, with its interest rate (APR) next to it. Any rate of 15% or higher is shown in red.",
          tone: isAlert ? "alert" : "default",
        };
      }

      case "savings":
        return {
          eyebrow: "Where your yearly income goes",
          takeaway:
            grossIncomeVal !== null
              ? `From ${formatStat("usd", grossIncomeVal)} of gross income.`
              : "Where each dollar of your yearly income goes.",
          howToRead:
            "The bars show where your yearly income goes. The savings bar is the dark one.",
          tone: "default",
        };

      case "protection": {
        const shortfalls = protectionRows.filter((r) => r.have < r.recommended);
        return {
          eyebrow: "Insurance vs recommended",
          takeaway:
            shortfalls.length > 0
              ? `${shortfalls.length} of ${protectionRows.length} policies fall short of the recommended minimum.`
              : "Your insurance meets the recommended minimums.",
          howToRead:
            "Each bar shows the coverage you have today, and the vertical mark shows the recommended minimum. A bar that stops before its mark is shown in red.",
          tone: shortfalls.length > 0 ? "alert" : "default",
        };
      }

      case "portfolio":
        return {
          eyebrow: "All your money, cash included",
          takeaway:
            stocksTodayVal !== null && stocksTargetVal !== null
              ? `${formatStat("pct", stocksTodayVal)} in stocks today vs ${formatStat("pct", stocksTargetVal)} target mix.`
              : "Today's split of all your money versus your target mix.",
          howToRead:
            "Each bar shows the share of all your money, cash included, that sits in that asset class today. The vertical mark shows the share your plan recommends.",
          tone: "default",
        };

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

  // ---- Widget protagonista: la cifra y la frase a un lado, la gráfica al otro ----
  type HeroSpec = {
    stat?: { label: string; value: string; bad?: boolean };
    figures?: { label: string; value: string; bad?: boolean }[];
    // Si hay título, sustituye a la frase resumen (secciones sin una cifra titular propia).
    title?: string;
    main: ReactNode;
  };

  const headlineStat = section.headline
    ? {
        label: plainLabel(section.headline.label),
        value: formatStat(section.headline.kind, section.headline.value),
      }
    : undefined;

  // En pareja la pantalla la leen los dos: "(you)" y "(partner)" pasan a ser sus nombres.
  const adults = peopleOf(family);
  const personLabel = (label: string): string =>
    plainLabel(label)
      .replace("(you)", adults.length > 1 ? `(${adults[0].name})` : "")
      .replace("(partner)", adults[1] ? `(${adults[1].name})` : "(partner)")
      .trim();

  const buildHero = (inModal: boolean): HeroSpec => {
    switch (section.id) {
      case "retirement":
        return {
          figures: nwFigures.map((f) => ({
            label: f.label,
            value: formatCompactUSD(f.value),
            bad: f.bad,
          })),
          main: (
            <>
              {section.chart && section.chart.kind === "line" && (
                <LineChart
                  points={section.chart.points.map(([x, y]) => ({ x, y }))}
                  tone={section.chart.markAge !== null ? "bad" : "neutral"}
                  formatX={(v) => `Age ${Math.round(v)}`}
                  formatY={formatCompactUSD}
                  markers={retirementMarkers}
                  height={inModal ? 210 : 150}
                />
              )}
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
            </>
          ),
        };

      case "wealth": {
        const items =
          section.chart && section.chart.kind === "bars"
            ? [...section.chart.items].sort((a, b) => b.value - a.value)
            : [];
        const top = Math.max(1, ...items.map((i) => i.value));
        return {
          stat: headlineStat
            ? { ...headlineStat, bad: Number(section.headline?.value ?? 0) < 0 }
            : undefined,
          main: (
            <BarRows
              ariaLabel="Your assets, largest first"
              rows={items.slice(0, inModal ? items.length : 5).map((i) => ({
                key: i.label,
                label: plainLabel(i.label),
                value: formatStat("usd", i.value),
                ratio: i.value / top,
              }))}
            />
          ),
        };
      }

      case "debt": {
        const sorted = [...debtRows].sort((a, b) => b.balance - a.balance);
        // En el widget caben 4: primero las de interés alto (son la noticia) y luego las mayores.
        const shown =
          inModal || sorted.length <= 4
            ? sorted
            : [...sorted.filter((r) => r.rate >= 0.15), ...sorted.filter((r) => r.rate < 0.15)]
                .slice(0, 4)
                .sort((a, b) => b.balance - a.balance);
        const top = Math.max(1, ...sorted.map((r) => r.balance));
        return {
          stat: headlineStat,
          main:
            sorted.length > 0 ? (
              <>
                <BarRows
                  ariaLabel="Your debts, largest first, with their interest rate"
                  rows={shown.map((r) => {
                    const high = r.rate >= 0.15;
                    return {
                      key: r.name,
                      label: r.name,
                      value: (
                        <>
                          {formatStat("usd", r.balance)}
                          <span className={`dbx-row-note${high ? " tone-bad" : ""}`}>
                            {`${formatStat("pct", r.rate)} APR`}
                          </span>
                        </>
                      ),
                      ratio: r.balance / top,
                      bad: high,
                    };
                  })}
                />
                {shown.length < sorted.length && (
                  <p className="dbx-hero-more">{`+${sorted.length - shown.length} more in Details`}</p>
                )}
              </>
            ) : (
              <p className="dbx-hero-empty">Debt-free</p>
            ),
        };
      }

      case "savings": {
        const chart = section.chart && section.chart.kind === "bars" ? section.chart : null;
        const items = chart ? chart.items : [];
        const kind = chart?.ratio ? "pct" : "usd";
        const top = Math.max(1e-9, ...items.map((i) => Math.max(i.value, i.target ?? 0)));
        return {
          stat: headlineStat,
          main: (
            <BarRows
              ariaLabel="Where your yearly income goes"
              rows={items.slice(0, inModal ? items.length : 5).map((i) => ({
                key: i.label,
                label: plainLabel(i.label),
                value: formatStat(kind, i.value),
                ratio: i.value / top,
                target: typeof i.target === "number" ? i.target / top : null,
                // La fila del ahorro va en tinta; el resto, en gris, para que destaque.
                soft: !/saving/i.test(i.label),
              }))}
            />
          ),
        };
      }

      case "protection":
        return {
          title: sectionMeta.takeaway,
          main: (
            <BarRows
              ariaLabel="Your insurance compared with the recommended minimum"
              rows={protectionRows.map((r) => {
                const short = r.have < r.recommended;
                const top = Math.max(r.have, r.recommended, 1);
                return {
                  key: r.label,
                  label: personLabel(r.label),
                  value: (
                    <>
                      <span className={short ? "tone-bad" : undefined}>
                        {formatStat("usd", r.have)}
                      </span>
                      <span className="dbx-row-note">{`rec. ${formatStat("usd", r.recommended)}`}</span>
                    </>
                  ),
                  ratio: r.have / top,
                  target: r.recommended / top,
                  bad: short,
                  notch: short,
                };
              })}
            />
          ),
        };

      case "portfolio": {
        const chart = section.chart && section.chart.kind === "bars" ? section.chart : null;
        const items = chart ? chart.items : [];
        const kind = chart?.ratio ? "pct" : "usd";
        const top = chart?.ratio
          ? 1
          : Math.max(1e-9, ...items.map((i) => Math.max(i.value, i.target ?? 0)));
        return {
          title: sectionMeta.takeaway,
          main: (
            <BarRows
              ariaLabel="How your money is split today, with the target mix marked"
              rows={items.map((i) => ({
                key: i.label,
                label: plainLabel(i.label),
                value: (
                  <>
                    {formatStat(kind, i.value)}
                    {typeof i.target === "number" && (
                      <span className="dbx-row-note">{`target ${formatStat(kind, i.target)}`}</span>
                    )}
                  </>
                ),
                ratio: i.value / top,
                target: typeof i.target === "number" ? i.target / top : null,
              }))}
            />
          ),
        };
      }

      default:
        return {
          stat: headlineStat,
          main: section.chart ? <SectionChart chart={section.chart} /> : null,
        };
    }
  };

  // El mismo bloque sirve para el widget y, apilado, para el detalle.
  const renderHero = (inModal: boolean): ReactNode => {
    const h = buildHero(inModal);
    return (
      <div className="dbx-hero-split">
        <div className="dbx-hero-side">
          {h.stat && (
            <div className="dbx-hero-stat">
              <span className="dbx-hero-label">{h.stat.label}</span>
              <span className={`dbx-hero-num${h.stat.bad ? " tone-bad" : ""}`}>{h.stat.value}</span>
            </div>
          )}
          {h.figures && h.figures.length > 0 && (
            <dl className="dbx-hero-figs">
              {h.figures.map((f) => (
                <div key={f.label} className="dbx-hero-fig">
                  <dt>{f.label}</dt>
                  <dd className={f.bad ? "tone-bad" : undefined}>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className={h.title ? "dbx-hero-title" : "dbx-hero-take"}>
            {h.title ?? sectionMeta.takeaway}
          </p>
        </div>
        <div className="dbx-hero-main">{h.main}</div>
      </div>
    );
  };

  // ---- Dos widgets pequeños por sección: primero las preguntas que respondió la familia ----
  type SmallWidgetSpec = {
    id: string;
    eyebrow: string;
    headline?: ReactNode;
    visual?: ReactNode;
    support?: ReactNode;
  };

  const numWidget = (
    id: string,
    eyebrow: string,
    value: string,
    opts: { bad?: boolean; unit?: string; visual?: ReactNode; support?: ReactNode } = {},
  ): SmallWidgetSpec => ({
    id,
    eyebrow,
    headline: (
      <p className={`dbx-w-num${opts.bad ? " tone-bad" : ""}`}>
        {value}
        {opts.unit && (
          <>
            {" "}
            <span className="dbx-w-unit">{opts.unit}</span>
          </>
        )}
      </p>
    ),
    visual: opts.visual,
    support: opts.support,
  });

  const ringWidget = (
    id: string,
    eyebrow: string,
    value: number,
    opts: { bad?: boolean; support?: ReactNode } = {},
  ): SmallWidgetSpec => ({
    id,
    eyebrow,
    visual: <RingStat value={value} bad={opts.bad} label={eyebrow} />,
    support: opts.support,
  });

  // Separa número y unidad de una cifra del plan (solo formato; el valor es el del plan).
  const splitValue = (p: Probe, v: number): { value: string; unit?: string } => {
    const n = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: p.input.step < 1 ? 1 : 0,
    }).format(v);
    switch (p.input.unit) {
      case "months":
        return { value: n, unit: v === 1 ? "month" : "months" };
      case "years of salary":
        return { value: n, unit: v === 1 ? "year of pay" : "years of pay" };
      default:
        return { value: formatValue(p.input, v) };
    }
  };

  // Widget de una pregunta: la cifra del plan, la pista "tú frente al plan" y lo que respondió cada uno.
  const probeWidget = (
    p: Probe,
    eyebrow: string,
    opts: { value?: string; unit?: string; visual?: ReactNode } = {},
  ): SmallWidgetSpec => {
    const plan = truthValue(p);
    const bad = p.tone === "bad";
    const parts = plan === null ? { value: "Never" } : splitValue(p, plan);
    return numWidget(
      `probe-${p.id}`,
      eyebrow,
      opts.value ?? parts.value,
      {
        bad,
        unit: opts.unit ?? (opts.value ? undefined : parts.unit),
        visual:
          opts.visual ??
          (plan !== null ? (
            <GuessTrack
              min={p.input.min}
              max={p.input.max}
              you={probeYouValues(p)}
              plan={plan}
              bad={bad}
              label={`${p.question} Your plan says ${formatValue(p.input, plan)}. ${probeYouSummary(p)}.`}
            />
          ) : undefined),
        support: probeYouSummary(p),
      },
    );
  };

  const smallWidgets: SmallWidgetSpec[] = (() => {
    const list: (SmallWidgetSpec | null)[] = (() => {
      switch (section.id) {
        case "retirement": {
          const covered =
            section.headline && section.headline.kind === "pct"
              ? Number(section.headline.value)
              : null;
          const ahorrosProbe = probes.find((p) => p.id === "ahorros");
          const ahorrosPlan = ahorrosProbe ? truthValue(ahorrosProbe) : null;
          const retireStats = section.stats.filter((st) => st.label.endsWith("retires at"));
          return [
            covered !== null
              ? ringWidget("income-covered", "Income covered in retirement", covered, {
                  bad: covered < 0.5,
                })
              : null,
            ahorrosProbe
              ? probeWidget(ahorrosProbe, "Savings run out", {
                  value: ahorrosPlan === null ? "Never" : `Age ${ahorrosPlan}`,
                })
              : numWidget(
                  "retire-ages",
                  "Retirement age",
                  retireStats.map((st) => st.value).join(" / ") || "—",
                  {
                    support:
                      retireStats
                        .map((st) => `${st.label.replace(" retires at", "")} at ${st.value}`)
                        .join(" · ") || undefined,
                  },
                ),
          ];
        }

        case "wealth": {
          const assets = wealthAssets ?? 0;
          const debts = wealthDebts ?? 0;
          // Las dos barras comparten escala para poder compararlas de un widget a otro.
          const side = Math.max(assets, debts, 1);
          return [
            numWidget("total-assets", "Total assets", formatStat("usd", assets), {
              visual: (
                <MiniBar ratio={assets / side} label={`Total assets ${formatStat("usd", assets)}`} />
              ),
              support: "Everything you own",
            }),
            numWidget("total-debts", "Total debts", formatStat("usd", debts), {
              visual: (
                <MiniBar
                  ratio={debts / side}
                  soft
                  label={`Total debts ${formatStat("usd", debts)}`}
                />
              ),
              support: debts === 0 ? "Debt-free" : "Everything you owe",
            }),
          ];
        }

        case "debt": {
          const tarjetaProbe = probes.find((p) => p.id === "tarjeta");
          const oblig = allObligVal ?? 0;
          const dti = debtVsIncomeVal ?? 0;
          return [
            tarjetaProbe
              ? probeWidget(tarjetaProbe, "Card payment that cuts debt", {
                  unit: `of ${formatValue(
                    tarjetaProbe.input,
                    tarjetaProbe.truth.payment ?? tarjetaProbe.input.max,
                  )}`,
                })
              : numWidget("all-obligations", "All obligations vs income", formatStat("pct", oblig), {
                  bad: oblig >= 0.36,
                  visual: (
                    <MiniBar
                      ratio={oblig}
                      bad={oblig >= 0.36}
                      label={`All obligations ${formatStat("pct", oblig)} of income`}
                    />
                  ),
                }),
            ringWidget("debt-vs-income", "Debt payments vs income", dti, {
              bad: dti >= 0.36,
              support:
                monthlyDebtVal !== null ? `${formatStat("usd", monthlyDebtVal)} a month` : undefined,
            }),
          ];
        }

        case "savings": {
          const leftOver = leftOverVal ?? 0;
          const probeSpec = (p: Probe): SmallWidgetSpec =>
            p.id === "destino"
              ? probeWidget(p, "Savings going to retirement", {
                  unit: `of ${formatValue(p.input, p.input.max)}`,
                })
              : probeWidget(p, shortProbeLabel(p));
          return [
            probes[0]
              ? probeSpec(probes[0])
              : numWidget("left-over", "Left over each year", formatStat("usd", leftOver), {
                  bad: leftOver < 0,
                  support: leftOver < 0 ? "A yearly shortfall" : undefined,
                }),
            probes[1]
              ? probeSpec(probes[1])
              : ringWidget("share-saved", "Share of income saved", shareSavedVal ?? 0, {
                  support: "of your gross income",
                }),
          ];
        }

        case "protection": {
          const colchonProbe = probes.find((p) => p.id === "colchon");
          const seguroProbe = probes.find((p) => p.id === "seguro");
          const colchonPlan = colchonProbe ? truthValue(colchonProbe) : null;
          const headlineMonths =
            section.headline && section.headline.kind === "months"
              ? Number(section.headline.value)
              : null;
          // Con pregunta se enseña su cifra (la misma que se reveló antes); si no, la del plan.
          const months = colchonPlan ?? headlineMonths;
          const umbrellaVal = findNumericStat("Umbrella policy");
          const umbrellaRec = findNumericStat("Umbrella recommended");
          return [
            months !== null
              ? numWidget(
                  "emergency-cash",
                  "Emergency cash",
                  colchonProbe && colchonPlan !== null
                    ? splitValue(colchonProbe, colchonPlan).value
                    : String(months),
                  {
                    unit: months === 1 ? "month" : "months",
                    bad: colchonProbe ? colchonProbe.tone === "bad" : months < 4,
                    visual: <MonthGrid months={months} />,
                    support: colchonProbe
                      ? probeYouSummary(colchonProbe)
                      : "Months of expenses covered",
                  },
                )
              : null,
            seguroProbe
              ? probeWidget(seguroProbe, "Life insurance covers")
              : umbrellaVal !== null && umbrellaRec !== null
                ? numWidget("umbrella", "Umbrella policy", formatStat("usd", umbrellaVal), {
                    bad: umbrellaVal < umbrellaRec,
                    visual: (
                      <MiniBar
                        ratio={umbrellaVal / Math.max(umbrellaVal, umbrellaRec, 1)}
                        target={umbrellaRec / Math.max(umbrellaVal, umbrellaRec, 1)}
                        bad={umbrellaVal < umbrellaRec}
                        label={`Umbrella policy ${formatStat("usd", umbrellaVal)}, recommended ${formatStat("usd", umbrellaRec)}`}
                      />
                    ),
                    support: `Recommended ${formatStat("usd", umbrellaRec)}`,
                  })
                : null,
          ];
        }

        case "portfolio": {
          const mezclaProbe = probes.find((p) => p.id === "mezcla");
          const sectorVal =
            biggestSectorStat && typeof biggestSectorStat.value === "number"
              ? biggestSectorStat.value
              : null;
          return [
            mezclaProbe
              ? probeWidget(mezclaProbe, "Stocks in your investments")
              : biggestSectorStat && sectorVal !== null
                ? numWidget(
                    "biggest-sector",
                    plainLabel(biggestSectorStat.label),
                    formatStat("pct", sectorVal),
                    {
                      visual: (
                        <MiniBar
                          ratio={sectorVal}
                          label={`${biggestSectorStat.label} ${formatStat("pct", sectorVal)}`}
                        />
                      ),
                    },
                  )
                : null,
            section.headline
              ? numWidget(
                  "yearly-growth",
                  plainLabel(section.headline.label),
                  formatStat(section.headline.kind, section.headline.value),
                  {
                    support:
                      swingVal !== null
                        ? `Ups and downs per year: ${formatStat("pct", swingVal)}`
                        : undefined,
                  },
                )
              : null,
          ];
        }

        default:
          return section.stats.slice(0, 2).map((st) =>
            numWidget(st.label, plainLabel(st.label), formatStat(st.kind, st.value)),
          );
      }
    })();
    return list.filter((w): w is SmallWidgetSpec => w !== null);
  })();

  const totalWidgets = 1 + smallWidgets.length;

  const sectionDetailTitle = section.headline
    ? `${plainLabel(section.headline.label)}: ${formatStat(section.headline.kind, section.headline.value)}`
    : section.title;

  return (
    <div className="dbx-fit" ref={outer}>
      <div className="dbx-root dbx-section" ref={inner}>
        <header className="dbx-page-head">
          <h1 className="dbx-page-title">{section.title}</h1>
        </header>

        {/* Un protagonista y dos pequeños: tres widgets por sección */}
        <div className="dbx-grid dbx-grid-section" data-count={totalWidgets}>
          <WidgetCard
            size="large"
            eyebrow={sectionMeta.eyebrow}
            className="dbx-s-hero"
            onOpen={(el) => openDetail("section-hero", el)}
          >
            {renderHero(false)}
          </WidgetCard>

          {smallWidgets.map((w) => (
            <WidgetCard
              key={w.id}
              size="small"
              eyebrow={w.eyebrow}
              className="dbx-s-small"
              headline={w.headline}
              support={w.support}
              onOpen={(el) => openDetail(w.id, el)}
            >
              {w.visual}
            </WidgetCard>
          ))}
        </div>
      </div>

      {/* Modal/hoja inferior de detalle de sección: contiene gráfica grande, moreCharts, tabla, sondas y observaciones */}
      <WidgetDetailModal
        open={Boolean(detail)}
        onClose={closeDetail}
        eyebrow={section.title}
        title={sectionDetailTitle}
        tone={sectionMeta.tone}
        returnFocusTo={detail?.triggerEl}
      >
        <div className="dbx-detail-stack">
          <section className="dbx-detail-card">
            <p className="dbx-eyebrow">{sectionMeta.eyebrow}</p>
            {renderHero(true)}
            <p className="dbx-detail-text">{sectionMeta.howToRead}</p>
          </section>

          {monthlyDebtProps && monthlyDebtStoryData && (
            <section className="dbx-detail-card">
              <MonthlyDebt {...monthlyDebtProps} />
              <p className="dbx-detail-lead">{monthlyDebtStoryData.takeaway}</p>
              {monthlyDebtStoryData.more.map((paragraph, idx) => (
                <p key={idx} className="dbx-detail-text">
                  {paragraph}
                </p>
              ))}
            </section>
          )}

          {swingProps && swingStoryData && (
            <section className="dbx-detail-card">
              <SwingRange {...swingProps} />
              <p className="dbx-detail-lead">{swingStoryData.takeaway}</p>
              {swingStoryData.more.map((paragraph, idx) => (
                <p key={idx} className="dbx-detail-text">
                  {paragraph}
                </p>
              ))}
            </section>
          )}

          {section.id === "debt" && section.table && (
            <section className="dbx-detail-card">
              <p className="dbx-eyebrow">All debt accounts</p>
              <div className="dbx-table-wrap">
                <SectionTable table={section.table} />
              </div>
            </section>
          )}

          {probes.length > 0 && (
            <section className="dbx-detail-card dbx-detail-probes">
              <p className="dbx-eyebrow">Your guesses vs the plan</p>
              <div className="a-probes">
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
              </div>
            </section>
          )}

          {section.stats.length > 0 && (
            <section className="dbx-detail-card">
              <p className="dbx-eyebrow">All figures</p>
              <div className="dbx-stats-grid">
                {section.stats.map((st) => (
                  <StatTile key={st.label} stat={{ ...st, label: plainLabel(st.label) }} />
                ))}
              </div>
            </section>
          )}

          {(section.observations.length > 0 ||
            section.lookInto ||
            (section.recommendations && section.recommendations.length > 0)) && (
            <section className="dbx-detail-card">
              {section.observations.length > 0 && (
                <div className="dbx-more-block">
                  <p className="dbx-eyebrow">Key observations</p>
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
                  <p className="dbx-eyebrow">Worth looking into</p>
                  <p className="dbx-detail-text">{section.lookInto}</p>
                </div>
              )}

              {section.recommendations && section.recommendations.length > 0 && (
                <div className="dbx-more-block">
                  <p className="dbx-eyebrow">Recommendations</p>
                  <ul className="dbx-recs-list">
                    {section.recommendations.map((rec, idx) => (
                      <li key={idx} className="dbx-rec-item">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      </WidgetDetailModal>
    </div>
  );
}
