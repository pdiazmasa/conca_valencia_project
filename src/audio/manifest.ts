import raw from "../data/audio.manifest.json";
import type { Verdict } from "../data";

type Entry = { text: string; file?: string };
const entries = (raw as { entries: Record<string, Entry> }).entries;

export const questionKey = (family: string, probe: string) => `q:${family}:${probe}`;
export const planKey = (family: string, probe: string) => `plan:${family}:${probe}`;
export const verdictKey = (probe: string, verdict: Verdict) => `verdict:${probe}:${verdict}`;
export const coverKey = (family: string, i: number) => `cover:${family}:${i}`;
export const sectionKey = (family: string, section: string, i: number) => `sec:${family}:${section}:${i}`;
export const turnKey = (name: string, kind: "ask" | "results") => `turn:${name}:${kind}`;
export const compareIntroKey = () => `cmp:intro`;
export const compareKey = (probe: string, agree: boolean) => `cmp:${probe}:${agree ? "agree" : "differ"}`;

export type Clip = { key: string; text: string; url: string | null };

export function getClip(key: string): Clip | null {
  const e = entries[key];
  if (!e) return null;
  return { key, text: e.text, url: e.file ? `${import.meta.env.BASE_URL}audio/${e.file}` : null };
}
