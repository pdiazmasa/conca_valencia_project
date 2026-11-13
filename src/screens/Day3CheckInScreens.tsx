import { useEffect, useState } from "react";
import type {
  Day3BlockerReason,
  Day3CheckIn,
  Participant,
  StepProgressStatus,
} from "../data/types";
import {
  DAY3_BLOCKER_LABELS,
  formatDay3FamilySummary,
} from "../utils/planLogic";

type Day3StatusScreenProps = {
  participantName: string;
  stepLabel: string;
  onSelectStatus: (status: StepProgressStatus) => void;
};

const STATUS_CHOICES: { value: StepProgressStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "started", label: "Started" },
  { value: "not_yet", label: "Not yet" },
];

export function Day3StatusScreen({
  participantName,
  stepLabel,
  onSelectStatus,
}: Day3StatusScreenProps) {
  return (
    <main className="card">
      <p className="eyebrow">{`${participantName} — Day 3 check-in`}</p>
      <h1>{`Did you start: ${stepLabel}?`}</h1>
      <div className="stack-sm" role="group" aria-label={`Did you start: ${stepLabel}?`}>
        {STATUS_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            className="btn-secondary"
            onClick={() => onSelectStatus(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </main>
  );
}

type Day3BlockerScreenProps = {
  participantName: string;
  initialReason?: Day3BlockerReason;
  initialNote?: string;
  onSubmit: (reason: Day3BlockerReason, note?: string) => void;
  onBack: () => void;
};

const BLOCKER_REASONS: Day3BlockerReason[] = [
  "no_time",
  "not_sure_how",
  "changed_minds",
  "something_else",
];

export function Day3BlockerScreen({
  participantName,
  initialReason,
  initialNote,
  onSubmit,
  onBack,
}: Day3BlockerScreenProps) {
  const [reason, setReason] = useState<Day3BlockerReason | null>(
    initialReason ?? null
  );
  const [note, setNote] = useState<string>(initialNote ?? "");

  useEffect(() => {
    setReason(initialReason ?? null);
    setNote(initialNote ?? "");
  }, [participantName, initialReason, initialNote]);

  const canContinue = reason !== null;
  const hintId = `day3-blocker-hint-${participantName}`;

  return (
    <main className="card">
      <p className="eyebrow">{`${participantName} — Day 3 check-in`}</p>
      <h1>What is in the way?</h1>

      <div className="stack-sm" role="group" aria-label="What is in the way?">
        {BLOCKER_REASONS.map((key) => {
          const selected = reason === key;
          return (
            <button
              key={key}
              type="button"
              className={`btn-secondary ${selected ? "is-selected" : ""}`}
              aria-pressed={selected}
              onClick={() => setReason(key)}
            >
              {DAY3_BLOCKER_LABELS[key]}
            </button>
          );
        })}
      </div>

      <label className="field-label">
        <span>Short note (optional)</span>
        <input
          type="text"
          className="text-input"
          value={note}
          placeholder="Optional note"
          maxLength={140}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="stack-sm">
        <button
          type="button"
          className="btn-primary"
          disabled={!canContinue}
          aria-describedby={!canContinue ? hintId : undefined}
          onClick={() => {
            if (!reason) return;
            const trimmed = note.trim();
            onSubmit(reason, trimmed || undefined);
          }}
        >
          Continue
        </button>
        {!canContinue && (
          <p id={hintId} className="form-hint" aria-live="polite">
            Pick what is in the way to continue.
          </p>
        )}
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </main>
  );
}

type Day3SummaryScreenProps = {
  familyDisplayName: string;
  stepLabel: string;
  participants: Participant[];
  day3?: Day3CheckIn;
  onBackToStart: () => void;
  onOpenAdvisor: () => void;
};

export function Day3SummaryScreen({
  familyDisplayName,
  stepLabel,
  participants,
  day3,
  onBackToStart,
  onOpenAdvisor,
}: Day3SummaryScreenProps) {
  const summaryLine = formatDay3FamilySummary(participants, day3);
  const notes = participants.flatMap((person) => {
    const resp = day3?.responses?.[person.id];
    if (!resp?.blockerNote) return [];
    return [{ id: person.id, name: person.name, note: resp.blockerNote }];
  });

  return (
    <main className="stack-lg">
      <section className="card">
        <p className="eyebrow">{`${familyDisplayName} — Day 3 check-in`}</p>
        <h1>Check-in summary</h1>
        <p className="muted">{`Step: ${stepLabel}`}</p>

        <div className="card-subtle stack-sm">
          <p className="comparison-sentence">{summaryLine}</p>
          {notes.map((entry) => (
            <p key={entry.id} className="muted">
              {`${entry.name}'s note: ${entry.note}`}
            </p>
          ))}
        </div>
      </section>

      <div className="stack-sm">
        <button type="button" className="btn-primary" onClick={onBackToStart}>
          Back to start
        </button>
        <button type="button" className="btn-secondary" onClick={onOpenAdvisor}>
          Advisor view
        </button>
      </div>
    </main>
  );
}
