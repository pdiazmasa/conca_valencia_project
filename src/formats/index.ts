import type { FormatDef, FormatId } from "./types";
import { Wrapped, WrappedPage } from "./Wrapped";
import { DashboardFull } from "../dashboard/DashboardFull";
import { Dashboard } from "./Dashboard";
import { Informe } from "./Informe";
import { AudioAsk, AudioPage, AudioReveal } from "./Audio";
import { LIFELINE_FORMAT } from "../lifeline/format";

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
  audio: {
    id: "audio",
    name: "Audio",
    tagline: "We read it out to you, nice and clear.",
    Reveal: AudioReveal,
    Page: AudioPage,
    Ask: AudioAsk,
  },
  informe: {
    id: "informe",
    name: "Report",
    tagline: "A plain written report of your plan.",
    Reveal: Informe,
  },
  lifeline: LIFELINE_FORMAT,
};

export const FORMAT_ORDER: FormatId[] = ["wrapped", "dashboard", "audio", "informe", "lifeline"];

// Formato por defecto según la edad: 0–29 Wrapped · 30–54 Dashboard · 55+ Audio.
export function formatForAge(age: number | null): FormatId {
  if (age === null) return "dashboard";
  if (age < 30) return "wrapped";
  if (age < 55) return "dashboard";
  return "audio";
}

export type { FormatDef, FormatId, RevealProps, AskProps } from "./types";
