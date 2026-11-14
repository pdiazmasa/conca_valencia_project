import { StatTile, SectionChart, SectionTable, Observations } from "../analysis/AnalysisBlocks";
import { formatStat } from "../data";
import type { PageProps } from "./types";

// Página del análisis por defecto (la usan Dashboard y los demás formatos).
export function DashboardPage({ family, analysis, page, answers, Reveal }: PageProps) {
  if (page.kind === "cover") {
    const s = analysis.score;
    return (
      <div className="a-cover">
        <div>
          <p className="eyebrow">Your financial health</p>
          <p className="stat-value">
            {s.value}
            <span className="stat-unit">/ 100 · {s.band}</span>
          </p>
          <p className="context">{s.message}</p>
        </div>
        <section className="card">
          <p className="eyebrow">Score by area</p>
          <ul className="a-pillars bars">
            {s.pillars.map((p) => (
              <li key={p.name}>
                <div className="bar-head"><span>{p.name}</span><span>{p.score}</span></div>
                <div className="bar-track"><span className="bar-fill" style={{ width: `${p.score}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
        {s.moves.length > 0 && (
          <section className="card">
            <p className="eyebrow">Best next steps</p>
            <ol className="a-moves">
              {s.moves.map((m) => (
                <li key={m.title}><b>{m.title}.</b> {m.action}</li>
              ))}
            </ol>
            {s.combined && (
              <p className="context" style={{ marginTop: 12 }}>
                Doing {s.combined.moves.length === 1 ? "it" : "all of them"} could lift your score to {s.combined.scoreAfter}.
              </p>
            )}
          </section>
        )}
      </div>
    );
  }

  const { section, probes } = page;
  return (
    <div className="a-section">
      <div>
        <h1 className="a-title">{section.title}</h1>
        {section.headline && (
          <>
            <p className="eyebrow" style={{ marginTop: 12 }}>{section.headline.label}</p>
            <p className="stat-value">{formatStat(section.headline.kind, section.headline.value)}</p>
          </>
        )}
      </div>

      {probes.length > 0 && (
        <section className="card a-probes">
          {probes.map((p, i) => (
            <Reveal key={p.id} family={family} probe={p} answer={answers[p.id] ?? p.input.initial} index={i} total={probes.length} animate={true} />
          ))}
        </section>
      )}

      {section.stats.length > 0 && (
        <section className="card a-stats">
          {section.stats.map((s) => <StatTile key={s.label} stat={s} />)}
        </section>
      )}
      {section.chart && <section className="card"><SectionChart chart={section.chart} /></section>}
      {section.table && <section className="card"><SectionTable table={section.table} /></section>}
      {section.observations.length > 0 && (
        <section className="card"><Observations section={section} /></section>
      )}
    </div>
  );
}
