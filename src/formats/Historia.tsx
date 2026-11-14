import { formatValue, revealContext, truthValue, type Probe } from "../data";
import type { RevealProps } from "./types";
import "./historia.css";

const toneLabel: Record<Probe["tone"], string> = {
  good: "Good news",
  bad: "Needs attention",
  neutral: "Fact",
};

export function Historia({ probe, answer, index, total, animate }: RevealProps) {
  const real = truthValue(probe);
  const context = revealContext(probe);
  const realText = real === null ? "Never run out" : formatValue(probe.input, real);
  const match = real === null ? null : realText.match(/^(.*?)\s(\S.*)$/);

  return (
    <article
      className={`historia-card ${animate ? "is-animated" : "is-static"}`}
      aria-label={`Story for question ${index + 1} of ${total}`}
    >
      {/* Barras de progreso finas estilo stories */}
      <div className="historia-stories" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="historia-story-track">
            <div
              className={`historia-story-fill ${
                i < index ? "is-filled" : i === index ? "is-current" : ""
              }`}
            />
          </div>
        ))}
      </div>

      <div className="historia-beats">
        {/* Beat 1: Pregunta n de total + la pregunta */}
        <section className="historia-beat historia-beat-1">
          <p className="historia-eyebrow">
            Question {index + 1} of {total}
          </p>
          <h2 className="historia-question">{probe.question}</h2>
        </section>

        {/* Beat 2: Tú dijiste + respuesta grande */}
        <section className="historia-beat historia-beat-2">
          <p className="historia-eyebrow">You said</p>
          <p className="historia-answer">{formatValue(probe.input, answer)}</p>
        </section>

        {/* Beat 3: Pero tu plan dice + valor real enorme y debajo revealContext */}
        <section className="historia-beat historia-beat-3">
          <div className="historia-beat-header">
            <p className="historia-eyebrow">But your plan says</p>
            <span className={`historia-badge historia-badge-${probe.tone}`}>
              <span className="historia-badge-dot" />
              {toneLabel[probe.tone]}
            </span>
          </div>

          <div className={`historia-stat tone-${probe.tone}`}>
            {real === null ? (
              <span className="historia-stat-phrase">Never run out</span>
            ) : (
              <>
                <span className="historia-stat-num">{match ? match[1] : realText}</span>
                {match && <span className="historia-stat-unit">{match[2]}</span>}
              </>
            )}
          </div>

          {context && <p className="historia-context">{context}</p>}
        </section>
      </div>
    </article>
  );
}
