import { getFamilyById } from "../data";
import type { Confidence } from "../data/types";
import { formatHumanDate } from "../utils/dates";
import { formatTemplate, formatValue } from "../utils/format";
import {
  getQuestionDisagreements,
  isConfidentAndWrong,
} from "../utils/planLogic";
import { loadSessions } from "../utils/storage";

type AdvisorScreenProps = {
  onBack: () => void;
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  1: "Just guessing",
  2: "Fairly sure",
  3: "Very sure",
};

export function AdvisorScreen({ onBack }: AdvisorScreenProps) {
  const sessions = loadSessions();

  return (
    <main className="stack-lg">
      <section className="card">
        <p className="eyebrow">Advisor map</p>
        <h1>Advisor view</h1>
        <p className="muted">
          Saved family sessions from this device, showing gaps, confidence, and
          disagreements.
        </p>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
      </section>

      {sessions.length === 0 ? (
        <section className="card">
          <p className="muted">
            No family sessions saved yet. Complete a family session first.
          </p>
        </section>
      ) : (
        sessions.map((session) => {
          const family = getFamilyById(session.familyId);
          if (!family) return null;

          return (
            <section key={session.id} className="card">
              <div className="stack-sm">
                <h2>{session.familyDisplayName}</h2>
                <p className="muted" style={{ fontSize: "0.88rem" }}>
                  {`Participants: ${session.participants.map((p) => p.name).join(", ")}`}
                </p>
                {session.agreement && (
                  <p className="card-subtle" style={{ fontSize: "0.9rem" }}>
                    <strong>Agreed step: </strong>
                    {`${session.agreement.recommendationLabel} (${formatHumanDate(
                      session.agreement.targetDate
                    )})`}
                  </p>
                )}
              </div>

              {family.questions.map((question) => {
                const planValue = family.facts[question.planFactKey];
                const disagreements = getQuestionDisagreements(
                  session.participants,
                  question.id,
                  session.answers,
                  question.scale
                );

                return (
                  <div key={question.id} className="advisor-question-block">
                    <h3>{formatTemplate(question.prompt, family, { question })}</h3>
                    <p className="muted" style={{ fontSize: "0.9rem" }}>
                      <strong>Plan value: </strong>
                      {formatValue(planValue, question.scale.kind, "readout")}
                    </p>

                    <div className="stack-sm">
                      {session.participants.map((person) => {
                        const ans = session.answers[person.id]?.[question.id];
                        if (!ans) return null;

                        const gap = Math.abs(ans.value - planValue);
                        const flagged = isConfidentAndWrong(
                          ans.value,
                          ans.confidence,
                          planValue,
                          question.scale
                        );

                        return (
                          <div key={person.id} className="advisor-person-row">
                            <div className="advisor-row-top">
                              <strong>{person.name}</strong>
                              {flagged && (
                                <span className="flag-badge">
                                  Confident and wrong
                                </span>
                              )}
                            </div>
                            <div className="advisor-metrics">
                              <span>
                                <strong>Guess: </strong>
                                {formatValue(
                                  ans.value,
                                  question.scale.kind,
                                  "readout"
                                )}
                              </span>
                              <span>
                                <strong>Confidence: </strong>
                                {CONFIDENCE_LABELS[ans.confidence]}
                              </span>
                              <span>
                                <strong>Plan: </strong>
                                {formatValue(
                                  planValue,
                                  question.scale.kind,
                                  "readout"
                                )}
                              </span>
                              <span>
                                <strong>Gap: </strong>
                                {formatValue(gap, question.scale.kind, "sentence")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {session.participants.length >= 2 && (
                      <div className="card-subtle" style={{ fontSize: "0.9rem" }}>
                        <strong>Disagreements: </strong>
                        {disagreements.length === 0 ? (
                          <span>Everyone guessed closely on this question.</span>
                        ) : (
                          <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
                            {disagreements.map((pair) => (
                              <li key={`${pair.personA.id}-${pair.personB.id}`}>
                                {`${pair.personA.name} and ${pair.personB.name} differ by ${formatValue(
                                  pair.gap,
                                  question.scale.kind,
                                  "sentence"
                                )}`}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })
      )}
    </main>
  );
}
