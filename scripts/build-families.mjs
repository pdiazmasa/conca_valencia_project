// Deduce, para cada familia, las 4 sondas (preguntas de intuición) a partir de los
// datos del plan de Sherpas y de las reglas del árbol. Todo se precalcula aquí:
// la app solo lee el JSON resultante (sin cálculos financieros en el cliente).
//
// Fuentes de datos:
//   --source=mcp    MCP de Sherpas (lee el token de SHERPAS_MCP_TOKEN en .env). Por defecto si hay token.
//   --source=files  JSON de cases/ del repo de partida (ruta como argumento o CASES_DIR).
//   --diagnose      Solo muestra herramientas y forma de las respuestas del MCP (sin tocar nada).
// El token NUNCA se escribe en el JSON ni llega al navegador.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "src", "data", "families.generated.json");

function loadEnv() {
  // Acepta .env y también .env.txt (Windows suele añadir la extensión .txt sin avisar).
  const f = [".env", ".env.txt"].map((n) => join(root, n)).find((n) => existsSync(n));
  if (!f) return;
  for (const line of readFileSync(f, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

process.on("uncaughtException", (e) => {
  console.error("\n✖ " + String(e?.message ?? e).split("\n")[0]);
  console.error("  Si el MCP no responde, puedes usar los JSON locales: npm run build:families -- --source=files <ruta/a/cases>");
  process.exit(1);
});

const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}`));
const diagnose = Boolean(flag("diagnose"));
const positional = argv.filter((a) => !a.startsWith("--"));
const token = process.env.SHERPAS_MCP_TOKEN;
const MCP_URL = process.env.SHERPAS_MCP_URL ?? "https://mcp-hackathon.sherpaswealth.com/mcp";
const source = flag("source")?.split("=")[1] ?? (token || diagnose ? "mcp" : "files");
const casesDir = resolve(positional[0] ?? process.env.CASES_DIR ?? join(root, "..", "hackathon-upv-2026", "cases"));

const SLUGS = ["timothy-melanie-weah", "michael-carter", "daniel-emily-johnson", "samantha-lewis"];

const get = (o, path) => path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);
const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

// Fuerza base de cada sonda (cuánto suele mover a la familia). Las sondas ligadas a
// un tope de la nota (tarjeta, seguro) pesan más; el colchón es la sonda suave.
const BASE = { colchon: 1, tarjeta: 2, ahorros: 3, destino: 2, seguro: 2, mezcla: 2, fiscal: 2 };

function buildFamily(slug, fh, inv) {
  const k = fh.key_metrics;
  const caps = (fh.score.caps_applied ?? []).map((c) => c.reason.toLowerCase());
  const adults = fh.case.household.filter((h) => h.role === "client" || h.role === "co-client");
  const surname = slug.split("-").pop();
  const lastName = surname[0].toUpperCase() + surname.slice(1);
  const name = `${adults.map((a) => a.first_name).join(" y ")} ${lastName}`;
  const client = adults.find((a) => a.role === "client");

  const candidates = [];
  const skipped = [];
  const add = (c) => candidates.push({ ...c, strength: round(c.strength, 2) });
  const skip = (id, why) => skipped.push({ id, why });

  // 3) COLCHÓN — siempre
  {
    const months = num(get(k, "facts.cash.monthsCovered.value"));
    const min = get(k, "ratios.emergencyFund.minRecommendedEFMonths");
    const max = get(k, "ratios.emergencyFund.maxRecommendedEFMonths");
    if (months === undefined) skip("colchon", "sin dato de meses de cobertura");
    else
      add({
        id: "colchon",
        question: "¿Cuántos meses podrías vivir con tu efectivo?",
        input: { min: 0, max: 36, step: 0.5, initial: 6, unit: "meses" },
        truth: { value: months, recommendedMin: min, recommendedMax: max },
        tone: months >= min ? "good" : "bad",
        strength: BASE.colchon,
        why: "siempre se activa (la dirección depende de los datos)",
      });
  }

  // 2) PAGO A LA TARJETA — deuda con interés alto
  {
    const cc = get(k, "ratios.creditCardDebt");
    const cards = fh.profile.liabilities.filter((l) => l.type === "PERSONAL_CREDIT_CARD" && l.balance > 0);
    const apr = cards.length ? Math.max(...cards.map((c) => c.interest_rate ?? 0)) : 0;
    const pay = num(cc?.monthlyPayment);
    const interest = num(cc?.paymentsEqualToInterest);
    if (!cc?.hasDebt || apr < 0.15 || !pay || interest === undefined) skip("tarjeta", "sin deuda de tarjeta con interés alto");
    else {
      const step = pay >= 300 ? 10 : 5;
      const capped = caps.some((c) => c.includes("revolving"));
      add({
        id: "tarjeta",
        question: `De cada ${pay} $ que pagas a la tarjeta, ¿cuánto reduce la deuda?`,
        input: { min: 0, max: pay, step, initial: Math.round(pay / 2 / step) * step, unit: "$" },
        truth: { value: round(pay - interest, 2), interest, payment: pay, apr, balance: cc.balance },
        tone: "bad",
        strength: BASE.tarjeta + (capped ? 1 : 0) + Math.min(cc.balance / 18000, 1) * 0.5,
        why: `tarjeta al ${round(apr * 100, 1)} % con ${cc.balance} $ de saldo${capped ? " y limita la nota" : ""}`,
      });
    }
  }

  // 1) FIN DE LOS AHORROS — mala noticia si se agotan, buena si no
  {
    const dep = get(k, "retirementAndOtherGoals.assetDepletion");
    const endAge = get(k, "retirementAndOtherGoals.clientProfile.endOfPlanAge");
    const runOut = num(dep?.ageWhenTheyRunOutOfLiquidAssets);
    const left = num(dep?.liquidAssetsAtEndOfPlan);
    if (runOut === undefined && (left === undefined || left <= 0)) skip("ahorros", "sin dato fiable de agotamiento");
    else {
      const depletes = runOut !== undefined;
      add({
        id: "ahorros",
        question: "¿A qué edad crees que se acabarían tus ahorros?",
        input: { min: 60, max: 100, step: 1, initial: 80, unit: "años" },
        truth: depletes ? { depletes: true, age: runOut, endOfPlanAge: endAge } : { depletes: false, liquidAtEnd: round(left), endOfPlanAge: endAge },
        tone: depletes ? "bad" : "good",
        strength: depletes ? BASE.ahorros + (endAge - runOut) / 20 : 1,
        why: depletes ? `se agotan a los ${runOut} (plan a ${endAge})` : "no se agotan: buena noticia",
      });
    }
  }

  // 4) DESTINO DEL AHORRO — ahorra, pero aporta poco a jubilación
  {
    const total = num(get(k, "ratios.savingsLevel.savingAmount"));
    const ret = num(get(k, "savingsAndExpenses.annualSavings.currentAnnualSavingsAtRetirementAccounts"));
    if (!total || ret === undefined) skip("destino", "sin dato de ahorro anual");
    else {
      const share = ret / total;
      if (share >= 0.25) skip("destino", `ya destina el ${round(share * 100)} % a jubilación`);
      else
        add({
          id: "destino",
          question: "De cada 100 $ que ahorras, ¿cuántos van a la jubilación?",
          input: { min: 0, max: 100, step: 5, initial: 50, unit: "$" },
          truth: { value: round(share * 100, 1), toRetirement: ret, totalSaved: total },
          tone: "bad",
          strength: BASE.destino + (1 - share) * 0.5,
          why: `${ret} $ de ${total} $ ahorrados al año van a jubilación`,
        });
    }
  }

  // 5) SEGURO EN AÑOS DE SUELDO — por debajo del mínimo recomendado
  {
    const li = get(k, "ratios.lifeInsurance");
    const key = (li?.clientCoverageKey ?? "").toLowerCase();
    const years = num(li?.clientCoverageOverIncome);
    if (years === undefined || !key.includes("under")) skip("seguro", "seguro en el nivel recomendado o sin dato");
    else {
      const capped = caps.some((c) => c.includes("mortality"));
      add({
        id: "seguro",
        question: "Si faltaras, ¿cuántos años de sueldo cubriría tu seguro de vida?",
        input: { min: 0, max: 10, step: 0.1, initial: 3, unit: "años de sueldo" },
        truth: { value: round(years, 2), coverage: li.clientCoverage, income: li.clientEarnedIncome, recommendedMin: li.recommendedClientMinCoverage },
        tone: "bad",
        strength: BASE.seguro + (capped ? 1 : 0) + Math.min(1 - li.clientCoverage / li.recommendedClientMinCoverage, 1) * 0.5,
        why: `cubre ${round(years, 1)} años de sueldo${capped ? " y limita la nota" : ""}`,
        neverFirst: true,
      });
    }
  }

  // 6) MEZCLA REAL DE INVERSIÓN — perfil declarado distinto del real
  {
    const g = get(inv, "key_metrics.performanceAnalysis.goalGroups")?.[0];
    const cur = num(g?.currentEquityPct);
    const tgt = num(g?.targetEquityPct);
    if (cur === undefined || tgt === undefined) skip("mezcla", "sin dato de mezcla actual y objetivo");
    else if (Math.abs(cur - tgt) < 0.1) skip("mezcla", "mezcla cercana a la del perfil");
    else
      add({
        id: "mezcla",
        question: "¿Qué % de tu inversión está en bolsa?",
        input: { min: 0, max: 100, step: 1, initial: 50, unit: "%" },
        truth: { value: round(cur * 100), targetPct: round(tgt * 100) },
        tone: "bad",
        strength: BASE.mezcla + Math.abs(cur - tgt) * 2,
        why: `${round(cur * 100)} % en bolsa frente al ${round(tgt * 100)} % de su perfil`,
      });
  }

  // 7) AHORRO FISCAL ESTIMADO — cifra del plan y cupo sin usar
  {
    const text = [inv.narrative && JSON.stringify(inv.narrative), fh.narrative && JSON.stringify(fh.narrative)].filter(Boolean).join(" ");
    const m = text.match(/(?:lower|cut|reduce)[^.$]{0,40}\btax by about \$([\d,]+)/i);
    if (!m) skip("fiscal", "el plan no trae cifra de ahorro fiscal por 401(k)");
    else {
      const value = Number(m[1].replace(/,/g, ""));
      add({
        id: "fiscal",
        question: "Si usaras todo el cupo de tu 401(k), ¿cuánto menos pagarías de impuestos este año?",
        input: { min: 0, max: 20000, step: 250, initial: 5000, unit: "$" },
        truth: { value, note: "Es un aplazamiento, no dinero gratis (estimación del plan)." },
        tone: "neutral",
        strength: BASE.fiscal + Math.min(value / 12000, 1) * 0.5,
        why: `el plan estima ${value} $/año de ahorro fiscal`,
      });
    }
  }

  // 8) ORDEN DE JUGADAS — todavía sin pantalla de ordenar: se anota, no se elige
  skip("orden", "pendiente: requiere pantalla de ordenar");

  // ---- Selección de 4 (reglas del árbol) ----
  const by = (id) => candidates.find((c) => c.id === id);
  const opener = by("colchon") ?? by("tarjeta") ?? [...candidates].sort((a, b) => a.strength - b.strength).find((c) => !c.neverFirst);
  let pool = candidates.filter((c) => c !== opener).sort((a, b) => b.strength - a.strength);
  let picked = [opener, ...pool.slice(0, 3)];
  const hasGood = (arr) => arr.some((c) => c.tone === "good");
  if (!hasGood(picked)) {
    const good = pool.filter((c) => c.tone === "good").sort((a, b) => b.strength - a.strength)[0];
    if (good) {
      // sustituye a la más débil que no sea la más fuerte
      const strongest = picked.slice(1).sort((a, b) => b.strength - a.strength)[0];
      const weakest = picked.slice(1).filter((c) => c !== strongest).sort((a, b) => a.strength - b.strength)[0];
      picked = picked.map((c) => (c === weakest ? good : c));
    }
  }
  const rest = picked.slice(1);
  const strongest = [...rest].sort((a, b) => b.strength - a.strength)[0];
  const others = rest.filter((c) => c !== strongest).sort((a, b) => a.strength - b.strength);
  // orden final: suave · menos fuerte · la más fuerte (en medio) · la siguiente
  const ordered = [opener, others[0], strongest, others[1]].filter(Boolean);

  return {
    id: slug,
    name,
    household: fh.case.household.map((h) => ({ name: h.first_name, role: h.role, age: h.age })),
    score: fh.score.published_score,
    probes: ordered.map(({ neverFirst, ...p }) => p),
    notSelected: candidates.filter((c) => !ordered.includes(c)).map((c) => ({ id: c.id, strength: c.strength })),
    skipped,
  };
}

// ---- Carga de datos ----
function fromFiles(slug) {
  const read = (n) => JSON.parse(readFileSync(join(casesDir, slug, n), "utf8"));
  return { fh: read("financial-health.json"), inv: read("investment-analysis.json") };
}

function parseToolResult(res, label) {
  const text = (res.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  if (res.isError) throw new Error(`${label}: el MCP devolvió un error: ${text.slice(0, 300)}`);
  if (res.structuredContent) return res.structuredContent;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: la respuesta no es JSON (empieza por: ${text.slice(0, 120)})`);
  }
}

