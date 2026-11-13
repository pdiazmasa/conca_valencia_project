import { getFamilyById } from "../data";
import type { Confidence } from "../data/types";
import { formatHumanDate } from "../utils/dates";
import { formatTemplate, formatValue } from "../utils/format";
import {
  DAY3_BLOCKER_LABELS,
  getAdvisorTopSummary,
  getDay30Comparison,
  getQuestionDisagreements,
  isConfidentAndWrong,
  STEP_STATUS_LABELS,
} from "../utils/planLogic";
import { downloadSessionJson, loadSessions } from "../utils/storage";

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

          const topSummary = getAdvisorTopSummary(family, session);
          const day3 = session.checkIns?.day3;
          const day30 = session.checkIns?.day30;

          return (
            <section key={session.id} className="card">
              <div className="stack-sm">
                <div className="advisor-row-top">
                  <h2>{session.familyDisplayName}</h2>
                </div>
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

                <div className="card-subtle" style={{ fontSize: "0.9rem" }}>
                  <strong>Summary</strong>
                  <ul className="advisor-summary-list">
                    {topSummary.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => downloadSessionJson(session)}
                >
                  Export for advisor (JSON)
                </button>
              </div>

              <div className="advisor-section-block">
                <h3>Day 3 check-in</h3>
                {!day3 || Object.keys(day3.responses ?? {}).length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.9rem" }}>
                    Not completed yet.
                  </p>
                ) : (
                  <div className="stack-sm">
                    {session.participants.map((person) => {
                      const resp = day3.responses?.[person.id];
                      const statusText = resp
                        ? STEP_STATUS_LABELS[resp.status]
                        : "Not recorded";
                      const blockerText =
                        resp?.status === "not_yet" && resp.blockerReason
                          ? DAY3_BLOCKER_LABELS[resp.blockerReason]
                          : null;

                      return (
                        <div key={person.id} className="advisor-person-row">
                          <div className="advisor-row-top">
                            <strong>{person.name}</strong>
                            <span className="status-badge">{statusText}</span>
                          </div>
                          {blockerText && (
                            <p style={{ fontSize: "0.88rem" }}>
                              <strong>Blocker: </strong>
                              {blockerText}
                            </p>
                          )}
                          {resp?.blockerNote && (
                            <p className="muted" style={{ fontSize: "0.88rem" }}>
                              <strong>Note: </strong>
                              {resp.blockerNote}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="advisor-section-block">
                <h3>Day 30 check-in</h3>
                {!day30 ||
                (Object.keys(day30.answers ?? {}).length === 0 &&
                  !day30.stepStatus) ? (
                  <p className="muted" style={{ fontSize: "0.9rem" }}>
                    Not completed yet.
                  </p>
                ) : (
                  <div className="stack-sm">
                    {day30.stepStatus && (
                      <p className="card-subtle" style={{ fontSize: "0.9rem" }}>
                        <strong>Step completion: </strong>
                        {STEP_STATUS_LABELS[day30.stepStatus]}
                      </p>
                    )}

                    {family.questions.map((question) => {
                      const planValue = family.facts[question.planFactKey];
                      return (
                        <div key={`day30-${question.id}`} className="stack-sm">
                          <p style={{ fontSize: "0.92rem", fontWeight: 700 }}>
                            {formatTemplate(question.prompt, family, { question })}
                          </p>
                          {session.participants.map((person) => {
                            const firstAns = session.answers[person.id]?.[question.id];
                            const day30Ans = day30.answers?.[person.id]?.[question.id];
                            if (!firstAns || !day30Ans) return null;

                            const comparison = getDay30Comparison(
                              firstAns.value,
                              day30Ans.value,
                              planValue,
                              question.scale
                            );
                            const badgeClass = `status-badge is-${comparison.label.toLowerCase()}`;

                            return (
                              <div
                                key={`day30-${question.id}-${person.id}`}
                                className="advisor-person-row"
                              >
                                <div className="advisor-row-top">
                                  <strong>{person.name}</strong>
                                  <span className={badgeClass}>
                                    {comparison.label}
                                  </span>
                                </div>
                                <div className="advisor-metrics">
                                  <span>
                                    <strong>First gap: </strong>
                                    {formatValue(
                                      comparison.firstGap,
                                      question.scale.kind,
                                      "sentence"
                                    )}
                                  </span>
                                  <span>
                                    <strong>Day-30 gap: </strong>
                                    {formatValue(
                                      comparison.todayGap,
                                      question.scale.kind,
                                      "sentence"
                                    )}
                                  </span>
                                  <span>
                                    <strong>First guess: </strong>
                                    {formatValue(
                                      firstAns.value,
                                      question.scale.kind,
                                      "readout"
                                    )}
                                  </span>
                                  <span>
                                    <strong>Day-30 guess: </strong>
                                    {formatValue(
                                      day30Ans.value,
                                      question.scale.kind,
                                      "readout"
                                    )}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
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
