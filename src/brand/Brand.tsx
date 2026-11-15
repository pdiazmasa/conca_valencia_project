import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./brand.css";

// Logo de Same Page. Al abrir, la forma sale de pie en el centro, se tumba, rebota y se despliega hacia
// arriba en azules; después "aterriza" (es el mismo elemento, no uno que desaparece y otro que aparece)
// como icono arriba, centrado (sin recuadro) y dentro de la página (se va al deslizar hacia abajo); el nombre se desvanece por el camino.
// Sale cada vez que se carga o recarga la página, se salta tocando o con Enter/Espacio/Escape, y sin animación si el sistema pide reducir movimiento.
// onLanded avisa cuando el logo ya está en su sitio (la app no enseña nada antes). away esconde el icono de arriba (lo usa la pantalla de carga).

const BLUES = ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1e3a8a"]; // de delante a detrás
const DOCK_AT = 3.3; // segundos hasta que empieza a viajar a la barra
const FLY_MS = 800;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeBack = (p: number, c1: number) => {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

type Pill = { x: number; y: number; w: number; h: number; rx: number; o: number };

// Geometría de las 5 píldoras en el instante t (s), en un viewBox de 120×120. El índice 0 es la de delante.
function geometry(t: number): Pill[] {
  const s = easeOut(clamp((t - 0.1) / 0.5));
  const lie = easeOut(clamp((t - 0.9) / 0.5));
  const w = (30 + 38 * lie) * (0.6 + 0.4 * s);
  const h = (68 - 38 * lie) * (0.6 + 0.4 * s);
  const cy = 89;
  const u = clamp((t - 1.4) / 0.75);
  const dy = -11 * Math.abs(Math.sin(u * Math.PI * 2)) * (1 - u); // rebote amortiguado
  const out: Pill[] = [{ x: 60 - w / 2, y: cy - h / 2 + dy, w, h, rx: Math.max(1, Math.min(w, h) / 2), o: s }];
  for (let k = 1; k <= 4; k++) {
    const p = clamp((t - (1.95 + (k - 1) * 0.11)) / 0.5);
    out.push({ x: 26, y: cy - 15 - 13 * k * easeBack(p, 1.2), w: 68, h: 30, rx: 15, o: Math.min(1, p * 3) });
  }
  return out;
}

function StackRects({ t }: { t: number }) {
  const g = geometry(t);
  return (
    <>
      {[4, 3, 2, 1, 0].map((k) => (
        <rect key={k} fill={BLUES[k]} x={g[k].x} y={g[k].y} width={g[k].w} height={g[k].h} rx={g[k].rx} opacity={g[k].o} />
      ))}
    </>
  );
}

// Pinta la forma en el instante t sin re-renderizar React (se llama en cada fotograma).
function paint(svg: SVGSVGElement, t: number) {
  const g = geometry(t);
  svg.querySelectorAll("rect").forEach((r, i) => {
    const p = g[4 - i];
    r.setAttribute("x", String(p.x));
    r.setAttribute("y", String(p.y));
    r.setAttribute("width", String(p.w));
    r.setAttribute("height", String(p.h));
    r.setAttribute("rx", String(p.rx));
    r.setAttribute("opacity", String(p.o));
  });
}

// Mueve un elemento hasta que cubre exactamente a su hueco en la barra (traslación + escala).
function fly(el: SVGSVGElement | HTMLElement, slot: Element) {
  const a = el.getBoundingClientRect();
  const b = slot.getBoundingClientRect();
  el.style.transformOrigin = "0 0";
  el.style.transition = `transform ${FLY_MS}ms cubic-bezier(0.65, 0, 0.25, 1)`;
  void el.getBoundingClientRect(); // fuerza el cálculo antes de cambiar el transform
  el.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width})`;
}

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Brand({ onLanded, away = false }: { onLanded?: () => void; away?: boolean }) {
  const [phase, setPhase] = useState<"play" | "dock" | "done">(() => (reducedMotion() ? "done" : "play"));
  const symRef = useRef<SVGSVGElement>(null);
  const wordRef = useRef<HTMLParagraphElement>(null);
  const slotSym = useRef<SVGSVGElement>(null);

  const dock = useCallback(() => setPhase((p) => (p === "play" ? "dock" : p)), []);

  // Animación: la forma se recalcula en cada fotograma.
  useEffect(() => {
    if (phase !== "play") return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      if (symRef.current) paint(symRef.current, t);
      if (wordRef.current) wordRef.current.style.opacity = String(clamp((t - 2.5) / 0.5));
      if (t >= DOCK_AT) dock();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") dock();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, dock]);

  // Viaje arriba: primero se deja la forma en su estado final (por si se saltó), luego aterriza.
  useLayoutEffect(() => {
    if (phase !== "dock") return;
    if (symRef.current) paint(symRef.current, 99);
    if (symRef.current && slotSym.current) fly(symRef.current, slotSym.current);
    const word = wordRef.current;
    if (word) {
      // El nombre se desvanece mientras el icono sube: se fija la opacidad de ahora y se anima hasta 0.
      word.style.opacity = getComputedStyle(word).opacity;
      void word.offsetWidth;
      word.style.transition = "opacity 0.6s ease";
      word.style.opacity = "0";
    }
    const id = window.setTimeout(() => setPhase("done"), FLY_MS + 50);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Cuando el logo ya está en su sitio, la app puede enseñar su contenido.
  useEffect(() => {
    if (phase === "done") onLanded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <>
      {phase !== "done" && (
        <div className={`brand-stage is-${phase}`} onClick={dock} aria-hidden="true">
          <svg ref={symRef} className="brand-sym" viewBox="0 0 120 120" width="230" height="230">
            <StackRects t={0} />
          </svg>
          <p ref={wordRef} className="brand-word">
            same page
          </p>
        </div>
      )}
      <div className={`brand-pill${phase === "done" ? " is-done" : ""}${away ? " is-away" : ""}`} role="img" aria-label="Same Page">
        <svg ref={slotSym} className="brand-slot-sym" viewBox="0 0 120 120" aria-hidden="true">
          <StackRects t={99} />
        </svg>
      </div>
    </>
  );
}
