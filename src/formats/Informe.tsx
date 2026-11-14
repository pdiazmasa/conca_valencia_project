import { formatValue, revealContext, truthValue } from "../data";
import type { RevealProps } from "./types";

// Formato "Informe": una ficha sobria por sonda, tipo informe del plan.
export function Informe({ probe, answer }: RevealProps) {
  const real = truthValue(probe);
  return (
    <div className="informe">
      <p className="question-sm">{probe.question}</p>
      <dl className="informe-rows">
        <div><dt>You</dt><dd>{formatValue(probe.input, answer)}</dd></div>
        <div><dt>Your plan</dt><dd>{real === null ? "Never run out" : formatValue(probe.input, real)}</dd></div>
      </dl>
      <p className="context">{revealContext(probe)}</p>
    </div>
  );
}
