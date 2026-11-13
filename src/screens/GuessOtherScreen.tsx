import { useEffect, useState } from "react";
import { AnswerSlider } from "../components/AnswerSlider";
import type { Family, Question } from "../data/types";
import { formatTemplate } from "../utils/format";

type GuessOtherScreenProps = {
  family: Family;
  participantName: string;
  otherName: string;
  firstQuestion: Question;
  initialValue?: number;
  onSubmit: (value: number) => void;
};

export function GuessOtherScreen({
  family,
  participantName,
  otherName,
  firstQuestion,
  initialValue,
  onSubmit,
}: GuessOtherScreenProps) {
  const [value, setValue] = useState<number | null>(initialValue ?? null);

  useEffect(() => {
    setValue(initialValue ?? null);
  }, [participantName, otherName, initialValue]);

  const reminderPrompt = formatTemplate(firstQuestion.prompt, family, {
    question: firstQuestion,
    participantName: otherName,
  });

  const canContinue = value !== null;
  const hintId = `guess-other-hint-${otherName}`;

  return (
    <main className="card">
      <p className="eyebrow">{participantName}</p>
      <h1>{`What do you think ${otherName} answered?`}</h1>
      <p className="muted">{reminderPrompt}</p>

      <AnswerSlider
        id={`guess-other-${otherName}`}
        label={`Move the slider to what you think ${otherName} picked`}
        scale={firstQuestion.scale}
        value={value}
        onChange={setValue}
      />

      <div className="stack-sm">
        <button
          type="button"
          className="btn-primary"
          disabled={!canContinue}
          aria-describedby={!canContinue ? hintId : undefined}
          onClick={() => {
            if (value !== null) {
              onSubmit(value);
            }
          }}
        >
          Continue
        </button>
        {!canContinue && (
          <p id={hintId} className="form-hint" aria-live="polite">
            Move the slider to your guess to continue.
          </p>
        )}
      </div>
    </main>
  );
}
