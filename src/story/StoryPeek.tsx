import { useEffect, useState, type ReactNode } from "react";

// Historias de antes y de después a los lados de la tarjeta, pequeñas y difuminadas,
// como Instagram en el ordenador. Solo en PC ancho: en móvil no se montan.
// Se pintan ANTES que la barra de progreso y la historia principal en el DOM: así el aviso
// "samepage:story" que lanza cada StoryEngine al montarse llega antes de que la barra escuche
// y no le cambia la cuenta (la que cuenta es la principal, que se monta la última).

export type Peek = { offset: number; label: string; node: ReactNode; onOpen?: () => void };

function useMinWidth(px: number) {
  const query = `(min-width: ${px}px)`;
  const [ok, setOk] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return ok;
}

export function StoryPeeks({ peeks }: { peeks: Peek[] }) {
  const near = useMinWidth(1100);
  const far = useMinWidth(1500);
  if (!near) return null;
  return (
    <>
      {peeks
        .filter((p) => Math.abs(p.offset) === 1 || far)
        .map((p) => (
          <div
            key={p.offset}
            className="sp-peek"
            style={{ ["--dir" as string]: Math.sign(p.offset), ["--far" as string]: Math.abs(p.offset) - 1 }}
          >
            <div className="sp-peek-card" aria-hidden="true" {...{ inert: "" }}>
              {p.node}
            </div>
            <button
              type="button"
              className="sp-peek-hit"
              tabIndex={-1}
              aria-label={p.label}
              onClick={p.onOpen}
              disabled={!p.onOpen}
            >
              <span className="sp-peek-avatar" aria-hidden="true">
                <svg viewBox="0 0 120 120">
                  {["#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa"].map((c, i) => (
                    <rect key={c} x="26" y={22 + i * 13} width="68" height="30" rx="15" fill={c} />
                  ))}
                  <rect x="26" y="74" width="68" height="30" rx="15" fill="#93c5fd" />
                </svg>
              </span>
              <span className="sp-peek-label">{p.label}</span>
            </button>
          </div>
        ))}
    </>
  );
}
