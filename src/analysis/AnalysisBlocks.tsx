import { useState } from "react";
import { formatStat, type Section, type Stat } from "../data";
import { LineChart, formatCompactUSD } from "../charts/LineChart";
import "./analysis.css";

export function StatTile({ stat, big = false }: { stat: Stat; big?: boolean }) {
  return (
    <div className={`stat-tile ${big ? "big" : ""}`}>
      <p className="eyebrow">{stat.label}</p>
      <p className={big ? "stat-value" : "stat-small"}>{formatStat(stat.kind, stat.value)}</p>
    </div>
  );
}

export function SectionChart({ chart }: { chart: NonNullable<Section["chart"]> }) {
  if (chart.kind === "line") {
    const points = chart.points.map(([x, y]) => ({ x, y }));
    return (
      <div className="a-chart">
        <p className="eyebrow">{chart.title}</p>
        <LineChart
          points={points}
          tone="neutral"
          formatX={(v) => `Age ${Math.round(v)}`}
          formatY={formatCompactUSD}
          markers={chart.markAge !== null ? [{ x: chart.markAge, label: "Savings run out" }] : undefined}
        />
      </div>
    );
  }
  const max = Math.max(...chart.items.map((i) => Math.max(i.value, i.target ?? 0)), 1);
  const fmt = (v: number) => formatStat(chart.ratio ? "pct" : "usd", v);
  return (
    <div className="a-chart">
      <p className="eyebrow">{chart.title}</p>
      <ul className="bars">
        {chart.items.map((i) => (
          <li key={i.label}>
            <div className="bar-head">
              <span>{i.label}</span>
              <span>
                {fmt(i.value)}
                {i.target !== undefined && <em> · target {fmt(i.target)}</em>}
              </span>
            </div>
            <div className="bar-track">
              <span className="bar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
              {i.target !== undefined && <span className="bar-target" style={{ left: `${(i.target / max) * 100}%` }} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SectionTable({ table }: { table: NonNullable<Section["table"]> }) {
  return (
    <table className="a-table">
      <thead>
        <tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {table.rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => <td key={j}>{typeof c === "string" ? c : formatStat(c.kind, c.value)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Observaciones del MCP: las 2 primeras siempre, el resto tras "Show more".
export function Observations({ section, initial = 2 }: { section: Section; initial?: number }) {
  const [open, setOpen] = useState(false);
  const all = section.observations;
  const shown = open ? all : all.slice(0, initial);
  return (
    <div className="a-obs">
      <ul>{shown.map((o, i) => <li key={i}>{o}</li>)}</ul>
      {open && section.recommendations && section.recommendations.length > 0 && (
        <>
          <p className="eyebrow">What to consider</p>
          <ul>{section.recommendations.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </>
      )}
      {open && section.lookInto && <p className="a-look">{section.lookInto}</p>}
      {(all.length > initial || section.lookInto || (section.recommendations?.length ?? 0) > 0) && (
        <button type="button" className="pill pill-outline" onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
