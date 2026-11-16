// Componente Reveal propio del formato Life line.
// Compara la estimación de la persona ("You said X") con el dato real del plan ("Your plan: Y").
import { formatValue, revealContext, truthValue, type Probe } from "../data";
import type { RevealProps } from "../formats/types";

// Determina si el dato del plan es peor de lo que la persona pensaba.
function isPlanWorseThanGuess(probe: Probe, answer: number, real: number | null): boolean {
  if (!Number.isFinite(answer)) return false;
  if (probe.id === "mezcla") return false;
  if (probe.id === "ahorros") {
    if (!probe.truth.depletes || real === null) return false;
    return real < answer;
  }
  if (real === null) return false;
  return real < answer;
}

// Eje fino de edades en SVG para comparar la edad estimada de agotamiento de ahorros frente al plan.
function SavingsAgeAxis({
  probe,
  answer,
  real,
  worse,
}: {
  probe: Probe;
  answer: number;
  real: number | null;
  worse: boolean;
}) {
  const min = probe.input.min;
  const max = probe.input.max;
  const span = Math.max(1, max - min);
  const endAge = probe.truth.endOfPlanAge ?? 91;
  const planAge = real ?? endAge;
  const hasAnswer = Number.isFinite(answer);

  const X0 = 24;
  const X1 = 316;
  const toX = (age: number) => {
    const clamped = Math.max(min, Math.min(max, age));
    return X0 + ((clamped - min) / span) * (X1 - X0);
  };

  const planX = toX(planAge);
  const youX = hasAnswer ? toX(answer) : null;

  // Marcas cada 10 años entre los extremos (sin pisar las etiquetas de los extremos).
  const ticks: number[] = [];
  for (let a = Math.ceil((min + 1) / 10) * 10; a < max; a += 10) {
    if (toX(a) - X0 > 22 && X1 - toX(a) > 22) ticks.push(a);
  }

  const diffYears = hasAnswer ? Math.round(planAge - answer) : 0;
  const diffLabel =
    !hasAnswer
      ? real === null
        ? `Lasts past age ${endAge}`
        : `Runs out at age ${planAge}`
      : diffYears === 0
        ? "Same age as your guess"
        : diffYears < 0
          ? `${Math.abs(diffYears)} ${Math.abs(diffYears) === 1 ? "year" : "years"} sooner`
          : `${diffYears} ${diffYears === 1 ? "year" : "years"} later`;

  const labelY = youX !== null && Math.abs(planX - youX) < 48 ? 72 : 16;

  return (
    <div className="lfl-axis-wrap">
      <div className="lfl-axis-head">
        <span className="lfl-axis-caption">Savings horizon (age)</span>
        <span className={`lfl-axis-diff ${worse ? "lfl-bad" : ""}`}>{diffLabel}</span>
      </div>
      <svg
        className="lfl-axis-svg"
        viewBox="0 0 340 78"
        role="img"
        aria-label={`Savings age comparison: ${diffLabel}`}
      >
        {/* Pista base */}
        <line
          x1={X0}
          y1={36}
          x2={X1}
          y2={36}
          stroke="var(--hairline)"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Marcas de edad */}
        {[min, ...ticks, max].map((a) => (
          <line
            key={a}
            x1={toX(a)}
            y1={32}
            x2={toX(a)}
            y2={40}
            stroke="var(--muted)"
            strokeOpacity={0.55}
            strokeWidth={1}
          />
        ))}
        {ticks.map((a) => (
          <text key={`t-${a}`} x={toX(a)} y={56} className="lfl-axis-tick" textAnchor="middle">
            {a}
          </text>
        ))}

        {/* Tramo entre lo estimado y el plan */}
        {youX !== null && (
          <line
            x1={Math.min(youX, planX)}
            y1={36}
            x2={Math.max(youX, planX)}
            y2={36}
            stroke={worse ? "var(--ember)" : "var(--ink)"}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}

        {/* Etiquetas de extremo */}
        <text x={X0} y={56} className="lfl-axis-tick" textAnchor="start">
          {min}
        </text>
        <text x={X1} y={56} className="lfl-axis-tick" textAnchor="end">
          {max}
        </text>

        {/* Marcador de la respuesta del usuario */}
        {youX !== null && (
          <g>
            <circle
              cx={youX}
              cy={36}
              r={5.5}
              fill="var(--paper)"
              stroke="var(--muted)"
              strokeWidth={2}
            />
            <text
              x={youX}
              y={16}
              className="lfl-axis-marker-you"
              textAnchor={youX < 60 ? "start" : youX > 280 ? "end" : "middle"}
            >
              {`You ${Math.round(answer)}`}
            </text>
          </g>
        )}

        {/* Marcador del plan */}
        <g>
          <circle cx={planX} cy={36} r={6.5} fill={worse ? "var(--ember)" : "var(--ink)"} />
          <text
            x={planX}
            y={labelY}
            className={`lfl-axis-marker-plan ${worse ? "lfl-bad" : ""}`}
            textAnchor={planX < 60 ? "start" : planX > 280 ? "end" : "middle"}
          >
            {real === null ? `Plan ${endAge}+` : `Plan ${planAge}`}
          </text>
        </g>
      </svg>
    </div>
  );
}

export function LifelineReveal({ probe, answer }: RevealProps) {
  const real = truthValue(probe);
  const hasAnswer = Number.isFinite(answer);
  const worse = isPlanWorseThanGuess(probe, answer, real);

  const planText =
    real === null
      ? `Never runs out (past ${probe.truth.endOfPlanAge ?? 91})`
      : formatValue(probe.input, real);

  const contextText = revealContext(probe);

  return (
    <article className="lfl-reveal-card">
      <p className="lfl-reveal-question">{probe.question}</p>

      <div className={`lfl-reveal-compare ${hasAnswer ? "" : "lfl-reveal-single"}`}>
        {hasAnswer && (
          <div className="lfl-reveal-col">
            <span className="lfl-reveal-label">You said</span>
            <span className="lfl-reveal-val lfl-reveal-val-you">
              {formatValue(probe.input, answer)}
            </span>
          </div>
        )}
        <div className="lfl-reveal-col">
          <span className="lfl-reveal-label">Your plan</span>
          <span className={`lfl-reveal-val ${worse ? "lfl-bad" : ""}`}>{planText}</span>
        </div>
      </div>

      {probe.id === "ahorros" && (
        <SavingsAgeAxis probe={probe} answer={answer} real={real} worse={worse} />
      )}

      {contextText && <p className="lfl-reveal-context">{contextText}</p>}
    </article>
  );
}
