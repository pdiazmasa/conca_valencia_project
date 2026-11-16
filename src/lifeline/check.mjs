// Script de comprobación para Node 25: valida la extracción de momentos en las 4 familias.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLifeline } from "./moments.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");

const familiesRaw = JSON.parse(
  fs.readFileSync(path.join(dataDir, "families.generated.json"), "utf8")
);
const analysisRaw = JSON.parse(
  fs.readFileSync(path.join(dataDir, "analysis.generated.json"), "utf8")
);

const today = new Date("2026-11-15");

for (const family of familiesRaw.families) {
  const analysis = analysisRaw[family.id];
  const data = buildLifeline(family, analysis, today);

  const dotCounts = data.dots.reduce(
    (acc, d) => {
      acc[d.state] = (acc[d.state] ?? 0) + 1;
      return acc;
    },
    { ok: 0, card: 0, "no-savings": 0 }
  );

  console.log(`\n=== ${family.name} (${family.id}) ===`);
  console.log(`LEAD TITLE: ${data.leadTitle}`);
  console.log(`LEAD TEXT:  ${data.leadText}`);
  console.log(
    `DOTS (${data.dots.length}): ok=${dotCounts.ok}, card=${dotCounts.card}, no-savings=${dotCounts["no-savings"]}`
  );
  console.log(`MOMENTS (${data.moments.length}):`);
  for (const m of data.moments) {
    const ym = m.month ? `${m.year}-${String(m.month).padStart(2, "0")}` : `${m.year}   `;
    const coverTag = m.cover ? "cover" : "sect ";
    const fixTag = m.fixKey ? ` [fix:${m.fixKey}]` : "";
    const detailPart = m.detail ? ` — ${m.detail}` : "";
    console.log(`  [${ym}] (${m.tone}) [${coverTag}/${m.section}] ${m.label}${detailPart}${fixTag}`);
  }
}
