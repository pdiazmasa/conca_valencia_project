import { useEffect, useState } from "react";
import { AnswerSlider } from "../components/AnswerSlider";
import type { Confidence, Family, Question } from "../data/types";
import { formatTemplate } from "../utils/format";

type GuessScreenProps = {
  family: Family;
  participantName: string;
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  initialValue?: number;
  initialConfidence?: Confidence;
  onSubmit: (value: number, confidence: Confidence) => void;
};

const CONFIDENCE_OPTIONS: { value: Confidence; label: string }[] = [
  { value: 1, label: "Just guessing" },
  { value: 2, label: "Fairly sure" },
  { value: 3, label: "Very sure" },
];

function getDisabledHint(
  isChoice: boolean,
  hasValue: boolean,
  hasConfidence: boolean
): string | null {
  if (hasValue && hasConfidence) {
    return null;
  }
  if (!hasValue && !hasConfidence) {
    return isChoice
      ? "Pick an answer and how sure you are to continue."
      : "Move the slider and pick how sure you are to continue.";
  }
  if (!hasValue) {
    return isChoice
      ? "Pick an answer to continue."
      : "Move the slider to your guess to continue.";
  }
  return "Pick how sure you are to continue.";
}

export function GuessScreen({
  family,
  participantName,
  question,
  questionNumber,
  totalQuestions,
  initialValue,
  initialConfidence,
  onSubmit,
}: GuessScreenProps) {
  const [value, setValue] = useState<number | null>(initialValue ?? null);
  const [confidence, setConfidence] = useState<Confidence | null>(
    initialConfidence ?? null
  );

  useEffect(() => {
    setValue(initialValue ?? null);
    setConfidence(initialConfidence ?? null);
  }, [question.id, participantName, initialValue, initialConfidence]);

  const promptText = formatTemplate(question.prompt, family, {
    question,
    participantName,
  });

  const isChoice = Boolean(question.type === "choice" && question.options);
  const canContinue = value !== null && confidence !== null;
  const disabledHint = getDisabledHint(
    isChoice,
    value !== null,
    confidence !== null
  );
  const hintId = `guess-hint-${question.id}`;

  return (
    <main className="card">
      <p className="eyebrow">
        {`${participantName} — Question ${questionNumber} of ${totalQuestions}`}
      </p>
      <h1>{promptText}</h1>

      {isChoice && question.options ? (
        <div className="stack-sm" role="group" aria-label={promptText}>
          {question.options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.label}
                type="button"
                className={`btn-secondary btn-choice ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => setValue(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <AnswerSlider
          id={`guess-${question.id}`}
          label="Move the slider to your guess"
          scale={question.scale}
          value={value}
          onChange={setValue}
        />
      )}

      <div className="stack-sm">
        <h2>How sure are you?</h2>
        <div className="stack-sm" role="group" aria-label="How sure are you">
          {CONFIDENCE_OPTIONS.map((option) => {
            const selected = confidence === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`btn-secondary ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => setConfidence(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="stack-sm">
        <button
          type="button"
          className="btn-primary"
          disabled={!canContinue}
          aria-describedby={disabledHint ? hintId : undefined}
          onClick={() => {
            if (value !== null && confidence !== null) {
              onSubmit(value, confidence);
            }
          }}
        >
          Continue
        </button>
        {disabledHint && (
          <p id={hintId} className="form-hint" aria-live="polite">
            {disabledHint}
          </p>
        )}
      </div>
    </main>
  );
}
