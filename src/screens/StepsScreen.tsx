import { Lifeline } from "../components/Lifeline";
import type { Family, Scale } from "../data/types";
import { formatTemplate } from "../utils/format";
import {
  getDisplayedScore,
  getScoredRecommendations,
  getUnscoredRecommendations,
} from "../utils/planLogic";

type StepsScreenProps = {
  family: Family;
  selectedIds: string[];
  onSetStepCount: (stepCount: number) => void;
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
  onSetStepCount,
  onContinue,
}: StepsScreenProps) {
  const { score, appliedStepCount } = getDisplayedScore(family, selectedIds);
  const scoredSteps = getScoredRecommendations(family);
  const unscoredRecommendations = getUnscoredRecommendations(family);
  const baselineScore = family.facts.planScore;

  return (
    <main className="stack-lg">
      <section className="card">
        <p className="eyebrow">Explore recommendations</p>
        <h1>What each step changes</h1>

        <div className="score-summary">
          <span className="score-big">{`Plan score: ${score}`}</span>
          {appliedStepCount > 0 && (
            <span className="muted">{`Today: ${baselineScore}`}</span>
          )}
        </div>

        <Lifeline
          scale={SCORE_SCALE}
          planValue={score}
          planLabel="With these steps"
          baselinePlanValue={baselineScore}
          baselineLabel="Today"
          alwaysShowBaseline={true}
        />

        <p className="muted">
          These numbers come from your plan. Your advisor can explain each one.
        </p>
      </section>

      {scoredSteps.length > 0 && (
        <section className="card">
          <div className="stack-sm">
            <h2>Steps in order</h2>
            <p className="muted">
              Your plan already calculated these steps in this order.
            </p>
          </div>

          <div className="ladder-controls">
            <button
              type="button"
              className="btn-primary"
              disabled={appliedStepCount >= scoredSteps.length}
              onClick={() => onSetStepCount(appliedStepCount + 1)}
            >
              Add next step
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={appliedStepCount <= 0}
              onClick={() => onSetStepCount(appliedStepCount - 1)}
            >
              Remove last step
            </button>
          </div>

          <div className="stack-sm" role="group" aria-label="Ordered plan steps">
            {scoredSteps.map((rec, index) => {
              const stepNumber = index + 1;
              const selected = index < appliedStepCount;
              const detailText = formatTemplate(rec.detail, family);
              const statusText = selected
                ? `Step ${stepNumber} — Included`
                : `Step ${stepNumber}`;

              return (
                <button
                  key={rec.id}
                  type="button"
                  className={`rec-card ${selected ? "is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onSetStepCount(stepNumber)}
                >
                  <span className="rec-status">{statusText}</span>
                  <span className="rec-title">{rec.label}</span>
                  <span className="rec-detail">{detailText}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {unscoredRecommendations.length > 0 && (
        <section className="card">
          <h2>Also in your plan</h2>
          <div className="stack-sm">
            {unscoredRecommendations.map((rec) => {
              const detailText = formatTemplate(rec.detail, family);
              return (
                <div key={rec.id} className="unscored-card">
                  <span className="rec-title">{rec.label}</span>
                  <span className="rec-detail">{detailText}</span>
                  <span className="card-subtle">
                    Your plan has no score change for this one yet.
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <button type="button" className="btn-primary" onClick={onContinue}>
        Choose your first step
      </button>
    </main>
  );
}
