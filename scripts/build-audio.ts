// Genera las voces del formato "Audio" con ElevenLabs a través del proxy de Sherpas
// (POST /v1/audio/speech, compatible con OpenAI) y guarda un manifest con los textos.
//
// Qué se locuta (todo en inglés, "según tu plan"):
//   q:    la pregunta de cada sonda
//   verdict: veredicto cualitativo por sonda (nunca dice el número del usuario)
//   turn: "Juan, responde" (hogares con 2 adultos)
//   couple: saludo a la pareja y una frase por aspecto (coinciden/difieren y cómo está el plan)
//   plan: lo que dice el plan + su contexto, por familia y sonda
//
// Uso:
//   npm run build:audio -- --dry-run        cuenta clips y caracteres, NO llama a la API
//   npm run build:audio -- --limit=3        genera solo 3 clips nuevos (para probar la voz)
//   npm run build:audio                     genera los que falten (los ya hechos se reutilizan)
//   ELEVENLABS_API_KEY=…  (en .env) usa tu propia cuenta de ElevenLabs en lugar del proxy de Sherpas
//   --check   comprueba la clave contra el proxy (GET /models) sin generar nada ni gastar
//   --yes     confirma un gasto estimado superior a 0,50 $
//   --force   regenera todo aunque exista
//   --prune   borra de public/audio los mp3 que el manifest ya no usa (p. ej. de una voz anterior)
//   --only=q|verdict|turn|couple|plan|sec   limita el tipo de clip (sec = portada y secciones del análisis)
//
// La clave del equipo (SHERPAS_AI_KEY o IA_TOKEN en .env / .env.txt) solo la usa este script:
// no se escribe en ningún archivo ni llega al navegador.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ANALYSIS, FAMILIES, VERDICT_TEXT, coupleIntroText, coupleOutcomesFor, coupleText, peopleOf, revealContext, truthValue, turnText, type Probe } from "../src/data";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const audioDir = join(root, "public", "audio");
const manifestFile = join(root, "src", "data", "audio.manifest.json");

