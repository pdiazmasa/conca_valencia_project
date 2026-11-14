import type { FC } from "react";
import type { Analysis, Family, Person, Probe, Section } from "../data";

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

// Comparación entre las personas del hogar: respuestas de cada una frente a las de la otra y al plan.
export type CompareProps = {
  family: Family;
  analysis: Analysis;
  people: Person[];
  answers: Record<number, Record<string, number>>;
};

export type FormatDef = {
  id: FormatId;
  name: string;
  tagline: string;
  Reveal: FC<RevealProps>;
  // Página del análisis; si falta se usa la de Dashboard.
  Page?: FC<PageProps>;
  Ask?: FC<AskProps>;
  // Pantalla de comparación entre personas; si falta se usa la de Dashboard.
  Compare?: FC<CompareProps>;
  askFraming?: (family: Family, probe: Probe) => string | null;
};
