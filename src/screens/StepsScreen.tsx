import { Lifeline } from "../components/Lifeline";
import type { Family, Scale } from "../data/types";
import { formatTemplate } from "../utils/format";
import { getDisplayedScore } from "../utils/planLogic";

type StepsScreenProps = {
  family: Family;
  selectedIds: string[];
  onToggleRecommendation: (recommendationId: string) => void;
  onContinue: () => void;
};

const SCORE_SCALE: Scale = {
  kind: "score",
  min: 0,
  max: 100,
  unit: "score",
  step: 1,
};

export function StepsScreen({
  family,
  selectedIds,
  onToggleRecommendation,
  onContinue,
}: StepsScreenProps) {
  const { score, hasSelectedWithoutScore } = getDisplayedScore(
    family,
    selectedIds
  );
  const baselineScore = family.facts.planScore;

  return (
    <main className="stack-lg">
      <section className="card">
        <p className="eyebrow">Explore recommendations</p>
        <h1>What each step changes</h1>

        <div className="score-summary">
          <span className="score-big">{`Plan score: ${score}`}</span>
          {score !== baselineScore && (
            <span className="muted">{`Starting score: ${baselineScore}`}</span>
          )}
        </div>

        <Lifeline
          scale={SCORE_SCALE}
          planValue={score}
          baselinePlanValue={baselineScore}
        />

        {hasSelectedWithoutScore && (
          <p className="card-subtle">
            Your plan has no score change for this one yet.
          </p>
        )}

        <p className="muted">
          These numbers come from your plan. Your advisor can explain each one.
        </p>
      </section>

      <section className="card">
        <h2>Try turning steps on or off</h2>
        <div className="stack-sm" role="group" aria-label="Recommendations">
          {family.recommendations.map((rec) => {
            const selected = selectedIds.includes(rec.id);
            const detailText = formatTemplate(rec.detail, family);
            return (
              <button
                key={rec.id}
                type="button"
                className={`rec-card ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onToggleRecommendation(rec.id)}
              >
                <span className="rec-status">
                  {selected ? "Selected" : "Tap to try this step"}
                </span>
                <span className="rec-title">{rec.label}</span>
                <span className="rec-detail">{detailText}</span>
              </button>
            );
          })}
        </div>
      </section>

      <button type="button" className="btn-primary" onClick={onContinue}>
        Choose your first step
      </button>
    </main>
  );
}
