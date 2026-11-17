import { useTween } from "../charts/useTween";

// Cifra que cuenta desde 0 hasta su valor al aparecer. Solo anima lo que se ve:
// el valor final no cambia y los lectores de pantalla leen siempre el final, nunca el paso intermedio.
export function CountUp({
  value,
  duration = 800,
  delay = 120,
  format = (n: number) => String(Math.round(n)),
  signed = false,
}: {
  value: number;
  duration?: number;
  delay?: number;
  format?: (n: number) => string;
  signed?: boolean;
}) {
  const { v } = useTween(0, value, { duration, delay });
  const shown = format(v);
  const final = format(value);
  const prefix = signed && value >= 0 ? "+" : "";
  return (
    <>
      <span aria-hidden="true">{`${prefix}${shown}`}</span>
      <span className="dbx-sr-only">{`${prefix}${final}`}</span>
    </>
  );
}
