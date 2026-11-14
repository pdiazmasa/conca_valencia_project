// Las familias y sus 4 sondas se deducen de los datos del plan de Sherpas con
// `npm run build:families` (scripts/build-families.mjs) y se guardan precalculadas
// en families.generated.json. La app solo las lee: no calcula nada financiero.
import raw from "./data/families.generated.json";

export type ProbeInput = {
  min: number;
  max: number;
  step: number;
  initial: number;
  unit: "years" | "$" | "months" | "%" | "years of salary";
};

// Valor real según el plan. `value` es comparable con la respuesta del deslizador,
// salvo en "ahorros" cuando no se agotan (no hay edad que comparar).
export type Truth = {
  value?: number;
  depletes?: boolean;
  age?: number;
  endOfPlanAge?: number;
  liquidAtEnd?: number;
  series?: { x: number; y: number }[];
  recommendedMin?: number;
  recommendedMax?: number;
  recommendedYears?: number;
  interest?: number;
  payment?: number;
  apr?: number;
  balance?: number;
  toRetirement?: number;
  totalSaved?: number;
  coverage?: number;
  income?: number;
  targetPct?: number;
  note?: string;
};

export type Probe = {
  id: string;
  question: string;
  input: ProbeInput;
  truth: Truth;
  tone: "good" | "bad" | "neutral";
  why: string;
};

const money = (v: number) => `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)}`;

// Valor real a comparar con la respuesta, o null si no hay número comparable.
export function truthValue(p: Probe): number | null {
  if (p.id === "ahorros") return p.truth.depletes ? (p.truth.age ?? null) : null;
  return p.truth.value ?? null;
}

// Frase de contexto bajo la cifra real. Solo formatea datos del plan, no calcula.
export function revealContext(p: Probe): string {
  const t = p.truth;
  switch (p.id) {
    case "colchon":
      return `Recommended for you: between ${t.recommendedMin} and ${t.recommendedMax} months.`;
    case "tarjeta":
      return `The rest, ${money(t.interest ?? 0)}, goes to interest. Your card charges ${Math.round((t.apr ?? 0) * 1000) / 10}% and you owe ${money(t.balance ?? 0)}.`;
    case "ahorros":
      return t.depletes
        ? `Your plan runs until age ${t.endOfPlanAge}.`
        : `At age ${t.endOfPlanAge}, you'd still have ${money(t.liquidAtEnd ?? 0)} left.`;
    case "destino":
      return `You save ${money(t.totalSaved ?? 0)} a year; ${money(t.toRetirement ?? 0)} goes toward retirement.`;
    case "seguro":
      return `Your policy covers ${money(t.coverage ?? 0)}. Recommended minimum: ${money(t.recommendedMin ?? 0)}.`;
    case "mezcla":
      return `Your risk profile targets ${t.targetPct}% in stocks.`;
    case "fiscal":
      return t.note ?? "";
    default:
      return "";
  }
}

export type Family = {
  id: string;
  name: string;
  score: number;
  probes: Probe[];
};

export const FAMILIES = (raw as unknown as { families: Family[] }).families;

export function formatValue(input: ProbeInput, v: number): string {
  const n = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: input.step < 1 ? 1 : 0,
  }).format(v);
  switch (input.unit) {
    case "$":
      return `$${n}`;
    case "%":
      return `${n}%`;
    case "years":
      return `${n} years old`;
    case "years of salary":
      return `${n} years`;
    case "months":
      return `${n} months`;
  }
}
