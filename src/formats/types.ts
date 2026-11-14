import type { FC } from "react";
import type { Family, Probe } from "../data";

// Un formato es una forma distinta de enseñar EXACTAMENTE la misma información
// de una sonda: la pregunta, lo que respondió la persona, el valor real del plan
// y la frase de contexto (truthValue, revealContext). Solo cambia la representación.
export type FormatId = "directo" | "historia" | "futuro" | "visual";

export type RevealProps = {
  family: Family;
  probe: Probe;
  answer: number;
  index: number;
  total: number;
  // false en la galería final: se muestra ya en su estado final, sin animaciones.
  animate: boolean;
};

export type FormatDef = {
  id: FormatId;
  name: string;
  // Una línea para la pantalla "Tu formato" y para el selector final.
  tagline: string;
  Reveal: FC<RevealProps>;
  // Frase opcional encima de la pregunta, para que la pantalla de pregunta encaje con el formato.
  askFraming?: (family: Family, probe: Probe) => string | null;
};
