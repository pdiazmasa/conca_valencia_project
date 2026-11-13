// Las familias y sus 4 sondas se deducen de los datos del plan de Sherpas con
// `npm run build:families` (scripts/build-families.mjs) y se guardan precalculadas
// en families.generated.json. La app solo las lee: no calcula nada financiero.
import raw from "./data/families.generated.json";

export type ProbeInput = {
  min: number;
  max: number;
  step: number;
  initial: number;
  unit: "años" | "$" | "meses" | "%" | "años de sueldo";
};

export type Probe = {
  id: string;
  question: string;
  input: ProbeInput;
  tone: "good" | "bad" | "neutral";
  why: string;
};

export type Family = {
  id: string;
  name: string;
  score: number;
  probes: Probe[];
};

export const FAMILIES = (raw as unknown as { families: Family[] }).families;

export function formatValue(input: ProbeInput, v: number): string {
  const n = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: input.step < 1 ? 1 : 0,
  }).format(v);
  switch (input.unit) {
    case "$":
      return `${n} $`;
    case "%":
      return `${n} %`;
    case "años":
    case "años de sueldo":
      return `${n} años`;
    case "meses":
      return `${n} meses`;
  }
}
