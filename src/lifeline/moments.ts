// Extracción pura de momentos vitales del plan financiero familiar.
// Solo importa tipos para poder ejecutarse directamente en Node sin bundler.
import type { Analysis, Family, Member, Probe, Section, Stat } from "../data";

export type Tone = "bad" | "good" | "neutral";
export type FixKey = "card" | "life" | "withdrawal" | "savings" | "umbrella" | "home" | "portfolio";

export type Moment = {
  id: string;
  year: number;
  month?: number;
  label: string;
  detail: string;
  tone: Tone;
  section: string;
  cover: boolean;
  fixKey?: FixKey;
  source?: string;
  recommendation?: string;
};

export type Fix = {
  title: string;
  action: string;
  effort: string;
  scoreBefore: number;
  scoreAfter: number;
  fixKey: FixKey | null;
};

export type ChristmasDot = {
  year: number;
  state: "ok" | "card" | "no-savings";
};

export type LifelineData = {
  startYear: number;
  endYear: number;
  planEndAge: number;
  people: { name: string; role: string; age: number }[];
  moments: Moment[];
  dots: ChristmasDot[];
  lead: Moment | null;
  leadTitle: string;
  leadText: string;
  fixes: Fix[];
  score: number;
  scoreTogether: number | null;
};

// Mapa local de sonda a sección para no importar valores en tiempo de ejecución.
const PROBE_SECTION: Record<string, string> = {
  colchon: "protection",
  seguro: "protection",
  tarjeta: "debt",
  ahorros: "retirement",
  destino: "savings",
  fiscal: "savings",
  mezcla: "portfolio",
};

const MONTHS: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Formatea importes en dólares: enteros sin decimales y no enteros con 2 decimales ($76.50, $141.67).
export function fmtMoney(value: number): string {
  const abs = Math.abs(value);
  // Céntimos solo en importes pequeños ($76.50); a partir de $1,000 se redondea al dólar.
  const isInt = abs >= 1000 || Number.isInteger(abs) || Math.round(abs * 100) % 100 === 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 2,
  }).format(abs);
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

// Formatea años de cobertura: "1 year", "5 years", "1.5 years" (nunca "1.0 years").
export function fmtYears(y: number): string {
  const rounded = Number(y.toFixed(1));
  if (rounded === 1) return "1 year";
  return `${rounded} years`;
}

// Clasifica un move del plan según su título y acción.
export function matchFixKey(title: string, action: string): FixKey | null {
  const text = `${title} ${action}`;
  if (/card|revolving/i.test(text)) return "card";
  if (/life cover|mortality/i.test(text)) return "life";
  if (/withdrawal/i.test(text)) return "withdrawal";
  if (/savings|redirect/i.test(text)) return "savings";
  if (/umbrella/i.test(text)) return "umbrella";
  if (/homeowners|coverage gap/i.test(text)) return "home";
  if (/allocation|growth|concentration/i.test(text)) return "portfolio";
  return null;
}

function findStat(stats: Stat[], label: string): Stat | undefined {
  return stats.find((s) => s.label === label);
}

// Formatea las edades de cada miembro de la familia en un año dado.
export function formatHouseholdAges(
  people: Member[],
  startYear: number,
  targetYear: number
): string {
  const delta = targetYear - startYear;
  return people.map((p) => `${p.name} ${p.age + delta}`).join(" · ");
}

function isFutureOrCurrent(year: number, month: number, today: Date): boolean {
  const curY = today.getFullYear();
  const curM = today.getMonth() + 1;
  if (year < curY) return false;
  if (year === curY && month < curM) return false;
  return true;
}

// Divide un párrafo en frases individuales conservando el punto final.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type DateCandidate = {
  dedupKey: string;
  hasAmount: boolean;
  moment: Moment;
};

