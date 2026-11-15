import { useEffect, useRef, useState } from "react";

const STEPS = ["Reading your plan", "Comparing it with your answers", "Preparing your results"];

// Las cinco píldoras del logo (de delante a detrás), apiladas; cada una sube y baja un poco, una tras otra.
const BLUES = ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1e3a8a"];
const WAVE_MS = 1600; // duración de un ciclo de la ola (igual que en el CSS)
const WAVE_REST_MS = 1500; // instante del ciclo en que todas las píldoras están quietas
const FLY_MS = 800; // viaje del logo hasta su sitio arriba (igual que al abrir la app)

// Lleva el logo hasta cubrir exactamente al icono de arriba (traslación + escala), como al abrir la app.
function flyTo(el: SVGSVGElement, slot: Element) {
  const a = el.getBoundingClientRect();
  const b = slot.getBoundingClientRect();
  el.style.transformOrigin = "0 0";
  el.style.transition = `transform ${FLY_MS}ms cubic-bezier(0.65, 0, 0.25, 1)`;
  void el.getBoundingClientRect(); // fuerza el cálculo antes de cambiar el transform
  el.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width})`;
}

// Pantalla de carga corta antes del análisis. Los pasos son reales (lo siguiente que va a pasar), no una barra
// inventada. El logo del centro es el único que se ve (el de arriba se esconde); cuando acaban los pasos,
// espera a que la ola esté quieta, sube a su sitio y solo entonces se enseña el plan.
export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [landing, setLanding] = useState(false);
  const logoRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0); // el icono de arriba va con la página: se parte de arriba para que el viaje se vea
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const each = reduce ? 300 : 800;
    const stepsEnd = each * STEPS.length + 250;
    const timers: number[] = STEPS.map((_, i) => window.setTimeout(() => setStep(i + 1), each * (i + 1)));
    if (reduce) {
      timers.push(window.setTimeout(onDone, stepsEnd));
    } else {
      // El viaje empieza en el primer momento de calma de la ola después de acabar los pasos.
      const flyAt = WAVE_REST_MS + Math.max(0, Math.ceil((stepsEnd - WAVE_REST_MS) / WAVE_MS)) * WAVE_MS;
      timers.push(
        window.setTimeout(() => {
          const slot = document.querySelector(".brand-slot-sym");
          if (logoRef.current && slot) {
            setLanding(true);
            flyTo(logoRef.current, slot);
            timers.push(window.setTimeout(onDone, FLY_MS + 50));
          } else {
            onDone();
          }
        }, flyAt),
      );
    }
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className={`content loading${landing ? " is-landing" : ""}`} aria-live="polite">
      <svg ref={logoRef} className="loading-stack" viewBox="0 0 120 120" width="104" height="104" aria-hidden="true">
        {[4, 3, 2, 1, 0].map((k) => (
          <rect key={k} className="loading-pill" style={{ animationDelay: `${k * 0.14}s` }} x="26" y={74 - 13 * k} width="68" height="30" rx="15" fill={BLUES[k]} />
        ))}
      </svg>
      <ul className="loading-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? "done" : i === step ? "active" : ""}>
            <span className="loading-dot" aria-hidden="true">{i < step ? "✓" : ""}</span>
            {label}
          </li>
        ))}
      </ul>
    </main>
  );
}
