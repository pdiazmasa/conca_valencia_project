import type { FC } from "react";
import type { Analysis, Family, Probe, Section } from "../data";

// Un formato es una forma distinta de enseñar la MISMA información: las sondas
// (intuición vs. plan) y el análisis completo. Solo cambia la representación.
export type FormatId = "wrapped" | "dashboard" | "audio" | "historia" | "futuro" | "visual" | "informe";

export type RevealProps = {
  family: Family;
  probe: Probe;
  answer: number;
  index: number;
  total: number;
  animate: boolean;
};

export type AskProps = { family: Family; probe: Probe };

// Una página del análisis: la portada (nota) o una sección con las sondas que le pertenecen.
export type AnalysisPage = { kind: "cover" } | { kind: "section"; section: Section; probes: Probe[] };

export type PageProps = {
  family: Family;
  analysis: Analysis;
  page: AnalysisPage;
  answers: Record<string, number>;
  Reveal: FC<RevealProps>;
};

export type FormatDef = {
  id: FormatId;
  name: string;
  tagline: string;
  Reveal: FC<RevealProps>;
  // Página del análisis; si falta se usa la de Dashboard.
  Page?: FC<PageProps>;
  Ask?: FC<AskProps>;
  askFraming?: (family: Family, probe: Probe) => string | null;
};
