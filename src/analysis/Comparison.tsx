import { agreeOn, formatValue, truthValue } from "../data";
import type { CompareProps } from "../formats/types";

// Comparación por defecto: qué respondió cada persona, dónde coinciden y qué dice el plan.
export function Comparison({ family, analysis, people, answers }: CompareProps) {
  const [a, b] = [answers[0] ?? {}, answers[1] ?? {}];
  const rows = family.probes.map((p) => {
    const x = a[p.id] ?? p.input.initial;
    const y = b[p.id] ?? p.input.initial;
    return { p, x, y, agree: agreeOn(p, x, y), real: truthValue(p) };
  });
  const agreed = rows.filter((r) => r.agree).length;
  const move = analysis.score.moves[0];
  return (
    <div className="a-section">
      <div>
        <h1 className="a-title">{people.map((p) => p.name).join(" & ")}</h1>
        <p className="eyebrow" style={{ marginTop: 12 }}>You agree on</p>
        <p className="stat-value">
          {agreed}
          <span className="stat-unit">of {rows.length}</span>
        </p>
      </div>
      <ul className="cmp-list">
        {rows.map(({ p, x, y, agree, real }) => (
          <li key={p.id} className="card">
            <div className="card-head">
              <p className="eyebrow">{p.question}</p>
              <span className={`badge ${agree ? "badge-solid" : "badge-outline"}`}>{agree ? "Agree" : "Differ"}</span>
            </div>
            <dl className="informe-rows">
              <div><dt>{people[0].name}</dt><dd>{formatValue(p.input, x)}</dd></div>
              <div><dt>{people[1].name}</dt><dd>{formatValue(p.input, y)}</dd></div>
              <div><dt>Your plan</dt><dd>{real === null ? "Never run out" : formatValue(p.input, real)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      {move && (
        <section className="card">
          <p className="eyebrow">Sherpas suggests starting with</p>
          <p className="cmp-move"><b>{move.title}.</b> {move.action}</p>
        </section>
      )}
    </div>
  );
}
