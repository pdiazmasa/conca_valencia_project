// Construye el análisis completo de una familia a partir de las dos partes del caso
// (financial-health e investment-analysis). Solo copia o redondea cifras del plan:
// no calcula proyecciones ni inventa datos. Los textos largos son las observaciones
// del propio MCP (sin reescribir); "spoken" es el guion corto para el formato Audio.
const get = (o, path) => path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const clean = (s) => String(s ?? "").replace(/\*\*/g, "").trim();
const bullets = (s) =>
  clean(s)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);
const stat = (label, kind, value) => (value === undefined || value === null ? null : { label, kind, value });

// ---- Frases habladas (cifras redondeadas, pocas por frase) ----
const money = (v) => {
  const a = Math.abs(v);
  const sign = v < 0 ? "minus " : "";
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1).replace(/\.0$/, "")} million dollars`;
  if (a >= 1e4) return `${sign}${Math.round(a / 1e3)} thousand dollars`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1).replace(/\.0$/, "")} thousand dollars`;
  return `${sign}${Math.round(a)} dollars`;
};
const pct = (r) => `${Math.round(r * 100)} percent`;

const find = (stats, label) => stats.find((s) => s.label === label)?.value;

function section(id, title, headline, stats, extra) {
  return { id, title, headline, stats: stats.filter(Boolean), observations: [], spoken: [], ...extra };
}

