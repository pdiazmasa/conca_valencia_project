import { useEffect, useState } from "react";
import { AnswerSlider, getMidpointValue } from "../components/AnswerSlider";
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
  const defaultValue = initialValue ?? getMidpointValue(firstQuestion.scale);
  const [value, setValue] = useState<number>(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [participantName, otherName, defaultValue]);

  const reminderPrompt = formatTemplate(firstQuestion.prompt, family, {
    question: firstQuestion,
    participantName: otherName,
  });

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

      <button
        type="button"
        className="btn-primary"
        onClick={() => onSubmit(value)}
      >
        Continue
      </button>
    </main>
  );
}
