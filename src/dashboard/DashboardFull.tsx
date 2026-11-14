import { StatTile, SectionChart, SectionTable } from "../analysis/AnalysisBlocks";
import { LineChart, formatCompactUSD, type LineMarker } from "../charts/LineChart";
import { formatStat } from "../data";
import type { PageProps } from "../formats/types";
import {
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
import "./dashboard.css";

// Vista de análisis para el formato Dashboard (adultos de 30 a 54 años), centrada en gráficas y texto mínimo.
export function DashboardFull({
  family,
  analysis,
  page,
  answers,
  Reveal,
}: PageProps): JSX.Element {
  if (page.kind === "cover") {
    const s = analysis.score;
    // Acceso seguro a `caps` sin modificar el tipo global Analysis en src/data.ts.
    const caps = (s as { caps?: CapItem[] }).caps ?? [];

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

    const unlockLine = s.combined
      ? `Together: ${s.value} → ${s.combined.scoreAfter}`
      : `Best single step: ${s.value} → ${maxIndivAfter}`;

    return (
      <div className="dbx-root dbx-cover">
        {/* Tarjeta 1: Comparación entre lo que la familia cree y lo que dice su plan */}
        <section className="card dbx-guess-card">
          <GuessGap probes={family.probes} answers={answers} />
        </section>

        {/* Cabecera principal con el arco semicircular de salud financiera */}
        <section className="card dbx-hero-card">
          <div className="dbx-hero-top">
            <p className="eyebrow">Your financial health</p>
            <span className={`badge ${s.value < 40 ? "badge-outline" : "badge-soft"}`}>
              {s.band}
            </span>
          </div>
          <ScoreGauge
            value={s.value}
            band={s.band}
            potential={s.combined?.scoreAfter}
            caps={caps}
          />
          <p className="dbx-caption">
            {s.combined
              ? `Score ${s.value}/100 (${s.band}) — up to ${s.combined.scoreAfter} with all steps.`
              : `Score ${s.value} out of 100 (${s.band} band).`}
          </p>
          {s.message && (
            <details className="dbx-more">
              <summary>Read more</summary>
              <div className="dbx-more-body">
                <p className="dbx-more-text">{s.message}</p>
              </div>
            </details>
          )}
        </section>

        {/* Rejilla de 2 columnas en escritorio (>= 900px) para las tarjetas de análisis */}
        <div className="dbx-cover-grid">
          <section className="card dbx-card">
            <p className="eyebrow">Score by area</p>
            <PillarRadar pillars={s.pillars} />
            {strongest && weakest && (
              <p className="dbx-caption">
                {`Strongest: ${plainLabel(strongest.name)} (${strongest.score}). Weakest: ${plainLabel(weakest.name)} (${weakest.score}).`}
              </p>
            )}
          </section>

          {s.moves.length > 0 && (
            <section className="card dbx-card">
              <div className="dbx-wf-header">
                <p className="eyebrow">What moves your score</p>
                <p className="dbx-wf-unlock">{unlockLine}</p>
              </div>

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
              <p className="dbx-caption">
                Points each step adds to your current score.
              </p>

              <details className="dbx-more">
                <summary>Read more</summary>
                <div className="dbx-more-body">
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
              </details>
            </section>
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

  // Marcadores de edad para la gráfica de línea en la sección de jubilación.
  const retirementMarkers: LineMarker[] = [];
  if (section.id === "retirement") {
    for (const st of section.stats) {
      if (st.kind === "age" && typeof st.value === "number") {
        if (st.label.endsWith("retires at")) {
          const person = st.label.slice(0, -"retires at".length).trim();
          retirementMarkers.push({ x: st.value, label: `${person} retires` });
        } else if (st.label === "Savings run out at") {
          retirementMarkers.push({ x: st.value, label: "Savings run out" });
        } else if (st.label === "Plan runs until") {
          retirementMarkers.push({ x: st.value, label: "End of plan" });
        }
      }
    }
  }

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

  const hasReadMore =
    section.observations.length > 0 ||
    Boolean(section.lookInto) ||
    Boolean(section.recommendations && section.recommendations.length > 0) ||
    Boolean(section.id === "debt" && section.table);

  return (
    <div className="dbx-root dbx-section">
      {/* 1. Título de sección */}
      <div className="dbx-section-header">
        <h1 className="a-title">{section.title}</h1>
      </div>

      {/* 2. Gráfica principal de la sección */}
      <section className="card dbx-chart-card">
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
                <LineChart
                  points={section.chart.points.map(([x, y]) => ({ x, y }))}
                  tone={section.chart.markAge !== null ? "bad" : "neutral"}
                  formatX={(v) => `Age ${Math.round(v)}`}
                  formatY={formatCompactUSD}
                  markers={retirementMarkers}
                />
              </div>
            )}
            <p className="dbx-caption">
              {section.chart?.kind === "line" && section.chart.markAge !== null
                ? `Savings are projected to run out at age ${section.chart.markAge}.`
                : "Projected net worth across your retirement timeline."}
            </p>
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
            <p className="dbx-caption">
              Assets versus debts and how your wealth is divided.
            </p>
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
            <p className="dbx-caption">
              {debtRows.length > 0
                ? "Balances largest first; interest rates of 15% or higher in red."
                : "You carry no debt balances and have zero monthly payments."}
            </p>
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
            <p className="dbx-caption">
              Where each dollar of your yearly income goes.
            </p>
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
            <p className="dbx-caption">
              Current protection versus recommended minimums; shortfalls in red.
            </p>
          </div>
        )}

        {/* PORTFOLIO: Ring de crecimiento anual + dos StackBar (Today y Target) con leyenda compartida */}
        {section.id === "portfolio" && (
          <div className="dbx-main-visual">
            {section.headline && section.headline.kind === "pct" && (
              <Ring
                value={Number(section.headline.value)}
                label={section.headline.label}
              />
            )}
            {section.chart && section.chart.kind === "bars" && (
              <div className="a-chart dbx-portfolio-stacks">
                <p className="eyebrow">{section.chart.title}</p>
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
            <p className="dbx-caption">
              Your current investment mix compared with your target mix.
            </p>
          </div>
        )}

        {/* Fallback por si alguna sección futura tuviera otro id */}
        {!["retirement", "wealth", "debt", "savings", "protection", "portfolio"].includes(
          section.id
        ) &&
          section.chart && <SectionChart chart={section.chart} />}
      </section>

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

      {/* 5. Read more: tabla original (en debt) + observations + lookInto + recommendations */}
      {hasReadMore && (
        <details className="dbx-more card dbx-more-card">
          <summary>Read more</summary>
          <div className="dbx-more-body">
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
        </details>
      )}
    </div>
  );
}