// Extrae momentos con fecha explícita (<Month> <YYYY>) de los textos de las secciones.
function extractDateMoments(
  sections: Section[],
  probes: Probe[],
  startYear: number,
  today: Date
): { moments: Moment[]; cardPayoff: { year: number; month: number; payment: number; source?: string } | null } {
  const byKey = new Map<string, DateCandidate>();
  const cardProbe = probes.find((p) => p.id === "tarjeta");
  const defaultCardPayment = cardProbe?.truth.payment;

  const upsert = (candidate: DateCandidate) => {
    const existing = byKey.get(candidate.dedupKey);
    if (!existing || (!existing.hasAmount && candidate.hasAmount)) {
      byKey.set(candidate.dedupKey, candidate);
    }
  };

  let cardPayoffInfo: { year: number; month: number; payment: number; source?: string } | null = null;

  for (const section of sections) {
    const texts: string[] = [
      ...section.observations,
      ...(section.lookInto ? [section.lookInto] : []),
      ...(section.recommendations ?? []),
    ];

    for (const block of texts) {
      const sentences = splitSentences(block);
      for (const sentence of sentences) {
        // 1. Pago final de la tarjeta ("paid off in September 2039", "The July 2028 payoff", "currently January 2034")
        const payoffMatch =
          sentence.match(
            /(?:paid off (?:in|by)|currently)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
          ) ??
          sentence.match(
            /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+payoff\b/i
          );

        if (payoffMatch && /card|payoff|paid off/i.test(sentence)) {
          const monthName =
            payoffMatch[1].charAt(0).toUpperCase() + payoffMatch[1].slice(1).toLowerCase();
          const month = MONTHS[monthName];
          const year = Number(payoffMatch[2]);
          if (month && isFutureOrCurrent(year, month, today)) {
            const payInText = sentence.match(/\$([\d,]+)\s+(?:payment|a month)/i);
            const payment = payInText
              ? Number(payInText[1].replace(/,/g, ""))
              : (defaultCardPayment ?? 0);
            const yearsOut = year - startYear;
            const tone: Tone = yearsOut >= 5 ? "bad" : "neutral";
            const dedupKey = `card-${year}-${month}`;
            const detail = payment > 0 ? `If the ${fmtMoney(payment)} payment holds.` : "If current payments hold.";
            upsert({
              dedupKey,
              hasAmount: payment > 0,
              moment: {
                id: dedupKey,
                year,
                month,
                label: "Card paid off",
                detail,
                tone,
                section: "debt",
                cover: true,
                fixKey: "card",
                source: sentence,
              },
            });
            if (!cardPayoffInfo || (payment > 0 && cardPayoffInfo.payment === 0)) {
              cardPayoffInfo = { year, month, payment, source: sentence };
            }
          }
        }

        // 2. Compra de casa ("January 2027 home purchase ($113,300 to hold)")
        if (/home purchase/i.test(sentence)) {
          const dateMatch = sentence.match(
            /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/
          );
          if (dateMatch) {
            const month = MONTHS[dateMatch[1]];
            const year = Number(dateMatch[2]);
            if (month && isFutureOrCurrent(year, month, today)) {
              const amtMatch =
                sentence.match(/home purchase\s*\(\$([\d,]+)/i) ??
                sentence.match(/\$([\d,]+)\s+home purchase/i);
              const hasAmount = Boolean(amtMatch);
              const amt = amtMatch ? Number(amtMatch[1].replace(/,/g, "")) : 0;
              const dedupKey = `home-${year}-${month}`;
              upsert({
                dedupKey,
                hasAmount,
                moment: {
                  id: dedupKey,
                  year,
                  month,
                  label: "Home purchase",
                  detail: hasAmount
                    ? `${fmtMoney(amt)} to hold for your home purchase.`
                    : "Planned home purchase.",
                  tone: "neutral",
                  section: section.id,
                  cover: true,
                  source: sentence,
                },
              });
            }
          }
        }

        // 3. Vacaciones ("$6,000 vacation in January 2027", "vacation ($3,500)", "your January 2027 vacation")
        if (/\bvacation\b/i.test(sentence)) {
          const vacDateMatch =
            sentence.match(
              /\bvacation[^.]*?\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i
            ) ??
            sentence.match(
              /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b[^.]*?\bvacation\b/i
            );
          if (vacDateMatch) {
            const month = MONTHS[vacDateMatch[1]];
            const year = Number(vacDateMatch[2]);
            if (month && isFutureOrCurrent(year, month, today)) {
              const amtMatch =
                sentence.match(/\$([\d,]+)\s+vacation/i) ??
                sentence.match(/vacation\s*\(\$([\d,]+)\)/i);
              const hasAmount = Boolean(amtMatch);
              const amt = amtMatch ? Number(amtMatch[1].replace(/,/g, "")) : 0;
              const dedupKey = `vacation-${year}-${month}`;
              upsert({
                dedupKey,
                hasAmount,
                moment: {
                  id: dedupKey,
                  year,
                  month,
                  label: "Planned vacation",
                  detail: hasAmount
                    ? `${fmtMoney(amt)} planned for vacation.`
                    : "Planned vacation in your cash budget.",
                  tone: "neutral",
                  section: section.id,
                  cover: true,
                  source: sentence,
                },
              });
            }
          }
        }

        // 4a. Universidad: pago con fecha ("Ethan's $12,500 payment is due in August 2027")
        const collegeDueMatch = sentence.match(
          /([A-Z][a-z]+)'s\s+\$([\d,]+)\s+(?:college\s+)?payment\s+is\s+due\s+(?:in\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/
        );
        if (collegeDueMatch) {
          const childName = collegeDueMatch[1];
          const amt = Number(collegeDueMatch[2].replace(/,/g, ""));
          const month = MONTHS[collegeDueMatch[3]];
          const year = Number(collegeDueMatch[4]);
          if (month && isFutureOrCurrent(year, month, today)) {
            const dedupKey = `college-${year}-${month}`;
            upsert({
              dedupKey,
              hasAmount: true,
              moment: {
                id: dedupKey,
                year,
                month,
                label: `${childName}'s college payment`,
                detail: `${fmtMoney(amt)} college payment due for ${childName}.`,
                tone: "neutral",
                section: section.id,
                cover: true,
                source: sentence,
              },
            });
          }
        }

        // 4b. Universidad: inicio ("begin in August 2026 for Ethan and August 2028 for Ava")
        if (/college/i.test(sentence) && /\bfor\s+[A-Z][a-z]+/.test(sentence)) {
          const perYearMatch = sentence.match(/\$([\d,]+)\s+per\s+year/i);
          const hasAmount = Boolean(perYearMatch);
          const amt = perYearMatch ? Number(perYearMatch[1].replace(/,/g, "")) : 0;
          const forRegex =
            /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+for\s+([A-Z][a-z]+)/g;
          let m: RegExpExecArray | null;
          while ((m = forRegex.exec(sentence)) !== null) {
            const month = MONTHS[m[1]];
            const year = Number(m[2]);
            const childName = m[3];
            if (month && isFutureOrCurrent(year, month, today)) {
              const dedupKey = `college-${year}-${month}`;
              upsert({
                dedupKey,
                hasAmount,
                moment: {
                  id: dedupKey,
                  year,
                  month,
                  label: `${childName} starts college`,
                  detail: hasAmount
                    ? `${fmtMoney(amt)} per year in college costs begin for ${childName}.`
                    : `College costs begin for ${childName}.`,
                  tone: "neutral",
                  section: section.id,
                  cover: true,
                  source: sentence,
                },
              });
            }
          }
        }
      }
    }
  }

  return {
    moments: Array.from(byKey.values()).map((c) => c.moment),
    cardPayoff: cardPayoffInfo,
  };
}

function getRecKeywordRegex(fixKey?: FixKey): RegExp {
  if (fixKey === "withdrawal" || fixKey === "savings") {
    return /retire/i;
  }
  if (fixKey === "life") {
    return /life (insurance|cover)/i;
  }
  if (fixKey === "card") {
    return /card|debt/i;
  }
  if (fixKey === "umbrella") {
    return /umbrella/i;
  }
  return /cash|cushion|reserve|shortfall/i;
}

export function buildLifeline(family: Family, analysis: Analysis, today: Date): LifelineData {
  const startYear = today.getFullYear();
  const people: Member[] =
    family.household && family.household.length > 0
      ? family.household.map((m) => ({ name: m.name, role: m.role, age: m.age }))
      : [{ name: family.name, role: "client", age: 40 }];

  const client = people.find((p) => p.role === "client") ?? people[0];
  const children = people.filter((p) => p.role === "child");

  const moments: Moment[] = [];

  // 1. Sección retirement
  const retSection = analysis.sections.find((s) => s.id === "retirement");
  let planEndAge = 91;
  let endYear = startYear + (planEndAge - client.age);
  let runOutAge: number | null = null;
  let runOutYear: number | null = null;
  let savingsRunOutMoment: Moment | null = null;

  if (retSection) {
    const planUntilStat = findStat(retSection.stats, "Plan runs until");
    if (planUntilStat && typeof planUntilStat.value === "number") {
      planEndAge = planUntilStat.value;
      endYear = startYear + (planEndAge - client.age);
    }

    // Jubilación de miembros: agrupa si dos adultos se jubilan el mismo año
    const retirements: { name: string; age: number; year: number }[] = [];
    for (const st of retSection.stats) {
      if (st.kind === "age" && typeof st.value === "number" && st.label.endsWith("retires at")) {
        const personName = st.label.slice(0, -"retires at".length).trim();
        const member =
          people.find((p) => p.name.toLowerCase() === personName.toLowerCase()) ?? client;
        const retYear = startYear + (st.value - member.age);
        retirements.push({ name: personName, age: st.value, year: retYear });
      }
    }

    const byRetYear = new Map<number, typeof retirements>();
    for (const r of retirements) {
      const list = byRetYear.get(r.year) ?? [];
      list.push(r);
      byRetYear.set(r.year, list);
    }

    for (const [year, list] of byRetYear.entries()) {
      if (list.length === 2) {
        const [p1, p2] = list;
        moments.push({
          id: `retire-${p1.name.toLowerCase()}-${p2.name.toLowerCase()}`,
          year,
          label: `${p1.name} and ${p2.name} retire`,
          detail: `At ${p1.age} and ${p2.age}.`,
          tone: "neutral",
          section: "retirement",
          cover: true,
        });
      } else {
        for (const p of list) {
          moments.push({
            id: `retire-${p.name.toLowerCase()}`,
            year,
            label: `${p.name} retires`,
            detail: `At ${p.age}.`,
            tone: "neutral",
            section: "retirement",
            cover: true,
          });
        }
      }
    }

    // Agotamiento de ahorros o duración hasta el final del plan
    const runOutAtStat = findStat(retSection.stats, "Savings run out at");
    const runOutTextStat = findStat(retSection.stats, "Savings run out");
    const leftAtEndStat = findStat(retSection.stats, "Savings left at end of plan");
    const coveredPct =
      retSection.headline && retSection.headline.kind === "pct" && typeof retSection.headline.value === "number"
        ? Math.round(retSection.headline.value * 100)
        : null;

    if (runOutAtStat && typeof runOutAtStat.value === "number") {
      runOutAge = runOutAtStat.value;
      runOutYear = startYear + (runOutAge - client.age);
      const covStr =
        coveredPct !== null
          ? `Guaranteed income then covers ${coveredPct}% of what you plan to spend.`
          : "";
      savingsRunOutMoment = {
        id: "savings-run-out",
        year: runOutYear,
        label: "Your savings run out",
        detail: covStr,
        tone: "bad",
        section: "retirement",
        cover: true,
        fixKey: "withdrawal",
      };
      moments.push(savingsRunOutMoment);
    } else if (runOutTextStat && String(runOutTextStat.value).toLowerCase() === "never") {
      const leftAmount =
        leftAtEndStat && typeof leftAtEndStat.value === "number"
          ? fmtMoney(leftAtEndStat.value)
          : "$0";
      moments.push({
        id: "money-lasts",
        year: endYear,
        label: `Your money lasts to ${planEndAge}`,
        detail: `Savings left at end of plan: ${leftAmount}.`,
        tone: "good",
        section: "retirement",
        cover: true,
      });
    }
  }

  // 2. Hijos menores de 18 años -> cumplen 18 (detail vacío para no repetir edades)
  for (const child of children) {
    if (child.age < 18) {
      const turn18Year = startYear + (18 - child.age);
      moments.push({
        id: `child-18-${child.name.toLowerCase()}`,
        year: turn18Year,
        label: `${child.name} turns 18`,
        detail: "",
        tone: "neutral",
        section: "family",
        cover: true,
      });
    }
  }

  // 3. Sondas (family.probes, campo truth)
  let colchonBadMoment: Moment | null = null;
  let seguroBadMoment: Moment | null = null;
  let destinoZeroMoment: Moment | null = null;

  for (const probe of family.probes) {
    const t = probe.truth;
    const section = PROBE_SECTION[probe.id] ?? "protection";

    if (probe.id === "tarjeta") {
      const payment = t.payment ?? 0;
      const val = t.value ?? 0;
      moments.push({
        id: "probe-tarjeta",
        year: startYear,
        label: "Your card payment",
        detail: `Of every ${fmtMoney(payment)} you pay, ${fmtMoney(val)} reduces the debt.`,
        tone: probe.tone,
        section,
        cover: true,
        fixKey: "card",
      });
    } else if (probe.id === "seguro") {
      const val = t.value ?? 0;
      const recYears = t.recommendedYears ?? 5;
      const durationStr =
        val < 1 ? `${Math.round(val * 12)} months` : fmtYears(val);
      const kidsStr =
        children.length > 0
          ? ` ${children.map((c) => `${c.name} is ${c.age}`).join(" and ")}.`
          : "";
      const m: Moment = {
        id: "probe-seguro",
        year: startYear,
        label: `If something happened to ${client.name}`,
        detail: `Life insurance would replace ${durationStr} of salary. Your plan recommends ${fmtYears(recYears)}.${kidsStr}`,
        tone: probe.tone,
        section,
        cover: true,
        fixKey: "life",
      };
      moments.push(m);
      if (probe.tone === "bad") seguroBadMoment = m;
    } else if (probe.id === "colchon") {
      const val = t.value ?? 0;
      const min = t.recommendedMin ?? 0;
      const max = t.recommendedMax ?? 0;
      const weeks = Math.round(val * 4.35);
      const durationStr =
        val < 2 ? `${val} months (${weeks} weeks)` : `${val} months`;
      const recStr = min === max ? `${min} months` : `${min}–${max} months`;
      const m: Moment = {
        id: "probe-colchon",
        year: startYear,
        label: "If your income stopped",
        detail: `Your cash would last ${durationStr}. Your plan recommends ${recStr}.`,
        tone: probe.tone,
        section,
        cover: true,
      };
      moments.push(m);
      if (probe.tone === "bad") colchonBadMoment = m;
    } else if (probe.id === "destino") {
      const totalSaved = t.totalSaved ?? 0;
      const toRet = t.toRetirement ?? 0;
      const m: Moment = {
        id: "probe-destino",
        year: startYear,
        label: "Saving for retirement",
        detail: `Of the ${fmtMoney(totalSaved)} you save each year, ${fmtMoney(toRet)} goes to retirement.`,
        tone: probe.tone,
        section,
        cover: true,
        fixKey: "savings",
      };
      moments.push(m);
      if (toRet === 0) destinoZeroMoment = m;
    }
  }

  // 4. Sección savings: stat "Left over each year" < 0 (sin fixKey)
  let deficitMoment: Moment | null = null;
  const savSection = analysis.sections.find((s) => s.id === "savings");
  if (savSection) {
    const leftOverStat = findStat(savSection.stats, "Left over each year");
    if (leftOverStat && typeof leftOverStat.value === "number" && leftOverStat.value < 0) {
      deficitMoment = {
        id: "savings-deficit",
        year: startYear,
        label: "You spend more than you earn",
        detail: `Your yearly cash flow is ${fmtMoney(leftOverStat.value)}.`,
        tone: "bad",
        section: "savings",
        cover: true,
      };
      moments.push(deficitMoment);
    }
  }

  // 5. Fechas en observations/lookInto/recommendations
  const { moments: dateMoments, cardPayoff } = extractDateMoments(
    analysis.sections,
    family.probes,
    startYear,
    today
  );
  moments.push(...dateMoments);

  // 6. Sección protection: gap de vida sin sonda (caso Johnson) y póliza umbrella
  const protSection = analysis.sections.find((s) => s.id === "protection");
  const hasSeguroProbe = family.probes.some((p) => p.id === "seguro");
  if (!hasSeguroProbe && protSection) {
    const lifeStat = findStat(protSection.stats, "Life insurance (you)");
    const recStat = findStat(protSection.stats, "Recommended minimum (you)");
    if (
      lifeStat &&
      typeof lifeStat.value === "number" &&
      recStat &&
      typeof recStat.value === "number" &&
      lifeStat.value < recStat.value
    ) {
      const kidsStr =
        children.length > 0
          ? ` ${children.map((c) => `${c.name} is ${c.age}`).join(" and ")}.`
          : "";
      const m: Moment = {
        id: "protection-life-gap",
        year: startYear,
        label: `If something happened to ${client.name}`,
        detail: `Life insurance would pay ${fmtMoney(lifeStat.value)}. Your plan recommends ${fmtMoney(recStat.value)}.${kidsStr}`,
        tone: "bad",
        section: "protection",
        cover: true,
        fixKey: "life",
      };
      moments.push(m);
      if (!seguroBadMoment) seguroBadMoment = m;
    }
  }

  if (protSection) {
    const umbStat = findStat(protSection.stats, "Umbrella policy");
    const umbRecStat = findStat(protSection.stats, "Umbrella recommended");
    if (
      umbStat &&
      typeof umbStat.value === "number" &&
      umbStat.value === 0 &&
      umbRecStat &&
      typeof umbRecStat.value === "number" &&
      umbRecStat.value > 0
    ) {
      moments.push({
        id: "protection-umbrella",
        year: startYear,
        label: "No umbrella liability policy",
        detail: `$0 umbrella coverage in place; your plan recommends ${fmtMoney(umbRecStat.value)}.`,
        tone: "bad",
        section: "protection",
        cover: false,
        fixKey: "umbrella",
      });
    }
  }

  // 7. Sección wealth: valor neto hoy (headline) y último punto de chart.points (cover: false)
  const wealthSection = analysis.sections.find((s) => s.id === "wealth");
  if (wealthSection) {
    if (wealthSection.headline && typeof wealthSection.headline.value === "number") {
      moments.push({
        id: "wealth-today",
        year: startYear,
        label: "Net worth today",
        detail: `Current net worth: ${fmtMoney(wealthSection.headline.value)}.`,
        tone: wealthSection.headline.value < 0 ? "bad" : "neutral",
        section: "wealth",
        cover: false,
      });
    }
    const lineChart =
      wealthSection.chart && wealthSection.chart.kind === "line"
        ? wealthSection.chart
        : retSection?.chart && retSection.chart.kind === "line"
          ? retSection.chart
          : null;
    if (lineChart && lineChart.points.length > 0) {
      const lastPt = lineChart.points[lineChart.points.length - 1];
      const ptAge = lastPt[0];
      const ptVal = lastPt[1];
      const ptYear = startYear + (ptAge - client.age);
      moments.push({
        id: "wealth-end",
        year: ptYear,
        label: `Projected net worth at ${ptAge}`,
        detail: `Everything you own minus what you owe, in today's dollars: ${fmtMoney(ptVal)}.`,
        tone: ptVal < 0 ? "bad" : "neutral",
        section: "wealth",
        cover: false,
      });
    }
  }

  // Ordenar momentos por año y mes
  moments.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return (a.month ?? 0) - (b.month ?? 0);
  });

  // 8. Fixes de analysis.score.moves
  const fixes: Fix[] = analysis.score.moves.map((m) => ({
    title: m.title,
    action: m.action,
    effort: m.effort,
    scoreBefore: m.scoreBefore,
    scoreAfter: m.scoreAfter,
    fixKey: matchFixKey(m.title, m.action),
  }));

  const score = analysis.score.value;
  const scoreTogether = analysis.score.combined?.scoreAfter ?? null;

  // 9. Dots (una por Navidad desde este año si today < 25 dic hasta el año en que cumple planEndAge - 1)
  const isBeforeChristmas =
    today.getMonth() + 1 < 12 || (today.getMonth() + 1 === 12 && today.getDate() < 25);
  const firstChristmasYear = isBeforeChristmas ? startYear : startYear + 1;
  const lastChristmasYear = startYear + (planEndAge - 1 - client.age);
  const dots: ChristmasDot[] = [];

  for (let y = firstChristmasYear; y <= lastChristmasYear; y++) {
    let state: ChristmasDot["state"] = "ok";
    const cardStillUnpaid =
      cardPayoff !== null &&
      (y < cardPayoff.year || (y === cardPayoff.year && 12 < cardPayoff.month));

    if (runOutYear !== null && y >= runOutYear) {
      state = "no-savings";
    } else if (cardStillUnpaid) {
      state = "card";
    }
    dots.push({ year: y, state });
  }

  // 10. Lead (el golpe principal por orden de prioridad)
  // Prioridad: ahorros que se acaban > tarjeta con ≥ 5 años > colchón por debajo del mínimo > seguro por debajo > destino a 0 > gasto mayor que ingresos
  const cardBadMoment =
    moments.find((m) => m.id.startsWith("card-") && m.tone === "bad") ?? null;

  let lead: Moment | null = null;
  let leadTitle = "";
  let leadText = "";

  if (savingsRunOutMoment && runOutAge !== null && runOutYear !== null) {
    lead = savingsRunOutMoment;
    const christmasesWithoutSavings = planEndAge - runOutAge;
    leadTitle = `Your savings run out at ${runOutAge}.`;
    const others = people.filter((p) => p !== client);
    if (others.length > 0) {
      const delta = runOutYear - startYear;
      const othersText = others
        .map((p, idx) =>
          idx === 0 ? `${p.name} will be ${p.age + delta}` : `${p.name} ${p.age + delta}`
        )
        .join(" and ");
      leadText = `${othersText}. Then ${christmasesWithoutSavings} Christmases with no savings left.`;
    } else {
      leadText = `That's ${runOutYear}. Then ${christmasesWithoutSavings} Christmases with no savings left.`;
    }
  } else if (cardBadMoment && cardPayoff) {
    lead = cardBadMoment;
    const cardChristmases = dots.filter((d) => d.state === "card").length;
    const monthName = MONTH_NAMES[cardPayoff.month] ?? "";
    const delta = cardPayoff.year - startYear;
    const kidsOrOthers = children.length > 0 ? children : people.filter((p) => p !== client);
    const byThenStr =
      kidsOrOthers.length > 0
        ? ` By then ${kidsOrOthers
            .map((p, i) => (i === 0 ? `${p.name} is ${p.age + delta}` : `${p.name} ${p.age + delta}`))
            .join(" and ")}.`
        : "";
    leadTitle = `${cardChristmases} more Christmases paying this card.`;
    leadText = `At ${fmtMoney(cardPayoff.payment)} a month, it's paid off in ${monthName} ${cardPayoff.year}.${byThenStr}`;
  } else if (colchonBadMoment) {
    lead = colchonBadMoment;
    leadTitle = "Your cash cushion is below the safe minimum.";
    leadText = colchonBadMoment.detail;
  } else if (seguroBadMoment) {
    lead = seguroBadMoment;
    leadTitle = "Life insurance leaves your household exposed.";
    leadText = seguroBadMoment.detail;
  } else if (destinoZeroMoment) {
    lead = destinoZeroMoment;
    leadTitle = "$0 of your yearly savings goes to retirement.";
    leadText = destinoZeroMoment.detail;
  } else if (deficitMoment) {
    lead = deficitMoment;
    leadTitle = deficitMoment.label;
    leadText = deficitMoment.detail;
  } else {
    lead = moments[0] ?? null;
    leadTitle = `Your money lasts to ${planEndAge}.`;
    leadText = lead?.detail ?? "";
  }

  // 11. Asignar recomendaciones de analysis.recommendations a momentos malos sin move
  const recs: string[] = analysis.recommendations ?? [];
  const usedRecs = new Set<string>();

  const queue: Moment[] = [];
  if (lead && lead.tone === "bad") {
    const hasMove = lead.fixKey && fixes.some((f) => f.fixKey === lead.fixKey);
    if (!hasMove) queue.push(lead);
  }
  for (const m of moments) {
    if (m.tone === "bad" && m !== lead) {
      const hasMove = m.fixKey && fixes.some((f) => f.fixKey === m.fixKey);
      if (!hasMove) queue.push(m);
    }
  }

  for (const m of queue) {
    const regex = getRecKeywordRegex(m.fixKey);
    const found = recs.find((r) => !usedRecs.has(r) && regex.test(r));
    if (found) {
      usedRecs.add(found);
      m.recommendation = found;
    }
  }

  return {
    startYear,
    endYear,
    planEndAge,
    people,
    moments,
    dots,
    lead,
    leadTitle,
    leadText,
    fixes,
    score,
    scoreTogether,
  };
}