const shape = (v, d = 0) =>
  Array.isArray(v) ? `[${v.length}] ${v[0] ? shape(v[0], d + 1) : ""}` : v && typeof v === "object" ? (d > 1 ? "{…}" : "{" + Object.keys(v).slice(0, 12).join(", ") + "}") : typeof v;

async function connectMcp() {
  if (!token) throw new Error("Falta SHERPAS_MCP_TOKEN. Créalo en la web de acceso del hackathon y ponlo en el archivo .env (ver .env.example).");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  const client = new Client({ name: "same-page", version: "0.2.0" });
  try {
    await client.connect(transport);
  } catch (e) {
    const msg = String(e?.message ?? e);
    const hint = /401|403|unauthor|forbidden/i.test(msg) ? " (¿token caducado? dura 72 h y cada login nuevo invalida el anterior)" : "";
    throw new Error(`No se pudo conectar al MCP: ${msg.split("\n")[0]}${hint}`);
  }
  return client;
}

async function fromMcp(client) {
  const list = parseToolResult(await client.callTool({ name: "list_cases", arguments: {} }), "list_cases");
  const arr = Array.isArray(list) ? list : (list.cases ?? Object.values(list).find(Array.isArray) ?? []);
  const ids = arr.map((c) => c.caseId ?? c.id ?? c.slug ?? c.case_id).filter(Boolean);
  const out = {};
  for (const slug of SLUGS) {
    const last = slug.split("-").pop();
    const id = ids.find((i) => i === slug) ?? ids.find((i) => String(i).toLowerCase().includes(last));
    if (!id) throw new Error(`list_cases no trae un caso para "${slug}". Ids recibidos: ${ids.join(", ") || "(ninguno)"}`);
    const part = async (name) => parseToolResult(await client.callTool({ name: "get_case", arguments: { caseId: id, part: name } }), `get_case ${id} ${name}`);
    out[slug] = { fh: await part("financial-health"), inv: await part("investment-analysis") };
  }
  return out;
}

