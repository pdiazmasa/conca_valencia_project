import { useEffect, useState } from "react";
import "./story.css";

// Barra de progreso tipo historias de Instagram para Wrapped.
// Una barra grande por página del análisis (portada y cada sección). La barra de la página actual
// se va llenando con cada tarjeta de esa historia: el StoryEngine de Wrapped avisa con el evento
// "samepage:story" ({ idx, n }) cada vez que cambia de tarjeta.

export type StoryTick = { idx: number; n: number };

export function StoryProgress({ total, current }: { total: number; current: number }) {
  // La pantalla del análisis se vuelve a montar en cada página, así que esto empieza de cero en cada una.
  const [tick, setTick] = useState<StoryTick | null>(null);

  useEffect(() => {
    const on = (e: Event) => setTick((e as CustomEvent<StoryTick>).detail);
    window.addEventListener("samepage:story", on);
    return () => window.removeEventListener("samepage:story", on);
  }, [current]);

  // Mientras se ve la historia, la barra del navegador del móvil se pinta de negro (theme-color).
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const prev = meta.content;
    meta.content = "#000000";
    return () => {
      meta.content = prev;
    };
  }, []);

  const partial = tick && tick.n > 0 ? (tick.idx + 1) / tick.n : 0;

  return (
    <div
      className="sp-story-progress"
      role="progressbar"
      aria-label="Story progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current + partial}
    >
      {Array.from({ length: total }, (_, i) => {
        const fill = i < current ? 1 : i === current ? partial : 0;
        return (
          <span key={i} className="sp-story-seg">
            <i style={{ transform: `scaleX(${fill})` }} />
          </span>
        );
      })}
    </div>
  );
}
