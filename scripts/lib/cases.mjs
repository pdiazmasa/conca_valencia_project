// Lectura de los casos de Sherpas: por MCP (token en .env / .env.txt) o desde cases/ en disco.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SLUGS = ["timothy-melanie-weah", "michael-carter", "daniel-emily-johnson", "samantha-lewis"];

export function loadEnv() {
  const f = [".env", ".env.txt"].map((n) => join(root, n)).find((n) => existsSync(n));
  if (!f) return;
  for (const line of readFileSync(f, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
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

export async function loadCases({ source, casesDir }) {
  if (source === "files") {
    return Object.fromEntries(
      SLUGS.map((slug) => {
        const read = (n) => JSON.parse(readFileSync(join(casesDir, slug, n), "utf8"));
        return [slug, { fh: read("financial-health.json"), inv: read("investment-analysis.json") }];
      })
    );
  }
  const token = process.env.SHERPAS_MCP_TOKEN;
  const url = process.env.SHERPAS_MCP_URL ?? "https://mcp-hackathon.sherpaswealth.com/mcp";
  if (!token) throw new Error("Falta SHERPAS_MCP_TOKEN. Ponlo en el archivo .env (ver .env.example).");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  const client = new Client({ name: "same-page", version: "0.2.0" });
  try {
    await client.connect(transport);
  } catch (e) {
    const msg = String(e?.message ?? e);
    const hint = /401|403|unauthor|forbidden/i.test(msg) ? " (¿token caducado? dura 72 h y cada login nuevo invalida el anterior)" : "";
    throw new Error(`No se pudo conectar al MCP: ${msg.split("\n")[0]}${hint}`);
  }
  try {
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
  } finally {
    await client.close();
  }
}
