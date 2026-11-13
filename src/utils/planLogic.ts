import type {
  Confidence,
  Family,
  Participant,
  QuestionAnswer,
  Recommendation,
  Scale,
} from "../data/types";

export function getScoredRecommendations(family: Family): Recommendation[] {
  return family.recommendations.filter(
    (rec) => Boolean(rec.scoreAfterFactKey && rec.scoreAfterFactKey in family.facts)
  );
}

export function getUnscoredRecommendations(family: Family): Recommendation[] {
  return family.recommendations.filter(
    (rec) => !(rec.scoreAfterFactKey && rec.scoreAfterFactKey in family.facts)
  );
}

export function getAppliedStepCount(
  family: Family,
  selectedRecommendationIds: string[]
): number {
  const selectedSet = new Set(selectedRecommendationIds);
  const scored = getScoredRecommendations(family);
  let count = 0;

  for (const rec of scored) {
    if (!selectedSet.has(rec.id)) {
      break;
    }
    count += 1;
  }

  return count;
}

export function getSelectedIdsForStepCount(
  family: Family,
  stepCount: number
): string[] {
  const scored = getScoredRecommendations(family);
  const clamped = Math.max(0, Math.min(scored.length, stepCount));
  return scored.slice(0, clamped).map((rec) => rec.id);
}

export function getDisplayedScore(
  family: Family,
  selectedRecommendationIds: string[]
): { score: number; appliedStepCount: number; hasSelectedWithoutScore: boolean } {
  const scored = getScoredRecommendations(family);
  const appliedStepCount = getAppliedStepCount(family, selectedRecommendationIds);
  const selectedSet = new Set(selectedRecommendationIds);
  const unscored = getUnscoredRecommendations(family);
  const hasSelectedWithoutScore = unscored.some((rec) => selectedSet.has(rec.id));

  let score = family.facts.planScore ?? 0;
  if (appliedStepCount > 0) {
    const lastApplied = scored[appliedStepCount - 1];
    if (lastApplied.scoreAfterFactKey && lastApplied.scoreAfterFactKey in family.facts) {
      score = family.facts[lastApplied.scoreAfterFactKey];
    }
  }

  return { score, appliedStepCount, hasSelectedWithoutScore };
}

function formatNameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function getRevealConfidenceSummary(
  participants: Participant[],
  questionId: string,
  answers: Record<string, Record<string, QuestionAnswer>>,
  planValue: number,
  scale: Scale
): string | null {
  const entries = participants.flatMap((participant) => {
    const ans = answers[participant.id]?.[questionId];
    if (!ans) return [];
    return [
      {
        participant,
        value: ans.value,
        confidence: ans.confidence,
        distance: Math.abs(ans.value - planValue),
      },
    ];
  });

  if (entries.length === 0) {
    return null;
  }

  const range = scale.max - scale.min;

  if (entries.length === 1) {
    const only = entries[0];
    const far = range > 0 && only.distance > 0.25 * range;
    if (only.distance === 0) {
      return `${only.participant.name} matched the plan.`;
    }
    if (only.confidence === 3 && far) {
      return `${only.participant.name} was very sure, and the plan had a different number.`;
    }
    if (only.confidence === 3) {
      return `${only.participant.name} was very sure and close to the plan.`;
    }
    if (only.confidence === 2) {
      return far
        ? `${only.participant.name} was fairly sure, and the plan had a different number.`
        : `${only.participant.name} was fairly sure and close to the plan.`;
    }
    return `${only.participant.name} was just guessing.`;
  }

  const maxDist = Math.max(...entries.map((e) => e.distance));
  const minDist = Math.min(...entries.map((e) => e.distance));

  if (maxDist === 0) {
    return "Everyone matched the plan.";
  }

  if (Math.abs(maxDist - minDist) <= 1e-9) {
    if (entries.every((e) => e.confidence === 3)) {
      return "Everyone was very sure and equally close.";
    }
    return "Everyone was equally close to the plan.";
  }

  const furthestEntries = entries.filter((e) => Math.abs(e.distance - maxDist) <= 1e-9);
  const confidentFurthest = furthestEntries.filter((e) => e.confidence === 3);

  if (confidentFurthest.length === 1) {
    return `${confidentFurthest[0].participant.name} was very sure and furthest away.`;
  }
  if (confidentFurthest.length > 1) {
    return `${formatNameList(
      confidentFurthest.map((e) => e.participant.name)
    )} were very sure and furthest away.`;
  }

  const closestEntries = entries.filter((e) => Math.abs(e.distance - minDist) <= 1e-9);
  if (closestEntries.length === 1) {
    const closest = closestEntries[0];
    if (closest.distance === 0) {
      return `${closest.participant.name} matched the plan.`;
    }
    if (closest.confidence === 1) {
      return `${closest.participant.name} was just guessing and came closest.`;
    }
    if (closest.confidence === 3) {
      return `${closest.participant.name} was very sure and came closest.`;
    }
    return `${closest.participant.name} was closest.`;
  }

  return `${formatNameList(closestEntries.map((e) => e.participant.name))} were closest.`;
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
