import type { Confidence, Family, Participant, QuestionAnswer, Scale } from "../data/types";

export function getDisplayedScore(
  family: Family,
  selectedRecommendationIds: string[]
): { score: number; hasSelectedWithoutScore: boolean } {
  const selectedSet = new Set(selectedRecommendationIds);
  let score = family.facts.planScore ?? 0;
  let hasSelectedWithoutScore = false;

  for (const rec of family.recommendations) {
    if (!selectedSet.has(rec.id)) {
      continue;
    }
    if (rec.scoreAfterFactKey && rec.scoreAfterFactKey in family.facts) {
      score = family.facts[rec.scoreAfterFactKey];
    } else {
      hasSelectedWithoutScore = true;
    }
  }

  return { score, hasSelectedWithoutScore };
}

export function getBestPredictorSummary(
  participants: Participant[],
  firstQuestionId: string,
  answers: Record<string, Record<string, QuestionAnswer>>,
  otherPredictions: Record<string, Record<string, number>>
): string | null {
  if (participants.length < 2) {
    return null;
  }

  const scores: { participant: Participant; meanError: number }[] = [];

  for (const predictor of participants) {
    const predictionsForOthers = otherPredictions[predictor.id] ?? {};
    let totalError = 0;
    let count = 0;

    for (const target of participants) {
      if (target.id === predictor.id) {
        continue;
      }
      const actual = answers[target.id]?.[firstQuestionId]?.value;
      const predicted = predictionsForOthers[target.id];
      if (typeof actual === "number" && typeof predicted === "number") {
        totalError += Math.abs(predicted - actual);
        count += 1;
      }
    }

    if (count > 0) {
      scores.push({ participant: predictor, meanError: totalError / count });
    }
  }

  if (scores.length < 2) {
    return null;
  }

  const minError = Math.min(...scores.map((item) => item.meanError));
  const winners = scores
    .filter((item) => Math.abs(item.meanError - minError) <= 1e-9)
    .map((item) => item.participant);

  if (participants.length === 2) {
    if (winners.length === 2) {
      return `${participants[0].name} and ${participants[1].name} guessed each other's answer equally closely.`;
    }
    const winner = winners[0];
    const other = participants.find((p) => p.id !== winner.id)!;
    return `${winner.name} came closest to guessing what ${other.name} answered.`;
  }

  if (winners.length === participants.length) {
    return "Everyone guessed each other's answers equally closely.";
  }

  if (winners.length === 1) {
    return `${winners[0].name} came closest to guessing what the others answered.`;
  }

  const names = winners.map((w) => w.name).join(" and ");
  return `${names} came closest to guessing what the others answered.`;
}

export function isConfidentAndWrong(
  guess: number,
  confidence: Confidence,
  planValue: number,
  scale: Scale
): boolean {
  if (confidence !== 3) {
    return false;
  }
  const range = scale.max - scale.min;
  if (range <= 0) {
    return false;
  }
  return Math.abs(guess - planValue) > 0.25 * range;
}

export type DisagreementPair = {
  personA: Participant;
  personB: Participant;
  gap: number;
};

export function getQuestionDisagreements(
  participants: Participant[],
  questionId: string,
  answers: Record<string, Record<string, QuestionAnswer>>,
  scale: Scale
): DisagreementPair[] {
  const range = scale.max - scale.min;
  const threshold = range > 0 ? 0.1 * range : 0;
  const pairs: DisagreementPair[] = [];

  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const a = participants[i];
      const b = participants[j];
      const valA = answers[a.id]?.[questionId]?.value;
      const valB = answers[b.id]?.[questionId]?.value;
      if (typeof valA !== "number" || typeof valB !== "number") {
        continue;
      }
      const gap = Math.abs(valA - valB);
      if (gap > threshold) {
        pairs.push({ personA: a, personB: b, gap });
      }
    }
  }

  return pairs.sort((x, y) => y.gap - x.gap);
}
