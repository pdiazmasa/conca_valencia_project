import { useEffect, useRef, useState } from "react";
import { formatValue, revealContext, truthValue } from "../data";
import type { RevealProps } from "./types";
import "./futuro.css";

const toneLabel = { good: "Good news", bad: "Needs attention", neutral: "Fact" } as const;

export function Futuro({ family, probe, answer, animate }: RevealProps) {
  // N = probe.truth.endOfPlanAge si existe en cualquier sonda de la familia
  const endOfPlanAge = family.probes.find((p) => typeof p.truth?.endOfPlanAge === "number")?.truth.endOfPlanAge;
  const futureName = endOfPlanAge ? `You at age ${endOfPlanAge}` : "You, a few years from now";
  const futureAvatar = endOfPlanAge ? `${endOfPlanAge}` : "FUT";

  const contextText = revealContext(probe);
  const hasContext = Boolean(contextText && contextText.trim().length > 0);
  const maxStep = hasContext ? 3 : 2;

  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const shouldAnimate = animate && !prefersReducedMotion;

  // step: 0 = respuesta hoy, 1 = me preguntaste, 2 = realidad, 3 = contexto
  const [step, setStep] = useState<number>(() => (shouldAnimate ? 0 : maxStep));
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];

    if (!shouldAnimate) {
      setStep(maxStep);
      setIsTyping(false);
      return;
    }

    setStep(0);
    setIsTyping(false);

    const addTimeout = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timeoutsRef.current.push(id);
    };

    // Secuencia de conversación con indicador "escribiendo..." breve entre burbujas
    addTimeout(() => setIsTyping(true), 250);
    addTimeout(() => {
      setStep(1);
      setIsTyping(false);
    }, 800);

    addTimeout(() => setIsTyping(true), 1200);
    addTimeout(() => {
      setStep(2);
      setIsTyping(false);
    }, 1800);

    if (hasContext) {
      addTimeout(() => setIsTyping(true), 2200);
      addTimeout(() => {
        setStep(3);
        setIsTyping(false);
      }, 2800);
    }

    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, [probe.id, answer, shouldAnimate, maxStep, hasContext]);

  const handleSkip = () => {
    if (isTyping || step < maxStep) {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
      setStep(maxStep);
      setIsTyping(false);
    }
  };

  const real = truthValue(probe);
  const realText = real === null ? "Never run out" : formatValue(probe.input, real);
  const splitVal = real === null ? null : realText.match(/^(.*?)\s(\S.*)$/);

  const badgeToneClass =
    probe.tone === "bad" ? "badge-outline" : probe.tone === "good" ? "badge-solid" : "badge-soft";

  return (
    <div
      className={`futuro-card ${shouldAnimate ? "is-animated" : "is-static"}`}
      onClick={handleSkip}
    >
      <header className="futuro-header">
        <div className="futuro-header-main">
          <span className="futuro-header-avatar" aria-hidden="true">
            {futureAvatar}
          </span>
          <div className="futuro-header-text">
            <span className="futuro-header-name">{futureName}</span>
            <span className="futuro-header-sub">Future you</span>
          </div>
        </div>
        <span className={`badge badge-dot ${badgeToneClass}`}>
          {toneLabel[probe.tone]}
        </span>
      </header>

      <div className="futuro-chat" role="log" aria-live="polite">
        {/* Respuesta de hoy a la derecha */}
        <div className="futuro-group futuro-group-user">
          <span className="futuro-sender-tag">You (today)</span>
          <div className="futuro-row futuro-row-user">
            <div className="futuro-bubble futuro-bubble-user">
              I think {formatValue(probe.input, answer)}
            </div>
            <span className="futuro-avatar futuro-avatar-user" aria-label="You (today)">
              YOU
            </span>
          </div>
        </div>

        {/* Yo del futuro a la izquierda */}
        {(step >= 1 || isTyping) && (
          <div className="futuro-group futuro-group-future">
            <span className="futuro-sender-tag">{futureName}</span>
            <div className="futuro-row futuro-row-future">
              <span className="futuro-avatar futuro-avatar-future" aria-label={futureName}>
                {futureAvatar}
              </span>
              <div className="futuro-future-stack">
                {step >= 1 && (
                  <div className="futuro-bubble futuro-bubble-future">
                    You asked me: {probe.question}
                  </div>
                )}

                {step >= 2 && (
                  <div className="futuro-bubble futuro-bubble-future futuro-bubble-reality">
                    <p className="futuro-reality-label">The reality:</p>
                    <p className={`futuro-stat-value ${probe.tone === "bad" ? "tone-bad" : ""}`}>
                      {real === null ? (
                        <span className="futuro-stat-no-deplete">Never run out</span>
                      ) : splitVal ? (
                        <>
                          <span>{splitVal[1]}</span>
                          <span className="stat-unit">{splitVal[2]}</span>
                        </>
                      ) : (
                        <span>{realText}</span>
                      )}
                    </p>
                  </div>
                )}

                {step >= 3 && hasContext && (
                  <div className="futuro-bubble futuro-bubble-future">
                    {contextText}
                  </div>
                )}

                {isTyping && (
                  <div className="futuro-typing" role="status" aria-label={`${futureName} is typing`}>
                    <span className="futuro-dot" />
                    <span className="futuro-dot" />
                    <span className="futuro-dot" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
