import weah from "./families/weah.json";
import lewis from "./families/lewis.json";
import carter from "./families/carter.json";
import johnson from "./families/johnson.json";
import type { Family } from "./types";

export const FAMILIES: Family[] = [
  weah as Family,
  lewis as Family,
  carter as Family,
  johnson as Family,
];

export function getFamilyById(id: string): Family | undefined {
  return FAMILIES.find((family) => family.id === id);
}