function loadEnv() {
  const f = [".env", ".env.txt"].map((n) => join(root, n)).find((n) => existsSync(n));
  if (!f) return;
  for (const line of readFileSync(f, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const argv = process.argv.slice(2);
const has = (n: string) => argv.some((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const val = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const dry = has("dry-run");
const limit = val("limit") ? Number(val("limit")) : Infinity;
const only = val("only");
const force = has("force");

const BASE = (process.env.SHERPAS_AI_BASE ?? "https://llm-hackathon.sherpaswealth.com/v1").replace(/\/$/, "");
const KEY = process.env.SHERPAS_AI_KEY ?? process.env.TEAM_KEY ?? process.env.IA_TOKEN;
const MODEL = process.env.AUDIO_MODEL ?? "eleven-flash-v2.5";
// Voz por defecto: "Rachel", voz nativa en inglés de ElevenLabs. Una voz en español leyendo inglés suena mal:
// usa siempre una voz nativa en inglés (AUDIO_VOICE=<voice_id> en .env).
const VOICE = process.env.AUDIO_VOICE ?? "21m00Tcm4TlvDq8ikWAM";
// Opción B: cuenta propia de ElevenLabs (p. ej. el plan gratis para estudiantes). Si ELEVENLABS_API_KEY existe,
// se habla directamente con ElevenLabs y NO se gasta el presupuesto de ElevenLabs de Sherpas.
const EL_KEY = process.env.ELEVENLABS_API_KEY;
const EL_MODEL = MODEL.replace(/[-.]/g, "_"); // eleven-flash-v2.5 → eleven_flash_v2_5
const LANGUAGE = process.env.AUDIO_LANGUAGE; // opcional, p. ej. "en": se envía como language_code
const PRICE_PER_1K = MODEL === "eleven-flash-v2.5" ? 0.04 : 0.08; // $ por 1.000 caracteres (README de Sherpas)

process.on("uncaughtException", (e) => {
  console.error("\n✖ " + String((e as Error)?.message ?? e).split("\n")[0]);
  process.exit(1);
});

// ---------- Textos ----------
// A la voz le mandamos los números ESCRITOS en inglés ("six and a half" en vez de "6.5"):
// con cifras, una voz o un modelo con acento español puede leerlas en español.
const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function intWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + intWords(n % 100) : "");
  if (n < 1e6) return intWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + intWords(n % 1000) : "");
  return intWords(Math.floor(n / 1e6)) + " million" + (n % 1e6 ? " " + intWords(n % 1e6) : "");
}
export function spokenize(text: string): string {
  // "$300" → "300 dollars" (la voz lee mejor el importe con la unidad detrás)
  const withUnits = text.replace(/\$(\d[\d,]*(?:\.\d+)?)/g, "$1 dollars");
  return withUnits.replace(/\d[\d,]*(?:\.\d+)?/g, (tok) => {
    const [i, d] = tok.replace(/,/g, "").split(".");
    const base = intWords(Number(i));
    return d ? `${base} point ${d.split("").map((c) => ONES[Number(c)]).join(" ")}` : base;
  });
}

const fmt = (p: Probe, v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: p.input.step < 1 ? 1 : 0 }).format(v);

function planSentence(p: Probe): string {
  const real = truthValue(p);
  const n = real === null ? "" : fmt(p, real);
  switch (p.id) {
    case "colchon": return `According to your plan, your cash would cover ${n} months.`;
    case "tarjeta": return `According to your plan, only ${n} dollars of every ${p.input.max} reduce the debt.`;
    case "ahorros": return p.truth.depletes ? `According to your plan, your savings run out at age ${p.truth.age}.` : "According to your plan, your savings never run out.";
    case "destino": return `According to your plan, ${n} dollars out of every 100 you save go toward retirement.`;
    case "seguro": return `According to your plan, your life insurance covers ${n} years of salary.`;
    case "mezcla": return `According to your plan, ${n} percent of your investments are in stocks.`;
    case "fiscal": return `According to your plan, you could pay about ${n} dollars less in taxes.`;
    default: return "According to your plan:";
  }
}

type Wanted = { key: string; kind: "q" | "verdict" | "turn" | "couple" | "plan" | "sec"; text: string };
const wanted: Wanted[] = [];
for (const f of FAMILIES) {
  for (const p of f.probes) {
    wanted.push({ key: `q:${f.id}:${p.id}`, kind: "q", text: p.question });
    wanted.push({ key: `plan:${f.id}:${p.id}`, kind: "plan", text: `${planSentence(p)} ${revealContext(p)}`.trim() });
  }
}

// Veredictos cualitativos (se eligen en la app comparando respuesta y plan).
const probeIds = new Set(FAMILIES.flatMap((f) => f.probes.map((p) => p.id)));
for (const id of probeIds) {
  for (const [verdict, text] of Object.entries(VERDICT_TEXT[id] ?? {})) {
    if (text) wanted.push({ key: `verdict:${id}:${verdict}`, kind: "verdict", text });
  }
}
// Parejas: aviso de turno, saludo a los dos y una frase por aspecto y resultado posible.
const coupleProbes = new Set<string>();
for (const f of FAMILIES) {
  const people = peopleOf(f);
  if (people.length < 2) continue;
  for (const person of people) wanted.push({ key: `turn:${person.name}`, kind: "turn", text: turnText(person.name) });
  wanted.push({ key: `couple:${f.id}:intro`, kind: "couple", text: coupleIntroText(people) });
  for (const p of f.probes) coupleProbes.add(p.id);
}
for (const id of coupleProbes) {
  for (const outcome of coupleOutcomesFor(id)) wanted.push({ key: `couple:${id}:${outcome}`, kind: "couple", text: coupleText(id, outcome) });
}

for (const f of FAMILIES) {
  const a = ANALYSIS[f.id];
  if (!a) continue;
  a.score.spoken.forEach((text, i) => wanted.push({ key: `cover:${f.id}:${i}`, kind: "sec", text }));
  for (const sec of a.sections) sec.spoken.forEach((text, i) => wanted.push({ key: `sec:${f.id}:${sec.id}:${i}`, kind: "sec", text }));
}

const fileFor = (text: string) => createHash("sha1").update(`${MODEL}|${VOICE}|${spokenize(text)}`).digest("hex").slice(0, 16) + ".mp3";
const onDisk = (file: string) => existsSync(join(audioDir, file));

const selected = wanted.filter((w) => !only || w.kind === only);
const uniqueTexts = new Map<string, string>(); // file -> text
for (const w of selected) uniqueTexts.set(fileFor(w.text), spokenize(w.text));
const missing = [...uniqueTexts].filter(([file]) => force || !onDisk(file));
const missingChars = missing.reduce((s, [, t]) => s + t.length, 0);
const cost = (missingChars / 1000) * PRICE_PER_1K;

function writeManifest() {
  const entries: Record<string, { text: string; file?: string }> = {};
  for (const w of wanted) {
    const file = fileFor(w.text);
    entries[w.key] = onDisk(file) ? { text: w.text, file } : { text: w.text };
  }
  mkdirSync(dirname(manifestFile), { recursive: true });
  writeFileSync(manifestFile, JSON.stringify({ model: MODEL, voice: VOICE, entries }, null, 1) + "\n");
}

console.log(`${EL_KEY ? "ElevenLabs DIRECTO (cuenta propia)" : "Proxy de Sherpas"} · modelo: ${MODEL} · voz: ${VOICE}${LANGUAGE ? ` · idioma: ${LANGUAGE}` : ""}`);
const count = (k: string) => wanted.filter((w) => w.kind === k).length;
console.log(`Clips pedidos: ${count("q")} preguntas, ${count("plan")} del plan, ${count("sec")} del análisis, ${count("verdict")} de veredicto, ${count("turn")} de turno, ${count("couple")} de pareja (${uniqueTexts.size} únicos).`);
console.log(`Pendientes de generar: ${missing.length} (${missingChars} caracteres) con ${MODEL} → coste estimado ${cost.toFixed(2)} $ de los 1,40 $ de ElevenLabs del equipo.`);

function prune() {
  if (!existsSync(audioDir)) return;
  const used = new Set(selectedAll.map((w) => fileFor(w.text)));
  let n = 0;
  for (const f of readdirSync(audioDir)) if (f.endsWith(".mp3") && !used.has(f)) { unlinkSync(join(audioDir, f)); n++; }
  console.log(`Prune: ${n} mp3 sin uso borrados de public/audio.`);
}
const selectedAll = wanted;

if (has("check") && EL_KEY) {
  const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": EL_KEY } });
  console.log(`ElevenLabs directo: ${r.status} ${r.statusText}`);
  if (!r.ok) console.log((await r.text()).replace(EL_KEY, "***").slice(0, 300));
  process.exit(r.ok ? 0 : 1);
}

if (has("check")) {
  if (!KEY) throw new Error("No hay clave: pon TEAM_KEY, SHERPAS_AI_KEY o IA_TOKEN en .env / .env.txt.");
  console.log(`Clave encontrada (${KEY.length} caracteres${KEY.startsWith("sk-") ? ", empieza por sk-" : ""}). Probando ${BASE}/models …`);
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${KEY}` } });
  const body = (await r.text()).replace(KEY, "***").slice(0, 300);
  console.log(`Respuesta: ${r.status} ${r.statusText}\n${body}`);
  process.exit(r.ok ? 0 : 1);
}

if (dry) {
  mkdirSync(audioDir, { recursive: true });
  if (has("prune")) prune();
  writeManifest();
  console.log("Dry run: no se ha llamado a la API. Manifest de textos actualizado.");
  process.exit(0);
}

if (!KEY && !EL_KEY) throw new Error("Falta la clave del equipo: pon TEAM_KEY (o SHERPAS_AI_KEY / IA_TOKEN) en .env / .env.txt.");
if (cost > 0.5 && !has("yes") && Number.isFinite(limit) === false) {
  throw new Error(`El gasto estimado (${cost.toFixed(2)} $) supera 0,50 $. Repite con --yes si estás seguro, o prueba antes con --limit=3.`);
}

mkdirSync(audioDir, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synth(text: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = EL_KEY
      ? await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ text, model_id: EL_MODEL, ...(LANGUAGE ? { language_code: LANGUAGE } : {}) }),
        })
      : await fetch(`${BASE}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, response_format: "mp3", ...(LANGUAGE ? { language_code: LANGUAGE } : {}) }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = (await res.text()).slice(0, 200);
    if (res.status === 401) throw new Error(`${EL_KEY ? "ElevenLabs" : "El proxy"} respondió 401 al generar audio: ${body.replace(KEY ?? "", "***").replace(EL_KEY ?? "", "***")}  (prueba \`npm run build:audio -- --check\` para saber si es la clave o la voz/modelo)`);
    if (res.status === 402 || res.status === 403) throw new Error(`ElevenLabs rechazó la petición (${res.status}); puede que se haya agotado el presupuesto de 1,40 $. ${body}`);
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * attempt;
      console.log(`  ${res.status}, reintento ${attempt}/5 en ${Math.round(wait / 1000)} s…`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Error ${res.status} al generar audio: ${body}`);
  }
  throw new Error("Demasiados reintentos al generar audio.");
}

const todo = missing.slice(0, limit);
let done = 0;
let next = 0;
let lastStart = 0;
const GAP_MS = 1300; // ≈46 peticiones/min, bajo el límite de 60
const CONCURRENCY = 3; // el límite es 4 simultáneas

async function worker() {
  while (next < todo.length) {
    const i = next++;
    const wait = lastStart + GAP_MS - Date.now();
    lastStart = Math.max(Date.now(), lastStart + GAP_MS);
    if (wait > 0) await sleep(wait);
    const [file, text] = todo[i];
    writeFileSync(join(audioDir, file), await synth(text));
    done++;
    if (todo.length <= 10) console.log(`  ${file} ← "${text}"`);
    if (done % 20 === 0 || done === todo.length) {
      console.log(`  ${done}/${todo.length} clips`);
      writeManifest();
    }
  }
}

try {
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
} finally {
  if (has("prune")) prune();
  writeManifest();
}
console.log(`Listo: ${done} clips nuevos. Quedan ${missing.length - done} por generar.`);