if (diagnose) {
  const client = await connectMcp();
  const tools = await client.listTools();
  console.log("Herramientas:", tools.tools.map((t) => `${t.name}(${Object.keys(t.inputSchema?.properties ?? {}).join(", ")})`).join(" | "));
  const list = parseToolResult(await client.callTool({ name: "list_cases", arguments: {} }), "list_cases");
  console.log("list_cases →", shape(list));
  const arr = Array.isArray(list) ? list : (list.cases ?? Object.values(list).find(Array.isArray) ?? []);
  console.log("ids →", arr.map((c) => c.caseId ?? c.id ?? c.slug ?? c.case_id).join(", "));
  const id = arr[0]?.caseId ?? arr[0]?.id ?? arr[0]?.slug;
  if (id) {
    const fh = parseToolResult(await client.callTool({ name: "get_case", arguments: { caseId: id, part: "financial-health" } }), "get_case");
    console.log(`get_case(${id}, financial-health) →`, shape(fh));
  }
  await client.close();
  process.exit(0);
}

let loaded;
if (source === "mcp") {
  const client = await connectMcp();
  try {
    loaded = await fromMcp(client);
  } finally {
    await client.close();
  }
  console.log("Datos leídos del MCP de Sherpas.");
} else {
  loaded = Object.fromEntries(SLUGS.map((s) => [s, fromFiles(s)]));
  console.log(`Datos leídos de ${casesDir}`);
}

const families = SLUGS.map((s) => buildFamily(s, loaded[s].fh, loaded[s].inv));
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify({ source: source === "mcp" ? "MCP de Sherpas" : "SherpasEngineering/hackathon-upv-2026 (cases/)", families }, null, 2) + "\n");

for (const f of families) {
  console.log(`\n${f.name} (nota ${f.score})`);
  f.probes.forEach((p, i) => console.log(`  ${i + 1}. [${p.tone}] ${p.id} — ${p.why}`));
  console.log(`  fuera: ${[...f.notSelected.map((s) => s.id + " (elegible)"), ...f.skipped.map((s) => `${s.id}: ${s.why}`)].join(" | ")}`);
}
