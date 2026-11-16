// Punto de entrada de desarrollo (lifeline.html): modo PREVIEW por defecto y modo ?app completo.
import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "../App";
import { ANALYSIS, FAMILIES, SECTION_OF_PROBE } from "../data";
import { FORMATS, FORMAT_ORDER, type FormatDef } from "../formats";
import { DashboardPage } from "../formats/DashboardPage";
import type { AnalysisPage } from "../formats/types";
import { LIFELINE_FORMAT } from "./format";
import { buildLifeline } from "./moments";
import "../styles.css";
import "./lifeline.css";

const EMPTY_ANSWERS: Record<string, number> = {};

// Life line ya está registrado en FORMATS; se mantiene la entrada explícita por si se prueba sin registrar.
const ALL_FORMATS: Record<string, FormatDef> = {
  ...FORMATS,
  lifeline: LIFELINE_FORMAT,
};

const PREVIEW_FORMAT_KEYS = Array.from(new Set(["lifeline", ...FORMAT_ORDER]));

function LifelinePreview({ debug }: { debug: boolean }): JSX.Element {
  const [familyId, setFamilyId] = useState<string>(FAMILIES[0].id);
  const [formatKey, setFormatKey] = useState<string>("lifeline");
  const [step, setStep] = useState<number>(0);

  const family = useMemo(
    () => FAMILIES.find((f) => f.id === familyId) ?? FAMILIES[0],
    [familyId]
  );
  const analysis = ANALYSIS[family.id];

  const pages: AnalysisPage[] = useMemo(() => {
    if (!analysis) return [];
    return [
      { kind: "cover" },
      ...analysis.sections.map(
        (section): AnalysisPage => ({
          kind: "section",
          section,
          probes: family.probes.filter((p) => SECTION_OF_PROBE[p.id] === section.id),
        })
      ),
    ];
  }, [family, analysis]);

  const safeStep = Math.min(step, Math.max(0, pages.length - 1));
  const page = pages[safeStep];
  const def = ALL_FORMATS[formatKey] ?? LIFELINE_FORMAT;
  const Page = def.Page ?? DashboardPage;

  const debugData = useMemo(
    () => (debug && analysis ? buildLifeline(family, analysis, new Date()) : null),
    [debug, family, analysis]
  );

  return (
    <div className="app">
      {/* Barra superior de desarrollo: familia, formato y páginas */}
      <header className="lfl-dev-bar">
        <div className="lfl-dev-controls">
          <select
            className="lfl-dev-select"
            aria-label="Select family"
            value={family.id}
            onChange={(e) => {
              setFamilyId(e.target.value);
              setStep(0);
            }}
          >
            {FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} (Score {f.score})
              </option>
            ))}
          </select>

          <select
            className="lfl-dev-select"
            aria-label="Select format"
            value={formatKey}
            onChange={(e) => setFormatKey(e.target.value)}
          >
            {PREVIEW_FORMAT_KEYS.map((k) => {
              const fDef = ALL_FORMATS[k];
              return (
                <option key={k} value={k}>
                  {fDef ? fDef.name : k}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            className="lfl-dev-pill"
            disabled={safeStep <= 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ← Prev
          </button>
          <button
            type="button"
            className="lfl-dev-pill"
            disabled={safeStep >= pages.length - 1}
            onClick={() => setStep((s) => Math.min(pages.length - 1, s + 1))}
          >
            Next →
          </button>
        </div>

        <nav className="lfl-dev-pages" aria-label="Analysis pages">
          {pages.map((p, idx) => {
            const label = p.kind === "cover" ? "Cover" : p.section.title;
            return (
              <button
                key={idx}
                type="button"
                className={`lfl-dev-pill ${idx === safeStep ? "lfl-dev-pill-active" : ""}`}
                onClick={() => setStep(idx)}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Marcado envolvente idéntico al de App.tsx en la pantalla de análisis */}
      {page && analysis && (
        <div key={`${family.id}-${formatKey}-${safeStep}`} className="screen dir-forward">
          <main className="content">
            <div className="progress" aria-hidden="true">
              {pages.map((_, i) => (
                <span key={i} className={i <= safeStep ? "on" : ""} />
              ))}
            </div>
            <div className="reveal-slot">
              <Page
                family={family}
                analysis={analysis}
                page={page}
                answers={EMPTY_ANSWERS}
                Reveal={def.Reveal}
              />
            </div>
            <div className="actions">
              <button
                type="button"
                className="pill pill-filled"
                onClick={() => setStep((s) => (s >= pages.length - 1 ? 0 : s + 1))}
              >
                {safeStep >= pages.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </main>
        </div>
      )}

      {/* Tabla de depuración con ?debug */}
      {debug && debugData && (
        <section className="lfl-debug-wrap" aria-label="Moments debug table">
          <table className="lfl-debug-table">
            <thead>
              <tr>
                <th className="lfl-debug-th">Year</th>
                <th className="lfl-debug-th">Month</th>
                <th className="lfl-debug-th">Label</th>
                <th className="lfl-debug-th">Tone</th>
                <th className="lfl-debug-th">Section</th>
                <th className="lfl-debug-th">Cover</th>
                <th className="lfl-debug-th">FixKey</th>
                <th className="lfl-debug-th">Source</th>
              </tr>
            </thead>
            <tbody>
              {debugData.moments.map((m) => (
                <tr key={m.id}>
                  <td className="lfl-debug-td">{m.year}</td>
                  <td className="lfl-debug-td">{m.month ?? "—"}</td>
                  <td className="lfl-debug-td">{m.label}</td>
                  <td className={`lfl-debug-td ${m.tone === "bad" ? "lfl-bad" : ""}`}>
                    {m.tone}
                  </td>
                  <td className="lfl-debug-td">{m.section}</td>
                  <td className="lfl-debug-td">{m.cover ? "true" : "false"}</td>
                  <td className="lfl-debug-td">{m.fixKey ?? "—"}</td>
                  <td className="lfl-debug-td">{m.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const searchParams = new URLSearchParams(window.location.search);
const isAppMode = searchParams.has("app");
const isDebugMode = searchParams.has("debug");

if (isAppMode) {
  (FORMATS as Record<string, FormatDef>).lifeline = LIFELINE_FORMAT;
  if (!(FORMAT_ORDER as string[]).includes("lifeline")) {
    (FORMAT_ORDER as string[]).push("lifeline");
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isAppMode ? <App /> : <LifelinePreview debug={isDebugMode} />}
  </React.StrictMode>
);
