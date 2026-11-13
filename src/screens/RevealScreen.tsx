import { Lifeline, type LifelineMark } from "../components/Lifeline";
import { ListenButton } from "../components/ListenButton";
import type { Family, Participant, Question, QuestionAnswer } from "../data/types";
import { formatTemplate } from "../utils/format";
import { getBestPredictorSummary } from "../utils/planLogic";

type RevealScreenProps = {
  family: Family;
  participants: Participant[];
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  answers: Record<string, Record<string, QuestionAnswer>>;
  otherPredictions: Record<string, Record<string, number>>;
  onNext: () => void;
};

const PERSON_COLORS = [
  "var(--color-you)",
  "var(--color-partner)",
  "var(--color-person-3)",
  "var(--color-person-4)",
];

export function RevealScreen({
  family,
  participants,
  question,
  questionIndex,
  totalQuestions,
  answers,
  otherPredictions,
  onNext,
}: RevealScreenProps) {
  const planValue = family.facts[question.planFactKey];
  const promptText = formatTemplate(question.prompt, family, { question });
  const revealSentenceText = formatTemplate(question.revealSentence, family, {
    question,
  });

  const marks: LifelineMark[] = participants.flatMap((person, index) => {
    const answer = answers[person.id]?.[question.id];
    if (!answer) return [];
    return [
      {
        id: person.id,
        label: person.name,
        value: answer.value,
        color: PERSON_COLORS[index % PERSON_COLORS.length],
      },
    ];
  });

  const bestPredictorSummary =
    questionIndex === 0 && participants.length >= 2
      ? getBestPredictorSummary(
          participants,
          question.id,
          answers,
          otherPredictions
        )
      : null;

  const isLastQuestion = questionIndex + 1 >= totalQuestions;

  return (
    <main className="card">
      <p className="eyebrow">
        {`Reveal — Question ${questionNumberLabel(questionIndex, totalQuestions)}`}
      </p>
      <h1>{promptText}</h1>

      <Lifeline
        scale={question.scale}
        planValue={planValue}
        marks={marks}
        shadeGap={true}
      />

      <p className="reveal-sentence">{revealSentenceText}</p>

      <ListenButton text={revealSentenceText} />

      {bestPredictorSummary && (
        <div className="insight-box">{bestPredictorSummary}</div>
      )}

      <button type="button" className="btn-primary" onClick={onNext}>
        {isLastQuestion ? "See what each step changes" : "Next question"}
      </button>
    </main>
  );
}

function questionNumberLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`;
}
