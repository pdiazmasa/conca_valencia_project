import type {
  Confidence,
  Day3BlockerReason,
  Day3CheckIn,
  Day3PersonResponse,
  Family,
  Participant,
  Question,
  QuestionAnswer,
  Recommendation,
  Scale,
  SessionRecord,
  StepProgressStatus,
} from "../data/types";
import { formatTemplate, formatValue } from "./format";

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

export const STEP_STATUS_LABELS: Record<StepProgressStatus, string> = {
  done: "Done",
  started: "Started",
  not_yet: "Not yet",
};

export const DAY3_BLOCKER_LABELS: Record<Day3BlockerReason, string> = {
  no_time: "No time",
  not_sure_how: "Not sure how",
  changed_minds: "We changed our minds",
  something_else: "Something else",
};

export function formatDay3PersonLine(
  participantName: string,
  response?: Day3PersonResponse
): string {
  if (!response) {
    return `${participantName}: Not recorded.`;
  }
  const statusLabel = STEP_STATUS_LABELS[response.status];
  if (response.status === "not_yet" && response.blockerReason) {
    const reasonLabel = DAY3_BLOCKER_LABELS[response.blockerReason];
    return `${participantName}: ${statusLabel} — ${reasonLabel}.`;
  }
  return `${participantName}: ${statusLabel}.`;
}

export function formatDay3FamilySummary(
  participants: Participant[],
  day3?: Day3CheckIn
): string {
  return participants
    .map((person) =>
      formatDay3PersonLine(person.name, day3?.responses?.[person.id])
    )
    .join(" ");
}

export type Day30ChangeLabel = "Closer" | "Same" | "Further";

export type Day30Comparison = {
  firstGap: number;
  todayGap: number;
  label: Day30ChangeLabel;
  magnitude: "much" | "moderate" | "same";
};

const DAY30_SAME_THRESHOLD = 0.05;
const DAY30_MUCH_THRESHOLD = 0.2;

export function getDay30Comparison(
  firstValue: number,
  todayValue: number,
  planValue: number,
  scale: Scale
): Day30Comparison {
  const firstGap = Math.abs(firstValue - planValue);
  const todayGap = Math.abs(todayValue - planValue);
  const range = scale.max - scale.min;

  if (range <= 0) {
    if (todayGap < firstGap) {
      return { firstGap, todayGap, label: "Closer", magnitude: "moderate" };
    }
    if (todayGap > firstGap) {
      return { firstGap, todayGap, label: "Further", magnitude: "moderate" };
    }
    return { firstGap, todayGap, label: "Same", magnitude: "same" };
  }

  const gapDelta = firstGap - todayGap;
  const absNormDelta = Math.abs(gapDelta) / range;

  if (todayGap === 0 && firstGap > 0) {
    return {
      firstGap,
      todayGap,
      label: "Closer",
      magnitude: absNormDelta >= DAY30_MUCH_THRESHOLD ? "much" : "moderate",
    };
  }

  if (absNormDelta <= DAY30_SAME_THRESHOLD) {
    return { firstGap, todayGap, label: "Same", magnitude: "same" };
  }

  const magnitude = absNormDelta >= DAY30_MUCH_THRESHOLD ? "much" : "moderate";
  if (gapDelta > 0) {
    return { firstGap, todayGap, label: "Closer", magnitude };
  }
  return { firstGap, todayGap, label: "Further", magnitude };
}

export function getDay30ComparisonSentence(
  participantName: string,
  firstValue: number,
  todayValue: number,
  planValue: number,
  scale: Scale
): string {
  const comparison = getDay30Comparison(firstValue, todayValue, planValue, scale);
  if (comparison.label === "Same") {
    return `${participantName} stayed about the same.`;
  }
  if (comparison.label === "Closer") {
    return comparison.magnitude === "much"
      ? `${participantName} is much closer to the plan than a month ago.`
      : `${participantName} is closer to the plan than a month ago.`;
  }
  return comparison.magnitude === "much"
    ? `${participantName} is much further from the plan than a month ago.`
    : `${participantName} is further from the plan than a month ago.`;
}

