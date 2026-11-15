import type { FC } from "react";
import type { Analysis, Family, Person, Probe, Section } from "../data";

// Un formato es una forma distinta de enseñar la MISMA información: las sondas
// (intuición vs. plan) y el análisis completo. Solo hay cuatro: Wrapped (<30), Dashboard (30–54), Audio (55+) e Informe.
export type FormatId = "wrapped" | "dashboard" | "audio" | "informe";

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

// Un aspecto cuando responden dos personas: lo que pensaba cada una, si coinciden y el plan.
// index/total: posición entre las sondas de todo el plan (la primera, index 0, abre con el saludo a la pareja).
export type CoupleRevealProps = {
  family: Family;
  probe: Probe;
  index: number;
  total: number;
  people: Person[];
  values: number[]; // respuesta de cada persona a esta pregunta
};

export type FormatDef = {
  id: FormatId;
  name: string;
  tagline: string;
  Reveal: FC<RevealProps>;
  // Página del análisis; si falta se usa la de Dashboard.
  Page?: FC<PageProps>;
  Ask?: FC<AskProps>;
};
