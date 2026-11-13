import type { Family } from "../src/data/types";

export function extractNumbersFromText(text: string): { raw: string; value: number }[];
export function extractPlaceholders(text: string): string[];
export function validateFamily(family: Family): { ok: boolean; errors: string[] };
