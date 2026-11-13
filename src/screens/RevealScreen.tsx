import { useEffect, useRef, useState } from "react";
import { Lifeline, type LifelineMark } from "../components/Lifeline";
import { ListenButton } from "../components/ListenButton";
import type { Family, Participant, Question, QuestionAnswer } from "../data/types";
import { formatTemplate } from "../utils/format";
import {
  getBestPredictorSummary,
  getRevealConfidenceSummary,
} from "../utils/planLogic";

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

const REVEAL_DELAY_MS = 700;

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
  const [revealedPlan, setRevealedPlan] = useState(false);
  const [showSentence, setShowSentence] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setRevealedPlan(false);
    setShowSentence(false);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [question.id, questionIndex]);

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

  const confidenceSummary = getRevealConfidenceSummary(
    participants,
    question.id,
    answers,
    planValue,
    question.scale
  );

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

  function handleShowPlan() {
    if (revealedPlan) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setRevealedPlan(true);

    if (prefersReducedMotion) {
      setShowSentence(true);
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setShowSentence(true);
      timerRef.current = null;
    }, REVEAL_DELAY_MS);
  }

  return (
    <main className="card">
      <p className="eyebrow">
        {`Reveal — Question ${questionNumberLabel(questionIndex, totalQuestions)}`}
      </p>
      <h1>{promptText}</h1>

      <Lifeline
        scale={question.scale}
        planValue={planValue}
        showPlan={revealedPlan}
        animatePlan={revealedPlan}
        marks={marks}
        shadeGap={revealedPlan}
      />

      {!revealedPlan && (
        <div className="stack-md">
          <p className="reveal-prompt">Here is what you guessed.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={handleShowPlan}
          >
            Show what your plan says
          </button>
        </div>
      )}

      {showSentence && (
        <div className="stack-md reveal-outcome">
          <div className="stack-sm">
            <p className="reveal-sentence">{revealSentenceText}</p>
            {confidenceSummary && (
              <p className="reveal-summary">{confidenceSummary}</p>
            )}
          </div>

          <ListenButton text={revealSentenceText} />

          {bestPredictorSummary && (
            <div className="insight-box">{bestPredictorSummary}</div>
          )}

          <button type="button" className="btn-primary" onClick={onNext}>
            {isLastQuestion ? "See what each step changes" : "Next question"}
          </button>
        </div>
      )}
    </main>
  );
}

function questionNumberLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`;
}
