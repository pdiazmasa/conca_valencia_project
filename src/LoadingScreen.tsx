import { useEffect, useState } from "react";

const STEPS = ["Reading your plan", "Comparing it with your answers", "Preparing your results"];

// Pantalla de carga corta antes del análisis. Los pasos son reales (lo siguiente que va a pasar),
// no una barra inventada.
export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const each = reduce ? 300 : 800;
    const timers = STEPS.map((_, i) => window.setTimeout(() => setStep(i + 1), each * (i + 1)));
    const done = window.setTimeout(onDone, each * STEPS.length + 250);
    return () => [...timers, done].forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="content loading" aria-live="polite">
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
