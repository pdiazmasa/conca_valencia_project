import type { FormatDef, FormatId } from "./types";
import { Directo } from "./Directo";
import { Historia } from "./Historia";
import { Futuro } from "./Futuro";
import { Visual } from "./Visual";

export const FORMATS: Record<FormatId, FormatDef> = {
  directo: {
    id: "directo",
    name: "Straight",
    tagline: "Clear numbers and a chart, straight to the point.",
    Reveal: Directo,
  },
  historia: {
    id: "historia",
    name: "Story",
    tagline: "Your plan told in cards, one idea at a time.",
    Reveal: Historia,
  },
  futuro: {
    id: "futuro",
    name: "Future you",
    tagline: "Your future self tells you how things are going.",
    Reveal: Futuro,
    askFraming: () => "Your future self wants to know what you think:",
  },
  visual: {
    id: "visual",
    name: "Visual",
    tagline: "Pictures you can understand at a glance.",
    Reveal: Visual,
  },
};

export const FORMAT_ORDER: FormatId[] = ["directo", "historia", "futuro", "visual"];

export type { FormatDef, FormatId, RevealProps } from "./types";
