// Provisional: las familias y la selección de sondas son marcadores de posición.
// Cuando conectemos el MCP de Sherpas, las 4 sondas por familia saldrán de las
// reglas del árbol (puerta de datos, suave al abrir, la más fuerte en medio).

export type Probe = {
  id: string;
  question: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  unit: "años" | "$" | "meses" | "%" | "años de sueldo";
};

export const PROBES: Record<string, Probe> = {
  colchon: {
    id: "colchon",
    question: "¿Cuántos meses podrías vivir con tu efectivo?",
    min: 0,
    max: 36,
    step: 0.5,
    initial: 6,
    unit: "meses",
  },
  tarjeta: {
    id: "tarjeta",
    question: "De cada 300 $ que pagas a la tarjeta, ¿cuánto reduce la deuda?",
    min: 0,
    max: 300,
    step: 10,
    initial: 150,
    unit: "$",
  },
  ahorros: {
    id: "ahorros",
    question: "¿A qué edad crees que se acabarían tus ahorros?",
    min: 60,
    max: 100,
    step: 1,
    initial: 80,
    unit: "años",
  },
  destino: {
    id: "destino",
    question: "De cada 100 $ que ahorras, ¿cuántos van a la jubilación?",
    min: 0,
    max: 100,
    step: 5,
    initial: 50,
    unit: "$",
  },
  seguro: {
    id: "seguro",
    question: "Si faltaras, ¿cuántos años de sueldo cubriría tu seguro de vida?",
    min: 0,
    max: 10,
    step: 0.1,
    initial: 3,
    unit: "años de sueldo",
  },
  mezcla: {
    id: "mezcla",
    question: "¿Qué % de tu inversión está en bolsa?",
    min: 0,
    max: 100,
    step: 1,
    initial: 50,
    unit: "%",
  },
  fiscal: {
    id: "fiscal",
    question:
      "Si usaras todo el cupo de tu 401(k), ¿cuánto menos pagarías de impuestos este año?",
    min: 0,
    max: 20000,
    step: 250,
    initial: 5000,
    unit: "$",
  },
};

export type Family = { id: string; name: string; probes: string[] };

export const FAMILIES: Family[] = [
  { id: "weah", name: "Weah", probes: ["colchon", "tarjeta", "mezcla", "fiscal"] },
  { id: "lewis", name: "Lewis", probes: ["colchon", "ahorros", "destino", "seguro"] },
  { id: "carter", name: "Carter", probes: ["tarjeta", "destino", "ahorros", "seguro"] },
  { id: "johnson", name: "Johnson", probes: ["colchon", "tarjeta", "destino", "fiscal"] },
];

export function formatValue(p: Probe, v: number): string {
  const n = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: p.step < 1 ? 1 : 0,
  }).format(v);
  switch (p.unit) {
    case "$":
      return `${n} $`;
    case "%":
      return `${n} %`;
    case "años":
      return `${n} años`;
    case "meses":
      return `${n} meses`;
    case "años de sueldo":
      return `${n} años`;
  }
}
