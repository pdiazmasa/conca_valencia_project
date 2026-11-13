import { ListenButton } from "../components/ListenButton";
import type { AgreementRecord, Family, Participant } from "../data/types";
import { formatHumanDate } from "../utils/dates";
import { formatTemplate } from "../utils/format";

type AgreementScreenProps = {
  family: Family;
  participants: Participant[];
  chosenRecommendationId: string;
  targetDate: string;
  agreedParticipantIds: string[];
  confirmedAgreement?: AgreementRecord;
  onSelectRecommendation: (recommendationId: string) => void;
  onChangeTargetDate: (date: string) => void;
  onToggleAgree: (participantId: string) => void;
  onResetAgreement: () => void;
  onOpenAdvisor: () => void;
};

export function AgreementScreen({
  family,
  participants,
  chosenRecommendationId,
  targetDate,
  agreedParticipantIds,
  confirmedAgreement,
  onSelectRecommendation,
  onChangeTargetDate,
  onToggleAgree,
  onResetAgreement,
  onOpenAdvisor,
}: AgreementScreenProps) {
  const chosenRec =
    family.recommendations.find((r) => r.id === chosenRecommendationId) ??
    family.recommendations[0];

  const allAgreed =
    confirmedAgreement !== undefined &&
    participants.every((p) =>
      confirmedAgreement.agreedParticipantIds.includes(p.id)
    );

  if (allAgreed && confirmedAgreement) {
    const namesText = participants.map((p) => p.name).join(" and ");
    const stepDetail = chosenRec ? formatTemplate(chosenRec.detail, family) : "";
    const speechText = [
      "Agreed.",
      `First step: ${confirmedAgreement.recommendationLabel}.`,
      `When: ${formatHumanDate(confirmedAgreement.targetDate)}.`,
      `Agreed by: ${namesText}.`,
      `Check-in on day 3: ${formatHumanDate(confirmedAgreement.checkInDay3)}.`,
      `Check-in on day 30: ${formatHumanDate(confirmedAgreement.checkInDay30)}.`,
    ].join(" ");

    return (
      <main className="stack-lg">
        <section className="agreed-card">
          <p className="eyebrow">First step confirmed</p>
          <h1>Agreed</h1>

          <div className="stack-sm">
            <p>
              <strong>Step: </strong>
              {confirmedAgreement.recommendationLabel}
            </p>
            {stepDetail && <p className="muted">{stepDetail}</p>}
            <p>
              <strong>Date: </strong>
              {formatHumanDate(confirmedAgreement.targetDate)}
            </p>
            <p>
              <strong>Agreed by: </strong>
              {participants.map((p) => p.name).join(", ")}
            </p>
          </div>

          <ul className="followup-list">
            <li className="followup-item">
              {`Check-in on day 3: ${formatHumanDate(confirmedAgreement.checkInDay3)}`}
            </li>
            <li className="followup-item">
              {`Check-in on day 30: ${formatHumanDate(confirmedAgreement.checkInDay30)}`}
            </li>
          </ul>
        </section>

        <div className="stack-sm no-print">
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.print()}
          >
            Print this page
          </button>
          <ListenButton text={speechText} />
          <button
            type="button"
            className="btn-secondary"
            onClick={onResetAgreement}
          >
            Change step or date
          </button>
          <button type="button" className="btn-link" onClick={onOpenAdvisor}>
            Advisor view
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="stack-lg">
      <section className="card">
        <p className="eyebrow">Agreement</p>
        <h1>Choose your first step</h1>

        <div className="stack-sm" role="radiogroup" aria-label="Choose your first step">
          {family.recommendations.map((rec) => {
            const selected = rec.id === chosenRec?.id;
            const detailText = formatTemplate(rec.detail, family);
            return (
              <button
                key={rec.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`rec-card ${selected ? "is-selected" : ""}`}
                onClick={() => onSelectRecommendation(rec.id)}
              >
                <span className="rec-status">
                  {selected ? "Chosen step" : "Tap to choose"}
                </span>
                <span className="rec-title">{rec.label}</span>
                <span className="rec-detail">{detailText}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <label className="field-label">
          <span>When will you do it?</span>
          <input
            type="date"
            className="date-input"
            value={targetDate}
            onChange={(event) => onChangeTargetDate(event.target.value)}
          />
        </label>
      </section>

      <section className="card">
        <h2>Confirm together</h2>
        <p className="muted">
          Each person taps below once you both agree on this step and date.
        </p>
        <div className="stack-sm">
          {participants.map((person) => {
            const agreed = agreedParticipantIds.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                className={`btn-secondary ${agreed ? "is-selected" : ""}`}
                aria-pressed={agreed}
                onClick={() => onToggleAgree(person.id)}
              >
                {agreed ? `Agreed — ${person.name}` : `I agree — ${person.name}`}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
