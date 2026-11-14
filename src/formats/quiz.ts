import type { FormatId } from "./types";

// Mini test: cada opción vota por un formato. Gana el más votado; en empate,
// el de la última respuesta (la que habla de qué les haría actuar).
export type QuizQuestion = {
  id: string;
  question: string;
  options: { label: string; format: FormatId }[];
};

export const QUIZ: QuizQuestion[] = [
  {
    id: "explicar",
    question: "How do you like important things explained to you?",
    options: [
      { label: "Straight to the point, with numbers", format: "directo" },
      { label: "Like a story, step by step", format: "historia" },
      { label: "Thinking about how it'll affect me years from now", format: "futuro" },
      { label: "With a picture or an everyday example", format: "visual" },
    ],
  },
  {
    id: "comprar",
    question: "You're about to make a big purchase. What convinces you?",
    options: [
      { label: "Comparing prices and numbers", format: "directo" },
      { label: "Hearing someone else's experience", format: "historia" },
      { label: "Picturing myself using it years from now", format: "futuro" },
      { label: "Seeing it with my own eyes", format: "visual" },
    ],
  },
  {
    id: "actuar",
    question: "When we show you your plan, what would make you take action?",
    options: [
      { label: "Seeing exactly what's at stake", format: "directo" },
      { label: "Understanding the why behind each step", format: "historia" },
      { label: "Knowing my future self will thank me", format: "futuro" },
      { label: "Getting it at a glance, without reading much", format: "visual" },
    ],
  },
];

export function pickFormat(answers: Record<string, FormatId>): FormatId {
  const votes = new Map<FormatId, number>();
  for (const f of Object.values(answers)) votes.set(f, (votes.get(f) ?? 0) + 1);
  const best = Math.max(0, ...votes.values());
  const tied = [...votes.entries()].filter(([, n]) => n === best).map(([f]) => f);
  const last = answers[QUIZ[QUIZ.length - 1].id];
  if (tied.length === 1) return tied[0];
  return last && tied.includes(last) ? last : (tied[0] ?? "directo");
}
