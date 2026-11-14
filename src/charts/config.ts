import type { Probe } from "../data";
import type { RailBand, RailTick } from "./Rail";

// Referencias que dibuja cada sonda sobre la línea. Solo valores que ya vienen
// del plan en la misma unidad que el deslizador (sin cálculos en el cliente).
export function railExtras(p: Probe): { band?: RailBand; ticks?: RailTick[] } {
  const t = p.truth;
  switch (p.id) {
    case "colchon":
      return t.recommendedMin !== undefined && t.recommendedMax !== undefined
        ? { band: { from: t.recommendedMin, to: t.recommendedMax, label: "Recommended" } }
        : {};
    case "mezcla":
      return t.targetPct !== undefined ? { ticks: [{ value: t.targetPct, label: "Your profile" }] } : {};
    case "seguro":
      return t.recommendedYears !== undefined ? { ticks: [{ value: t.recommendedYears, label: "Minimum" }] } : {};
    case "ahorros":
      return t.endOfPlanAge !== undefined ? { ticks: [{ value: t.endOfPlanAge, label: "End of plan" }] } : {};
    default:
      return {};
  }
}
