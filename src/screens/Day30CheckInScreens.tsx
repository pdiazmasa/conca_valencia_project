import { Lifeline, type LifelineMark } from "../components/Lifeline";
import { ListenButton } from "../components/ListenButton";
import type {
  Family,
  Participant,
  Question,
  QuestionAnswer,
  StepProgressStatus,
} from "../data/types";
import { formatTemplate } from "../utils/format";
import {
  getDay30ComparisonSentence,
  STEP_STATUS_LABELS,
} from "../utils/planLogic";

const PERSON_COLORS = [
  "var(--color-you)",
  "var(--color-partner)",
  "var(--color-person-3)",
  "var(--color-person-4)",
];

type Day30RevealScreenProps = {
  family: Family;
  participants: Participant[];
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  firstAnswers: Record<string, Record<string, QuestionAnswer>>;
  todayAnswers: Record<string, Record<string, QuestionAnswer>>;
  onNext: () => void;
};

export function Day30RevealScreen({
  family,
  participants,
  question,
  questionIndex,
  totalQuestions,
  firstAnswers,
  todayAnswers,
  onNext,
}: Day30RevealScreenProps) {
  const planValue = family.facts[question.planFactKey];
  const promptText = formatTemplate(question.prompt, family, { question });
  const revealSentenceText = formatTemplate(question.revealSentence, family, {
    question,
  });

  const firstMarks: LifelineMark[] = participants.flatMap((person, index) => {
    const first = firstAnswers[person.id]?.[question.id];
    if (!first) return [];
    return [
      {
        id: `${person.id}-first`,
        label: `${person.name} (First time)`,
        value: first.value,
        color: PERSON_COLORS[index % PERSON_COLORS.length],
        isLighter: true,
      },
    ];
  });

  const todayMarks: LifelineMark[] = participants.flatMap((person, index) => {
    const today = todayAnswers[person.id]?.[question.id];
    if (!today) return [];
    return [
      {
        id: `${person.id}-today`,
        label: `${person.name} (Today)`,
        value: today.value,
        color: PERSON_COLORS[index % PERSON_COLORS.length],
        isLighter: false,
      },
    ];
  });

  const marks = [...firstMarks, ...todayMarks];

  const comparisonSentences = participants.flatMap((person) => {
    const first = firstAnswers[person.id]?.[question.id];
    const today = todayAnswers[person.id]?.[question.id];
    if (!first || !today) return [];
    return [
      {
        id: person.id,
        text: getDay30ComparisonSentence(
          person.name,
          first.value,
          today.value,
          planValue,
          question.scale
        ),
      },
    ];
  });

  const isLastQuestion = questionIndex + 1 >= totalQuestions;
  const speechText = [
    ...comparisonSentences.map((item) => item.text),
    revealSentenceText,
  ].join(" ");

  return (
    <main className="card">
      <p className="eyebrow">
        {`Day 30 reveal — Question ${questionIndex + 1} of ${totalQuestions}`}
      </p>
      <h1>{promptText}</h1>

      <Lifeline
        scale={question.scale}
        planValue={planValue}
        showPlan={true}
        animatePlan={false}
        marks={marks}
      />

      <div className="stack-md">
        {comparisonSentences.length > 0 && (
          <div className="comparison-list">
            {comparisonSentences.map((item) => (
              <p key={item.id} className="comparison-sentence">
                {item.text}
              </p>
            ))}
          </div>
        )}

        <p className="reveal-sentence">{revealSentenceText}</p>

        <ListenButton text={speechText} />

        <button type="button" className="btn-primary" onClick={onNext}>
          {isLastQuestion ? "Continue" : "Next question"}
        </button>
      </div>
    </main>
  );
}

type Day30StepScreenProps = {
  stepLabel: string;
  onSelectStatus: (status: StepProgressStatus) => void;
};

const STEP_CHOICES: { value: StepProgressStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "started", label: "Started" },
  { value: "not_yet", label: "Not yet" },
];

export function Day30StepScreen({
  stepLabel,
  onSelectStatus,
}: Day30StepScreenProps) {
  return (
    <main className="card">
      <p className="eyebrow">Day 30 check-in</p>
      <h1>{`Did you complete: ${stepLabel}?`}</h1>
      <div
        className="stack-sm"
        role="group"
        aria-label={`Did you complete: ${stepLabel}?`}
      >
        {STEP_CHOICES.map((choice) => (
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

type Day30SummaryScreenProps = {
  family: Family;
  participants: Participant[];
  stepLabel: string;
  stepStatus?: StepProgressStatus;
  firstAnswers: Record<string, Record<string, QuestionAnswer>>;
  todayAnswers: Record<string, Record<string, QuestionAnswer>>;
  onBackToStart: () => void;
  onOpenAdvisor: () => void;
};

export function Day30SummaryScreen({
  family,
  participants,
  stepLabel,
  stepStatus,
  firstAnswers,
  todayAnswers,
  onBackToStart,
  onOpenAdvisor,
}: Day30SummaryScreenProps) {
  return (
    <main className="stack-lg">
      <section className="card">
        <p className="eyebrow">{`${family.displayName} — Day 30 check-in`}</p>
        <h1>One-month check-in saved</h1>

        {stepStatus && (
          <div className="card-subtle">
            <p className="comparison-sentence">
              {`Step: ${stepLabel} — ${STEP_STATUS_LABELS[stepStatus]}.`}
            </p>
          </div>
        )}

        <div className="stack-md">
          {family.questions.map((question) => {
            const planValue = family.facts[question.planFactKey];
            const promptText = formatTemplate(question.prompt, family, { question });
            const lines = participants.flatMap((person) => {
              const first = firstAnswers[person.id]?.[question.id];
              const today = todayAnswers[person.id]?.[question.id];
              if (!first || !today) return [];
              return [
                {
                  id: `${question.id}-${person.id}`,
                  text: getDay30ComparisonSentence(
                    person.name,
                    first.value,
                    today.value,
                    planValue,
                    question.scale
                  ),
                },
              ];
            });

            if (lines.length === 0) return null;

            return (
              <div key={question.id} className="card-subtle stack-sm">
                <p className="muted">{promptText}</p>
                {lines.map((line) => (
                  <p key={line.id} className="comparison-sentence">
                    {line.text}
                  </p>
                ))}
              </div>
            );
          })}
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
