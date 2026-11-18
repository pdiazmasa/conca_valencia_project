import {
  formatStat,
  formatValue,
  peopleOf,
  revealContext,
  truthValue,
  type Analysis,
  type Family,
  type Probe,
  type Section,
  type Stat,
} from "../data";
import type { PageProps, RevealProps } from "./types";
import { plainMove } from "../dashboard/widgets";
import "./report.css";

// Marca del documento: icono de Same Page (las 5 píldoras del logo) × Sherpas.
function ReportBrand() {
  const blues = ["#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa"];
  return (
    <div className="rpt-brand" aria-label="Same Page × Sherpas">
      <svg viewBox="0 0 120 120" width="22" height="22" aria-hidden="true">
        {blues.map((c, i) => (
          <rect key={c} x="26" y={22 + i * 13} width="68" height="30" rx="15" fill={c} />
        ))}
        <rect x="26" y="74" width="68" height="30" rx="15" fill="#93c5fd" />
      </svg>
      <span className="rpt-brand-name">Same Page</span>
      <span className="rpt-brand-x">×</span>
      <span className="rpt-brand-name rpt-brand-sherpas">sherpas</span>
    </div>
  );
}

// Pie de cada hoja: de dónde salen las cifras y número de página.
function ReportFooter({ family, pageNo, pages }: { family: Family; pageNo: number; pages: number }) {
  return (
    <footer className="rpt-footer">
      <span>
        {family.name} · Every figure comes from your Sherpas plan. This is not a forecast or financial advice.
      </span>
      <span className="rpt-footer-page">
        Page {pageNo} of {pages}
      </span>
    </footer>
  );
}

function householdLine(family: Family): string {
  return peopleOf(family)
    .map((p) => `${p.name}, ${p.age}`)
    .join(" · ");
}

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

// Fecha del informe en inglés ("November 15, 2026").
function formatReportDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Marca en rojo (--ember) solo las cifras con tono negativo o descubiertas.
function isBadStat(stat: Stat): boolean {
  if (typeof stat.value === "number" && stat.value < 0) return true;
  if (stat.kind === "usd" && stat.value === 0 && /umbrella|insurance|policy/i.test(stat.label)) return true;
  return false;
}

function isBadScore(value: number, band: string): boolean {
  return value < 40 || /critical|vulnerable/i.test(band);
}

function PrintButton() {
  return (
    <button type="button" className="rpt-print-btn rpt-no-print" onClick={() => window.print()}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M4 6V2h8v4M4 12H2.5A1.5 1.5 0 0 1 1 10.5v-3A1.5 1.5 0 0 1 2.5 6h11A1.5 1.5 0 0 1 15 7.5v3a1.5 1.5 0 0 1-1.5 1.5H12M4 10h8v4H4v-4Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Download PDF
    </button>
  );
}