export function getAdvisorTopSummary(
  family: Family,
  session: SessionRecord
): [string, string, string] {
  // 1. Most misunderstood (largest normalised gap)
  type GapEntry = {
    question: Question;
    person: Participant;
    gap: number;
    normGap: number;
  };
  let bestGap: GapEntry | null = null;
  let tiedNames: string[] = [];

  for (const question of family.questions) {
    const planValue = family.facts[question.planFactKey];
    const range = question.scale.max - question.scale.min;

    for (const person of session.participants) {
      const ans = session.answers[person.id]?.[question.id];
      if (!ans) continue;
      const gap = Math.abs(ans.value - planValue);
      const normGap = range > 0 ? gap / range : gap > 0 ? 1 : 0;

      if (!bestGap || normGap > bestGap.normGap + 1e-9) {
        bestGap = { question, person, gap, normGap };
        tiedNames = [person.name];
      } else if (
        Math.abs(normGap - bestGap.normGap) <= 1e-9 &&
        question.id === bestGap.question.id &&
        !tiedNames.includes(person.name)
      ) {
        tiedNames.push(person.name);
      }
    }
  }

  let bullet1: string;
  if (!bestGap) {
    bullet1 = "Most misunderstood: No answers recorded yet.";
  } else if (bestGap.gap === 0) {
    bullet1 = "Most misunderstood: None — everyone matched the plan.";
  } else {
    const qPrompt = formatTemplate(bestGap.question.prompt, family, {
      question: bestGap.question,
    });
    const gapText = formatValue(bestGap.gap, bestGap.question.scale.kind, "sentence");
    const pct = Math.round(bestGap.normGap * 100);
    bullet1 = `Most misunderstood: "${qPrompt}" — ${formatNameList(
      tiedNames
    )} off by ${gapText} (${pct}% of scale).`;
  }

  // 2. Where they disagree most (largest normalised partner gap)
  let bullet2: string;
  if (session.participants.length < 2) {
    bullet2 =
      "Where they disagree most: Single-person session (only one participant).";
  } else {
    type DisagreementEntry = {
      question: Question;
      personA: Participant;
      personB: Participant;
      gap: number;
      normGap: number;
    };
    let bestDisagreement: DisagreementEntry | null = null;

    for (const question of family.questions) {
      const range = question.scale.max - question.scale.min;
      for (let i = 0; i < session.participants.length; i += 1) {
        for (let j = i + 1; j < session.participants.length; j += 1) {
          const a = session.participants[i];
          const b = session.participants[j];
          const valA = session.answers[a.id]?.[question.id]?.value;
          const valB = session.answers[b.id]?.[question.id]?.value;
          if (typeof valA !== "number" || typeof valB !== "number") continue;

          const gap = Math.abs(valA - valB);
          const normGap = range > 0 ? gap / range : gap > 0 ? 1 : 0;
          if (!bestDisagreement || normGap > bestDisagreement.normGap + 1e-9) {
            bestDisagreement = {
              question,
              personA: a,
              personB: b,
              gap,
              normGap,
            };
          }
        }
      }
    }

    if (!bestDisagreement) {
      bullet2 = "Where they disagree most: Not enough answers to compare.";
    } else if (bestDisagreement.gap === 0) {
      bullet2 = "Where they disagree most: None — everyone gave the same answers.";
    } else {
      const qPrompt = formatTemplate(bestDisagreement.question.prompt, family, {
        question: bestDisagreement.question,
      });
      const gapText = formatValue(
        bestDisagreement.gap,
        bestDisagreement.question.scale.kind,
        "sentence"
      );
      bullet2 = `Where they disagree most: "${qPrompt}" — ${bestDisagreement.personA.name} and ${bestDisagreement.personB.name} differed by ${gapText}.`;
    }
  }

  // 3. Who was confident and wrong
  const confidentWrongItems: string[] = [];
  for (const person of session.participants) {
    const flaggedQuestions: string[] = [];
    for (const question of family.questions) {
      const ans = session.answers[person.id]?.[question.id];
      if (!ans) continue;
      const planValue = family.facts[question.planFactKey];
      if (isConfidentAndWrong(ans.value, ans.confidence, planValue, question.scale)) {
        flaggedQuestions.push(
          `"${formatTemplate(question.prompt, family, { question })}"`
        );
      }
    }
    if (flaggedQuestions.length > 0) {
      confidentWrongItems.push(`${person.name} (${flaggedQuestions.join(", ")})`);
    }
  }

  const bullet3 =
    confidentWrongItems.length === 0
      ? "Confident and wrong: Nobody was very sure and far from the plan."
      : `Confident and wrong: ${confidentWrongItems.join("; ")}.`;

  return [bullet1, bullet2, bullet3];
}
