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

// ---- Personas del hogar (los adultos responden por turnos) ----
export type Person = { name: string; role: string; age: number };

export function peopleOf(f: Family): Person[] {
  const adults = (f.household ?? []).filter((m) => m.role === "client" || m.role === "co-client");
  return adults.length > 0 ? adults : [{ name: f.name, role: "client", age: 40 }];
}

// ---- Veredicto: cómo de lejos estaba la intuición de la realidad ----
// Se decide solo con la dirección y la distancia (sin la cifra), para que la voz pueda
// ser un clip precalculado por pregunta.
export type Verdict = "much_worse" | "worse" | "close" | "better" | "different";

// Para cada pregunta: ¿es bueno que la realidad sea MAYOR que lo esperado? null = ni bueno ni malo.
const BETTER_WHEN_REALITY_HIGHER: Record<string, boolean | null> = {
  colchon: true,
  tarjeta: true,
  ahorros: true,
  destino: true,
  seguro: true,
  fiscal: true,
  mezcla: null,
};

const CLOSE_GAP = 0.1; // ≤ 10 % del rango del deslizador = acierto
const FAR_GAP = 0.25; // > 25 % = "mucho"

export function verdictFor(p: Probe, answer: number): Verdict {
  const real = truthValue(p) ?? p.input.max; // "nunca se agota" = lo mejor posible
  const gap = (real - answer) / (p.input.max - p.input.min);
  if (Math.abs(gap) <= CLOSE_GAP) return "close";
  const higherIsGood = BETTER_WHEN_REALITY_HIGHER[p.id];
  if (higherIsGood === null || higherIsGood === undefined) return "different";
  const good = higherIsGood ? gap > 0 : gap < 0;
  if (good) return "better";
  return Math.abs(gap) > FAR_GAP ? "much_worse" : "worse";
}

export function agreeOn(p: Probe, a: number, b: number): boolean {
  return Math.abs(a - b) <= CLOSE_GAP * (p.input.max - p.input.min);
}

// Frases de la voz (sin cifras): una por pregunta y veredicto.
export const VERDICT_TEXT: Record<string, Partial<Record<Verdict, string>>> = {
  colchon: {
    close: "You guessed your cash cushion almost exactly.",
    better: "Good news: your cash cushion lasts longer than you thought.",
    worse: "Your cash cushion is a bit shorter than you thought.",
    much_worse: "Your cash cushion is much shorter than you thought.",
  },
  tarjeta: {
    close: "You guessed how much of each payment goes to the debt almost exactly.",
    better: "Good news: more of each payment goes to the debt than you thought.",
    worse: "A bit less of each payment goes to the debt than you thought.",
    much_worse: "Much less of each payment goes to the debt than you thought. The rest is interest.",
  },
  ahorros: {
    close: "You guessed how long your savings last almost exactly.",
    better: "Good news: your savings last longer than you thought.",
    worse: "Your savings run out a bit sooner than you thought.",
    much_worse: "Your savings run out much sooner than you thought.",
  },
  destino: {
    close: "You guessed how much of your savings goes to retirement almost exactly.",
    better: "Good news: more of your savings goes to retirement than you thought.",
    worse: "A bit less of your savings goes to retirement than you thought.",
    much_worse: "Much less of your savings goes to retirement than you thought.",
  },
  seguro: {
    close: "You guessed your life insurance cover almost exactly.",
    better: "Good news: your life insurance covers more years than you thought.",
    worse: "Your life insurance covers a few fewer years than you thought.",
    much_worse: "Your life insurance covers many fewer years than you thought.",
  },
  mezcla: {
    close: "You guessed your mix of investments almost exactly.",
    different: "Your mix of investments is different from what you expected.",
  },
  fiscal: {
    close: "You guessed the tax saving almost exactly.",
    better: "Good news: you could save more on taxes than you thought.",
    worse: "You could save a bit less on taxes than you thought.",
    much_worse: "You could save much less on taxes than you thought.",
  },
};

// ---- Pareja: qué pasa en cada aspecto cuando responden dos personas ----
// Se decide con las dos respuestas y el plan; nunca nombra a quién acertó (no hay marcador entre ellos).
export type CoupleOutcome = "both_right" | "agree_better" | "agree_worse" | "agree_different" | "one_right" | "none_right";

export function coupleOutcome(p: Probe, a: number, b: number): CoupleOutcome {
  const close = (v: number) => verdictFor(p, v) === "close";
  if (close(a) && close(b)) return "both_right";
  if (agreeOn(p, a, b)) {
    const v = verdictFor(p, (a + b) / 2);
    if (v === "close") return "both_right";
    if (v === "better") return "agree_better";
    if (v === "worse" || v === "much_worse") return "agree_worse";
    return "agree_different";
  }
  return close(a) || close(b) ? "one_right" : "none_right";
}

// Resultados posibles de una pregunta (para generar solo los clips que pueden salir).
export function coupleOutcomesFor(probeId: string): CoupleOutcome[] {
  const v = VERDICT_TEXT[probeId] ?? {};
  const base: CoupleOutcome[] = ["both_right", "agree_different", "one_right", "none_right"];
  return v.better ? [...base, "agree_better", "agree_worse"] : base;
}

// Tema de cada pregunta, para las frases de pareja.
const TOPIC: Record<string, string> = {
  colchon: "your cash cushion",
  tarjeta: "paying down your card",
  ahorros: "how long your savings last",
  destino: "saving for retirement",
  seguro: "life insurance",
  mezcla: "your investment mix",
  fiscal: "taxes",
};

export function coupleText(probeId: string, outcome: CoupleOutcome): string {
  const t = TOPIC[probeId] ?? "this one";
  switch (outcome) {
    case "both_right": return `On ${t}, you both got it about right.`;
    case "agree_better": return `On ${t}, you saw it the same way, and the news is better than you both thought.`;
    case "agree_worse": return `On ${t}, you saw it the same way, and it is tougher than you both thought. Worth tackling together.`;
    case "agree_different": return `On ${t}, you agree with each other, but the plan says something different.`;
    case "one_right": return `On ${t}, you see it differently, and one of you is close to the plan.`;
    case "none_right": return `On ${t}, you see it differently, and the plan differs from both guesses.`;
  }
}

export const coupleIntroText = (people: Person[]) => `${people.map((p) => p.name).join(" and ")}, let's compare what each of you thought.`;

export const turnText = (name: string) => `${name}, it's your turn to answer.`;