// Tabla comparativa de intuición vs. plan; se omite si no hay sondas (p. ej., en pareja).
function ProbesComparisonTable({ probes, answers }: { probes: Probe[]; answers: Record<string, number> }) {
  if (probes.length === 0) return null;
  return (
    <section className="rpt-block rpt-probes-block">
      <h2 className="rpt-section-heading">What you expected vs what your plan says</h2>
      <div className="rpt-table-wrap">
        <table className="rpt-table">
          <thead>
            <tr>
              <th>Question</th>
              <th className="rpt-num">Your answer</th>
              <th className="rpt-num">Your plan</th>
            </tr>
          </thead>
          <tbody>
            {probes.map((p) => {
              const userVal = answers[p.id] ?? p.input.initial;
              const real = truthValue(p);
              const realText = real === null ? "Never run out" : formatValue(p.input, real);
              const note = revealContext(p);
              return (
                <tr key={p.id}>
                  <td className="rpt-probe-q">
                    {p.question}
                    {note && <span className="rpt-probe-note">{note}</span>}
                  </td>
                  <td className="rpt-num">{formatValue(p.input, userVal)}</td>
                  <td className={`rpt-num ${p.tone === "bad" ? "rpt-bad" : ""}`}>{realText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Contenido documental de una sección (capítulo N de 6).
function SectionDocument({
  section,
  index,
  total,
  probes,
  answers,
}: {
  section: Section;
  index: number;
  total: number;
  probes: Probe[];
  answers: Record<string, number>;
}) {
  return (
    <article className="rpt-block">
      <header className="rpt-chapter-head">
        <p className="rpt-chapter-num">
          Section {index + 1} of {total}
        </p>
        <h1 className="rpt-chapter-title">{section.title}</h1>
        {section.headline && (
          <div className="rpt-lead">
            <span className="rpt-lead-label">{section.headline.label}</span>
            <span className={`rpt-lead-value ${isBadStat(section.headline) ? "rpt-bad" : ""}`}>
              {formatStat(section.headline.kind, section.headline.value)}
            </span>
          </div>
        )}
      </header>

      <ProbesComparisonTable probes={probes} answers={answers} />

      {section.stats.length > 0 && (
        <section className="rpt-block">
          <h2 className="rpt-section-heading">Key figures</h2>
          <div className="rpt-table-wrap">
            <table className="rpt-table rpt-table-kv">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="rpt-num">Value</th>
                </tr>
              </thead>
              <tbody>
                {section.stats.map((s) => (
                  <tr key={s.label}>
                    <td>{s.label}</td>
                    <td className={`rpt-num ${isBadStat(s) ? "rpt-bad" : ""}`}>
                      {formatStat(s.kind, s.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section.observations.length > 0 && (
        <section className="rpt-block">
          <h2 className="rpt-section-heading">What we found</h2>
          <div className="rpt-prose">
            {section.observations.map((obs, i) => (
              <p key={i}>{obs}</p>
            ))}
          </div>
        </section>
      )}

      {section.lookInto && (
        <section className="rpt-block">
          <h2 className="rpt-section-heading">What to look into</h2>
          <p className="rpt-callout">{section.lookInto}</p>
        </section>
      )}

      {section.recommendations && section.recommendations.length > 0 && (
        <section className="rpt-block">
          <h2 className="rpt-section-heading">What we recommend</h2>
          <ol className="rpt-ol">
            {section.recommendations.map((rec, i) => (
              <li key={i}>
                <span>{rec}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {section.table && (
        <section className="rpt-block">
          <h2 className="rpt-section-heading">Breakdown</h2>
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  {section.table.columns.map((col, idx) => (
                    <th key={col} className={idx > 0 ? "rpt-num" : ""}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => {
                      const text = typeof cell === "string" ? cell : formatStat(cell.kind, cell.value);
                      const bad = typeof cell !== "string" && cell.kind === "pct" && cell.value >= 0.15;
                      return (
                        <td key={cIdx} className={`${cIdx > 0 ? "rpt-num" : ""} ${bad ? "rpt-bad" : ""}`}>
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </article>
  );
}

// Portada del informe: cabecera documental, resumen de un vistazo, resumen ejecutivo,
// comparativa de respuestas (si procede), índice numerado 1–6 y recomendaciones.
function ReportCover({
  family,
  analysis,
  answers,
}: {
  family: Family;
  analysis: Analysis;
  answers: Record<string, number>;
}) {
  const { score } = analysis;
  // Extraemos hasta 4 cifras clave existentes de las entradillas de las secciones.
  const keyFigures: Stat[] = analysis.sections
    .map((sec) => sec.headline)
    .filter((h): h is Stat => h !== null)
    .slice(0, 4);

  // En pareja las sondas no se muestran como tabla individual.
  const isCouple = peopleOf(family).length > 1;
  const coverProbes = isCouple ? [] : family.probes;

  return (
    <div className="rpt-page">
      <div className="rpt-sheet">
        <header className="rpt-doc-header">
          <div className="rpt-doc-top">
            <ReportBrand />
            <PrintButton />
          </div>
          <div>
            <p className="rpt-kicker">Financial plan report</p>
            <h1 className="rpt-family-name">{family.name}</h1>
          </div>
          <dl className="rpt-docinfo">
            <div><dt>Date</dt><dd>{formatReportDate()}</dd></div>
            <div><dt>Household</dt><dd>{householdLine(family)}</dd></div>
            <div><dt>Source</dt><dd>Your Sherpas financial plan</dd></div>
          </dl>
        </header>

        <section className="rpt-block">
          <h2 className="rpt-section-heading">At a glance</h2>
          <div className="rpt-glance-score">
            <div className="rpt-score-main">
              <span className={`rpt-score-num ${isBadScore(score.value, score.band) ? "rpt-bad" : ""}`}>
                {score.value}
              </span>
              <span className="rpt-score-of">/ 100</span>
            </div>
            <span className={`rpt-score-band ${isBadScore(score.value, score.band) ? "rpt-bad" : ""}`}>
              {score.band}
            </span>
          </div>
          <p className="rpt-score-msg">{score.message}</p>

          {keyFigures.length > 0 && (
            <div className="rpt-table-wrap">
              <table className="rpt-table rpt-table-kv">
                <thead>
                  <tr>
                    <th>Key figure</th>
                    <th className="rpt-num">Plan value</th>
                  </tr>
                </thead>
                <tbody>
                  {keyFigures.map((fig) => (
                    <tr key={fig.label}>
                      <td>{fig.label}</td>
                      <td className={`rpt-num ${isBadStat(fig) ? "rpt-bad" : ""}`}>
                        {formatStat(fig.kind, fig.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {analysis.summary.length > 0 && (
          <section className="rpt-block">
            <h2 className="rpt-section-heading">Executive summary</h2>
            <div className="rpt-prose">
              {analysis.summary.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {score.pillars.length > 0 && (
          <section className="rpt-block">
            <h2 className="rpt-section-heading">Score by area</h2>
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th className="rpt-num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {score.pillars.map((p) => (
                    <tr key={p.name}>
                      <td>
                        {p.name}
                        <span className="rpt-meter" aria-hidden="true">
                          <i style={{ width: `${Math.max(0, Math.min(100, p.score))}%` }} className={p.score < 40 ? "is-bad" : ""} />
                        </span>
                      </td>
                      <td className={`rpt-num ${p.score < 40 ? "rpt-bad" : ""}`}>{p.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {score.moves.length > 0 && (
          <section className="rpt-block">
            <h2 className="rpt-section-heading">Steps that raise your score</h2>
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Effort</th>
                    <th className="rpt-num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {score.moves.map((m) => (
                    <tr key={m.title}>
                      <td>
                        {plainMove(m.title)}
                        {m.action && <span className="rpt-probe-note">{m.action}</span>}
                      </td>
                      <td>{m.effort}</td>
                      <td className="rpt-num">
                        {m.scoreBefore} to {m.scoreAfter}
                      </td>
                    </tr>
                  ))}
                  {score.combined && (
                    <tr className="rpt-row-total">
                      <td>All of them together</td>
                      <td />
                      <td className="rpt-num">
                        {score.value} to {score.combined.scoreAfter}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <ProbesComparisonTable probes={coverProbes} answers={answers} />

        {analysis.sections.length > 0 && (
          <section className="rpt-block">
            <h2 className="rpt-section-heading">Contents</h2>
            <ol className="rpt-contents">
              {analysis.sections.map((sec, idx) => (
                <li key={sec.id}>
                  <span className="rpt-contents-left">
                    <span className="rpt-contents-num">{idx + 1}.</span>
                    <span className="rpt-contents-title">{sec.title}</span>
                  </span>
                  {sec.headline && (
                    <span className="rpt-contents-stat">
                      {sec.headline.label}: {formatStat(sec.headline.kind, sec.headline.value)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {analysis.recommendations.length > 0 && (
          <section className="rpt-block">
            <h2 className="rpt-section-heading">Recommendations</h2>
            <ol className="rpt-ol">
              {analysis.recommendations.map((rec, i) => (
                <li key={i}>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Al imprimir desde la portada se incluyen las 6 secciones con salto de página antes de cada una */}
        <div className="rpt-print-only">
          {analysis.sections.map((sec, idx) => (
            <div key={sec.id} className="rpt-section-break">
              <SectionDocument
                section={sec}
                index={idx}
                total={analysis.sections.length}
                probes={[]}
                answers={answers}
              />
            </div>
          ))}
        </div>

        <ReportFooter family={family} pageNo={1} pages={analysis.sections.length + 1} />
      </div>
    </div>
  );
}

// Vista de página del formato Report (`informe`).
export function ReportPage({ family, analysis, page, answers }: PageProps) {
  if (page.kind === "cover") {
    return <ReportCover family={family} analysis={analysis} answers={answers} />;
  }

  const { section, probes } = page;
  const total = analysis.sections.length || 6;
  const foundIdx = analysis.sections.findIndex((s) => s.id === section.id);
  const index = foundIdx >= 0 ? foundIdx : 0;

  return (
    <div className="rpt-page">
      <div className="rpt-sheet rpt-section-break">
        <div className="rpt-running-head">
          <div className="rpt-running-meta">
            <ReportBrand />
            <span className="rpt-running-sub">
              {family.name} · Financial plan report · {formatReportDate()}
            </span>
          </div>
          <PrintButton />
        </div>

        <SectionDocument
          section={section}
          index={index}
          total={total}
          probes={probes}
          answers={answers}
        />

        <ReportFooter family={family} pageNo={index + 2} pages={total + 1} />
      </div>
    </div>
  );
}
