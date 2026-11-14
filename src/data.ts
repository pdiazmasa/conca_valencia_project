// Las familias y sus 4 sondas se deducen de los datos del plan de Sherpas con
// `npm run build:families` (scripts/build-families.mjs) y se guardan precalculadas
// en families.generated.json. La app solo las lee: no calcula nada financiero.
import analysisRaw from "./data/analysis.generated.json";
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

export type Member = { name: string; role: string; age: number };

export type Family = {
  id: string;
  name: string;
  score: number;
  household?: Member[];
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

// Edad del cliente principal (role "client"); si no hay dato, la del primer miembro.
export function familyAge(f: Family): number | null {
  const m = f.household?.find((x) => x.role === "client") ?? f.household?.[0];
  return m ? m.age : null;
}

// ---- Análisis completo (precalculado con `npm run build:analysis`) ----
export type StatKind = "usd" | "pct" | "months" | "age" | "text";
export type Stat = { label: string; kind: StatKind; value: number | string };
export type Section = {
  id: string;
  title: string;
  headline: Stat | null;
  stats: Stat[];
  chart?:
    | { kind: "line"; title: string; xLabel: string; points: [number, number][]; markAge: number | null }
    | { kind: "bars"; title: string; items: { label: string; value: number; target?: number }[]; ratio?: boolean }
    | null;
  table?: { columns: string[]; rows: (string | { kind: StatKind; value: number })[][] } | null;
  observations: string[];
  lookInto?: string;
  recommendations?: string[];
  spoken: string[];
};
export type Analysis = {
  score: {
    value: number;
    band: string;
    message: string;
    pillars: { name: string; score: number; points: string }[];
    moves: { title: string; action: string; effort: string; scoreBefore: number; scoreAfter: number }[];
    combined: { moves: string[]; scoreAfter: number; note: string } | null;
    spoken: string[];
  };
  sections: Section[];
  summary: string[];
  recommendations: string[];
};
export const ANALYSIS = analysisRaw as unknown as Record<string, Analysis>;

// A qué sección del análisis pertenece cada sonda.
export const SECTION_OF_PROBE: Record<string, string> = {
  colchon: "protection",
  seguro: "protection",
  tarjeta: "debt",
  ahorros: "retirement",
  destino: "savings",
  fiscal: "savings",
  mezcla: "portfolio",
};

const usd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export function formatStat(kind: StatKind, v: number | string): string {
  if (typeof v === "string") return v;
  switch (kind) {
    case "usd":
      return v < 0 ? `-$${usd.format(Math.abs(v))}` : `$${usd.format(v)}`;
    case "pct": {
      const p = Math.round(v * 1000) / 10;
      return `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
    }
    case "months":
      return `${v} ${v === 1 ? "month" : "months"}`;
    case "age":
      return `${v} years old`;
    default:
      return String(v);
  }
}
