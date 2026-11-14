import type { FormatDef, FormatId } from "./types";
import { Wrapped, WrappedPage } from "./Wrapped";
import { DashboardFull } from "../dashboard/DashboardFull";
import { Dashboard } from "./Dashboard";
import { Informe } from "./Informe";
import { Historia } from "./Historia";
import { Futuro } from "./Futuro";
import { Visual } from "./Visual";
import { AudioAsk, AudioCompare, AudioPage, AudioReveal } from "./Audio";

export const FORMATS: Record<FormatId, FormatDef> = {
  wrapped: {
    id: "wrapped",
    name: "Wrapped",
    tagline: "Your plan as a quick, swipeable recap.",
    Reveal: Wrapped,
    Page: WrappedPage,
  },
  dashboard: {
    id: "dashboard",
    name: "Dashboard",
    tagline: "Clear numbers and a chart, straight to the point.",
    Reveal: Dashboard,
    Page: DashboardFull,
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
  audio: {
    id: "audio",
    name: "Audio",
    tagline: "We read it out to you, nice and clear.",
    Reveal: AudioReveal,
    Page: AudioPage,
    Compare: AudioCompare,
    Ask: AudioAsk,
  },
  informe: {
    id: "informe",
    name: "Report",
    tagline: "A plain written report of your plan.",
    Reveal: Informe,
  },
};

export const FORMAT_ORDER: FormatId[] = ["wrapped", "dashboard", "audio", "historia", "futuro", "visual", "informe"];

// Formato por defecto según la edad: 0–29 Wrapped · 30–54 Dashboard · 55+ Audio.
export function formatForAge(age: number | null): FormatId {
  if (age === null) return "dashboard";
  if (age < 30) return "wrapped";
  if (age < 55) return "dashboard";
  return "audio";
}

export type { FormatDef, FormatId, RevealProps, AskProps } from "./types";