export function buildAnalysis(fh, inv) {
  const km = fh.key_metrics ?? {};
  const nar = fh.narrative ?? {};
  const inar = inv.narrative ?? {};

  // ---- Portada: nota, pilares y mejoras ----
  const sc = fh.score ?? {};
  const score = {
    value: sc.published_score,
    band: sc.band,
    message: clean(sc.message),
    pillars: (sc.pillars ?? []).map((p) => ({ name: p.pillar, score: p.score, points: p.points_shown_in_app })),
    moves: (sc.top_moves ?? []).map((m) => ({ title: m.title, action: clean(m.action), effort: m.effort, scoreBefore: m.score_before, scoreAfter: m.score_after })),
    combined: sc.combined_moves?.[0] ? { moves: sc.combined_moves[0].moves, scoreAfter: sc.combined_moves[0].score_after, note: clean(sc.combined_moves[0].note) } : null,
    spoken: [],
    caps: (sc.caps_applied ?? []).map((c) => ({ reason: c.reason, cappedAt: c.score_capped_at })),
  };

  if (score.value !== undefined) score.spoken.push(`Your financial health score is ${score.value} out of 100, which we call ${score.band}.`);
  if (score.moves[0]) score.spoken.push(`Your first suggested step: ${score.moves[0].title.toLowerCase()}.`);

  // ---- Jubilación ----
  const rg = km.retirementAndOtherGoals ?? {};
  const prof = rg.clientProfile ?? {};
  const dep = rg.assetDepletion ?? {};
  const coverage = num(get(rg, "incomeVsIncomeNeeds.allIncomesVsIncomeNeededExLtcCosts"));
  const runOut = num(dep.ageWhenTheyRunOutOfLiquidAssets);
  const yearly = fh.projections?.yearly ?? [];
  const retirement = section(
    "retirement",
    "Retirement",
    stat("Income covered in retirement", "pct", coverage),
    [
      stat(`${prof.clientName ?? "You"} retires at`, "age", num(prof.clientRetirementAge)),
      prof.coClientName ? stat(`${prof.coClientName} retires at`, "age", num(prof.coClientRetirementAge)) : null,
      stat("Plan runs until", "age", num(prof.endOfPlanAge)),
      runOut !== undefined ? stat("Savings run out at", "age", runOut) : stat("Savings run out", "text", "Never"),
      stat("Savings left at end of plan", "usd", num(dep.liquidAssetsAtEndOfPlan)),
    ],
    {
      chart: yearly.length
        ? { kind: "line", title: "Net worth over time (today's dollars)", xLabel: "Age", points: yearly.filter((y) => num(y.age_client) !== undefined && num(y.net_worth_todays_dollars) !== undefined).map((y) => [y.age_client, y.net_worth_todays_dollars]), markAge: runOut ?? null }
        : null,
    }
  );
  retirement.observations = bullets(nar.retirement_short_observations);
  retirement.lookInto = clean(nar.retirement_what_to_look_into);
  if (coverage !== undefined) retirement.spoken.push(`Your plan covers about ${pct(coverage)} of the income you will need in retirement.`);
  if (runOut !== undefined) retirement.spoken.push(`At the current pace, your savings would run out at age ${runOut}.`);
  else if (num(prof.endOfPlanAge) !== undefined) retirement.spoken.push(`Your savings should last until the end of the plan, at age ${prof.endOfPlanAge}.`);

  // ---- Patrimonio ----
  const nw = km.netWorthStatement ?? {};
  const cats = (nw.assets?.items ?? []).filter((c) => num(c.total) > 0).map((c) => ({ label: c.name, value: c.total }));
  const totalAssets = num(nw.assets?.total);
  const top = [...cats].sort((a, b) => b.value - a.value)[0];
  const wealth = section(
    "wealth",
    "What you own",
    stat("Net worth", "usd", num(nw.netWorth?.total)),
    [stat("Total assets", "usd", totalAssets), stat("Total debts", "usd", num(nw.liabilities?.total)), top && totalAssets ? stat(`Biggest asset: ${top.label}`, "pct", top.value / totalAssets) : null],
    { chart: cats.length ? { kind: "bars", title: "Your assets", items: cats } : null }
  );
  wealth.observations = bullets(nar.assets_short_observations);
  wealth.lookInto = clean(nar.assets_what_to_look_into);
  if (num(nw.netWorth?.total) !== undefined) wealth.spoken.push(`Your net worth is about ${money(nw.netWorth.total)}.`);
  if (top && totalAssets) wealth.spoken.push(`Your biggest asset is your ${top.label.toLowerCase()}, about ${pct(top.value / totalAssets)} of everything you own.`);

  // ---- Deuda ----
  const debtRows = (km.debtManagement?.listOfDebts ?? []).slice(1).map((r) => ({ name: r[0], type: r[1], balance: r[2], rate: r[3], monthly: r[4] })).filter((d) => d.balance > 0);
  const dti = km.ratios?.debtToIncome ?? {};
  const costliest = [...debtRows].sort((a, b) => b.rate - a.rate)[0];
  const debt = section(
    "debt",
    "What you owe",
    stat("Total debt", "usd", num(km.ratios?.indebtedness?.debtBalance)),
    [stat("Debt payments vs income", "pct", num(dti.debtOnlyDti)), stat("All obligations vs income", "pct", num(dti.ratio)), stat("Monthly debt payments", "usd", num(dti.monthlyDebtPayments))],
    { table: debtRows.length ? { columns: ["Debt", "Balance", "Rate", "Monthly"], rows: debtRows.map((d) => [d.name, { kind: "usd", value: d.balance }, { kind: "pct", value: d.rate }, { kind: "usd", value: d.monthly }]) } : null }
  );
  debt.observations = bullets(nar.debt_short_observations);
  debt.lookInto = clean(nar.debt_what_to_look_into);
  const totalDebt = find(debt.stats.concat(debt.headline ? [debt.headline] : []), "Total debt");
  if (totalDebt !== undefined && totalDebt > 0) {
    debt.spoken.push(`You owe about ${money(totalDebt)} in total.`);
    if (num(dti.debtOnlyDti) !== undefined) debt.spoken.push(`Your debt payments take about ${pct(dti.debtOnlyDti)} of your income.`);
    if (costliest && costliest.rate >= 0.1) debt.spoken.push(`The costliest one is your ${costliest.name}, at ${Math.round(costliest.rate * 100)} percent interest.`);
  } else if (totalDebt === 0) debt.spoken.push("You have no debt.");

  // ---- Ahorro y flujo de caja ----
  const sl = km.ratios?.savingsLevel ?? {};
  const cf = km.savingsAndExpenses?.incomeAndCashflow ?? {};
  const outflow = (cf.outflowSummary ?? []).slice(1).filter((r) => r[0] !== "Total" && num(r[1]) > 0).map((r) => ({ label: r[0], value: r[1] }));
  const savings = section(
    "savings",
    "Saving and spending",
    stat("Saved each year", "usd", num(sl.savingAmount)),
    [stat("Share of income saved", "pct", num(sl.ratio)), stat("Left over each year", "usd", num(cf.annualCashflow)), stat("Gross income", "usd", num(sl.grossIncome))],
    { chart: outflow.length ? { kind: "bars", title: "Where your income goes", items: outflow } : null }
  );
  savings.observations = bullets(nar.savings_short_observations);
  savings.lookInto = clean(nar.savings_what_to_look_into);
  if (num(sl.savingAmount) !== undefined) savings.spoken.push(`You save about ${money(sl.savingAmount)} a year${num(sl.ratio) !== undefined ? `, which is ${pct(sl.ratio)} of your income` : ""}.`);
  if (num(cf.annualCashflow) !== undefined)
    savings.spoken.push(cf.annualCashflow >= 0 ? `After all your spending, about ${money(cf.annualCashflow)} a year is left over.` : `Your spending is about ${money(-cf.annualCashflow)} a year more than what comes in.`);

  // ---- Protección ----
  const ef = km.protection?.emergencyFund?.emergencyFundCoverageEvaluation ?? {};
  const li = km.ratios?.lifeInsurance ?? {};
  const um = km.ratios?.umbrella ?? {};
  const efMonths = num(ef.monthsCovered);
  const protection = section(
    "protection",
    "Protection",
    stat("Emergency cash covers", "months", efMonths),
    [
      stat("Life insurance (you)", "usd", num(li.clientCoverage)),
      stat("Recommended minimum (you)", "usd", num(li.recommendedClientMinCoverage)),
      num(li.recommendedCoClientMinCoverage) > 0 ? stat("Life insurance (partner)", "usd", num(li.coClientCoverage)) : null,
      num(li.recommendedCoClientMinCoverage) > 0 ? stat("Recommended minimum (partner)", "usd", num(li.recommendedCoClientMinCoverage)) : null,
      stat("Umbrella policy", "usd", num(um.currentCoverage)),
      stat("Umbrella recommended", "usd", num(um.recommendedCoverage)),
    ]
  );
  protection.observations = [clean(nar.protection_intro), ...bullets(nar.protection_emergency_fund_short_observations), ...bullets(nar.protection_life_insurance_short_observations), ...bullets(nar.protection_umbrella_short_observations)].filter(Boolean);
  if (efMonths !== undefined) protection.spoken.push(`Your cash would cover about ${efMonths} ${efMonths === 1 ? "month" : "months"} of essential expenses.`);
  if (num(li.clientCoverage) !== undefined && num(li.recommendedClientMinCoverage) > 0)
    protection.spoken.push(li.clientCoverage >= li.recommendedClientMinCoverage ? `Your life insurance is ${money(li.clientCoverage)}, which is at or above the recommended level.` : `Your life insurance is ${money(li.clientCoverage)}, and we recommend at least ${money(li.recommendedClientMinCoverage)}.`);
  if (num(um.currentCoverage) === 0 && num(um.recommendedCoverage) > 0) protection.spoken.push("You do not have an umbrella policy.");

  // ---- Cartera ----
  const pa = inv.analysis?.portfolioAnalysis?.allocationSnapshot ?? {};
  const efc = inv.analysis?.summary?.assetAllocation ?? {};
  const cur = efc.currentEFC ?? pa.allocation?.efc ?? {};
  const tgt = efc.targetEFC ?? {};
  const ann = num(inv.key_metrics?.portfolioAnalysis?.performance?.annualizedPerformance);
  const vol = num(pa.allocation?.standardDeviation);
  const conc = inv.key_metrics?.performanceAnalysis?.concentration ?? {};
  const mix = [["Cash", "cash"], ["Stocks", "equity"], ["Bonds", "fixedIncome"]];
  const portfolio = section(
    "portfolio",
    "Your investments",
    stat("Yearly growth, last 3 years", "pct", ann),
    [stat("Ups and downs per year", "pct", vol), stat("Stocks today", "pct", num(cur.equity)), stat("Stocks in target mix", "pct", num(tgt.equity)), conc.isMaterialConcentration ? stat(`Biggest sector: ${conc.topSectorName}`, "pct", num(conc.topSectorPct)) : null],
    { chart: mix.some(([, k]) => num(cur[k]) !== undefined) ? { kind: "bars", title: "How your money is split", items: mix.filter(([, k]) => num(cur[k]) !== undefined).map(([l, k]) => ({ label: l, value: cur[k], target: num(tgt[k]) })), ratio: true } : null }
  );
  portfolio.observations = [...bullets(inar.portfolio_today_what_its_actually_doing), clean(inar.portfolio_today_verdict)].filter(Boolean);
  portfolio.recommendations = bullets(inar.recommendations_main);
  if (ann !== undefined) portfolio.spoken.push(`Your investments have grown about ${pct(ann)} a year over the last three years.`);
  if (num(cur.cash) > 0.3) portfolio.spoken.push(`About ${pct(cur.cash)} of your money is sitting in cash.`);
  else if (num(cur.equity) !== undefined) portfolio.spoken.push(`About ${pct(cur.equity)} of your money is in stocks.`);

  const sections = [retirement, wealth, debt, savings, protection, portfolio].filter((s) => s.headline || s.stats.length);
  return { score, sections, summary: clean(nar.summary_main) ? bullets(nar.summary_main) : [], recommendations: bullets(nar.summary_recommendations) };
}
