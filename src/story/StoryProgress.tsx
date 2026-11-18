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

  // En PC, las flechas del teclado pasan de tarjeta aunque la historia no tenga el foco
  // (si lo tiene, ya lo hace el propio StoryEngine y no hay que repetirlo).
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest(".ws-stage") || el?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      tapStory(e.key === "ArrowLeft" ? "prev" : "next");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const partial = tick && tick.n > 0 ? (tick.idx + 1) / tick.n : 0;

  return (
    <>
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
    {/* Flechas a los lados de la tarjeta, como Spotify Wrapped en PC. En móvil no se ven (story.css). */}
    <button type="button" className="sp-story-nav is-prev" aria-label="Previous card" onClick={() => tapStory("prev")}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <button type="button" className="sp-story-nav is-next" aria-label="Next card" onClick={() => tapStory("next")}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    </>
  );
}

// Hace lo mismo que tocar la tarjeta en el lado izquierdo (atrás) o derecho (adelante).
// Así se reutiliza toda la lógica del StoryEngine de Wrapped sin tocarlo.
function tapStory(dir: "prev" | "next") {
  // Solo la historia principal (las de los lados, StoryPeek, también tienen .ws-stage).
  const stage = document.querySelector<HTMLElement>(".content.is-story .reveal-slot .ws-stage");
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  const x = dir === "prev" ? r.left + 4 : r.right - 4;
  stage.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: r.top + r.height / 2 }));
}
