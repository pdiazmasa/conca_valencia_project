import { createContext, useContext } from "react";
import { agreeOn, coupleOutcome, coupleText, formatValue, revealContext, truthValue, type Person, type Probe } from "../data";
import { StatValue } from "../formats/Dashboard";
import type { CoupleRevealProps, RevealProps } from "../formats/types";

// Datos de la pareja para las páginas del análisis: quiénes son, qué respondió cada uno y en qué orden
// aparecen las sondas. Las páginas de cada formato no lo saben: reciben el adaptador como su "Reveal".
export type CoupleData = { people: Person[]; answers: Record<number, Record<string, number>>; order: string[] };
export const CoupleContext = createContext<CoupleData | null>(null);
export const useCouple = () => useContext(CoupleContext);
export const coupleValues = (c: CoupleData, probe: Probe) => c.people.map((_, i) => c.answers[i]?.[probe.id] ?? probe.input.initial);

const pct = (probe: Probe, v: number) => Math.min(100, Math.max(0, ((v - probe.input.min) / (probe.input.max - probe.input.min)) * 100));

// Lo que pensaba cada uno y lo que dice el plan, con una barra donde se ven las tres marcas.
export function CoupleFigures({ probe, people, values }: Pick<CoupleRevealProps, "probe" | "people" | "values">) {
  const real = truthValue(probe);
  return (
    <section className="card couple-figures">
      <dl className="informe-rows">
        {people.map((person, i) => (
          <div key={person.name}>
            <dt><span className={`couple-dot ${i === 0 ? "couple-dot-a" : "couple-dot-b"}`} aria-hidden="true" />{person.name}</dt>
            <dd>{formatValue(probe.input, values[i])}</dd>
          </div>
        ))}
        <div>
          <dt><span className={`couple-dot couple-dot-plan tone-${probe.tone}`} aria-hidden="true" />Your plan</dt>
          <dd>{real === null ? "Never run out" : formatValue(probe.input, real)}</dd>
        </div>
      </dl>
      <div className="summary-bar" aria-hidden="true">
        {values.map((v, i) => (
          <span key={i} className={`summary-mark ${i === 0 ? "summary-mark-you" : "summary-mark-b"}`} style={{ left: `${pct(probe, v)}%` }} />
        ))}
        {real !== null && <span className={`summary-mark summary-mark-plan tone-${probe.tone}`} style={{ left: `${pct(probe, real)}%` }} />}
      </div>
    </section>
  );
}

// Aspecto de pareja por defecto: opina uno, opina otro, si coinciden, y el plan.
export function CoupleReveal({ probe, people, values }: CoupleRevealProps) {
  const outcome = coupleOutcome(probe, values[0], values[1]);
  const agree = agreeOn(probe, values[0], values[1]);
  return (
    <div className="a-section couple">
      <p className="question-sm">{probe.question}</p>
      <div>
        <span className={`badge ${agree ? "badge-solid" : "badge-outline"}`}>{agree ? "You agree" : "You see it differently"}</span>
        <p className="context" style={{ marginTop: 12 }}>{coupleText(probe.id, outcome)}</p>
      </div>
      <CoupleFigures probe={probe} people={people} values={values} />
      <section className="card">
        <p className="eyebrow">The plan</p>
        <StatValue probe={probe} v={truthValue(probe)} className={`sm tone-${probe.tone}`} />
        <p className="context">{revealContext(probe)}</p>
      </section>
    </div>
  );
}

// Sustituye al "Reveal" de una persona cuando responden dos: mismo hueco en la página, con lo de los dos.
export function CoupleRevealAdapter({ family, probe }: RevealProps) {
  const c = useCouple();
  if (!c) return null;
  return <CoupleReveal family={family} probe={probe} index={c.order.indexOf(probe.id)} total={c.order.length} people={c.people} values={coupleValues(c, probe)} />;
}
