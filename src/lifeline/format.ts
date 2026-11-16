// Definición del formato "Life line" siguiendo el contrato FormatDef.
import type { FormatDef, FormatId } from "../formats/types";
import { LifelinePage } from "./LifelinePage";
import { LifelineReveal } from "./LifelineReveal";
// Los estilos van con el formato para que también carguen dentro de la app (no solo en lifeline.html).
import "./lifeline.css";

export const LIFELINE_FORMAT: FormatDef = {
  // Cast: "lifeline" aún no está en FormatId (formats/types.ts es de Pedro); así compila con o sin esa línea.
  id: "lifeline" as string as FormatId,
  name: "Life line",
  tagline: "Your plan, mapped onto your family's years.",
  Reveal: LifelineReveal,
  Page: LifelinePage,
};
