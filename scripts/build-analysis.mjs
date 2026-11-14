// Precalcula el análisis completo de cada familia (portada, 6 secciones, textos del MCP y
// guion para Audio) y lo guarda en src/data/analysis.generated.json.
//   npm run build:analysis                          → lee del MCP (token en .env)
//   npm run build:analysis -- --source=files <ruta> → lee los JSON de cases/
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildAnalysis } from "./lib/analysis.mjs";
import { loadCases, loadEnv, root, SLUGS } from "./lib/cases.mjs";

loadEnv();
process.on("uncaughtException", (e) => {
  console.error("\n✖ " + String(e?.message ?? e).split("\n")[0]);
  process.exit(1);
});

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const source = argv.find((a) => a.startsWith("--source="))?.split("=")[1] ?? (process.env.SHERPAS_MCP_TOKEN ? "mcp" : "files");
const casesDir = resolve(positional[0] ?? process.env.CASES_DIR ?? join(root, "..", "hackathon-upv-2026", "cases"));

const loaded = await loadCases({ source, casesDir });
const out = {};
for (const slug of SLUGS) out[slug] = buildAnalysis(loaded[slug].fh, loaded[slug].inv);

const file = join(root, "src", "data", "analysis.generated.json");
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`Análisis de ${SLUGS.length} familias escrito en src/data/analysis.generated.json (${source === "mcp" ? "MCP" : casesDir}).`);
for (const slug of SLUGS) console.log(`  ${slug}: ${out[slug].sections.map((s) => s.id).join(", ")}`);
