import { useEffect, useState } from "react";
import { AnswerSlider, getMidpointValue } from "../components/AnswerSlider";
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
  const defaultValue =
    initialValue ??
    (question.type === "choice" && question.options && question.options.length > 0
      ? question.options[0].value
      : getMidpointValue(question.scale));

  const [value, setValue] = useState<number>(defaultValue);
  const [confidence, setConfidence] = useState<Confidence | null>(
    initialConfidence ?? null
  );

  useEffect(() => {
    setValue(defaultValue);
    setConfidence(initialConfidence ?? null);
  }, [question.id, participantName, defaultValue, initialConfidence]);

  const promptText = formatTemplate(question.prompt, family, {
    question,
    participantName,
  });

  return (
    <main className="card">
      <p className="eyebrow">
        {`${participantName} — Question ${questionNumber} of ${totalQuestions}`}
      </p>
      <h1>{promptText}</h1>

      {question.type === "choice" && question.options ? (
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

      <button
        type="button"
        className="btn-primary"
        disabled={confidence === null}
        onClick={() => {
          if (confidence !== null) {
            onSubmit(value, confidence);
          }
        }}
      >
        Continue
      </button>
    </main>
  );
}
