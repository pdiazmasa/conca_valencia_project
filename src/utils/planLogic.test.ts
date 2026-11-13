import { describe, expect, it } from "vitest";
import { FAMILIES } from "../data";
import type { SessionRecord } from "../data/types";
import {
  formatDay3FamilySummary,
  getAdvisorTopSummary,
  getAppliedStepCount,
  getBestPredictorSummary,
  getDay30Comparison,
  getDay30ComparisonSentence,
  getDisplayedScore,
  getRevealConfidenceSummary,
  getScoredRecommendations,
  getSelectedIdsForStepCount,
  getUnscoredRecommendations,
  isConfidentAndWrong,
} from "./planLogic";

describe("Ordered recommendation ladder logic", () => {
  const weah = FAMILIES.find((f) => f.id === "weah")!;

  it("separates scored steps in JSON order from unscored recommendations", () => {
    expect(getScoredRecommendations(weah).map((r) => r.id)).toEqual([
      "pay_card",
      "life_insurance",
      "college",
    ]);
    expect(getUnscoredRecommendations(weah).map((r) => r.id)).toEqual([
      "liability",
    ]);
  });

  it("returns baseline planScore when nothing is selected", () => {
    expect(getDisplayedScore(weah, [])).toEqual({
      score: 60,
      appliedStepCount: 0,
      hasSelectedWithoutScore: false,
    });
  });

  it("shows 62, 73, 78 only cumulatively in order", () => {
    expect(getDisplayedScore(weah, getSelectedIdsForStepCount(weah, 1))).toEqual({
      score: 62,
      appliedStepCount: 1,
      hasSelectedWithoutScore: false,
    });
    expect(getDisplayedScore(weah, getSelectedIdsForStepCount(weah, 2))).toEqual({
      score: 73,
      appliedStepCount: 2,
      hasSelectedWithoutScore: false,
    });
    expect(getDisplayedScore(weah, getSelectedIdsForStepCount(weah, 3))).toEqual({
      score: 78,
      appliedStepCount: 3,
      hasSelectedWithoutScore: false,
    });
  });

  it("cannot skip earlier steps even if later recommendation ids are passed", () => {
    expect(getAppliedStepCount(weah, ["life_insurance"])).toBe(0);
    expect(getDisplayedScore(weah, ["life_insurance"])).toEqual({
      score: 60,
      appliedStepCount: 0,
      hasSelectedWithoutScore: false,
    });

    expect(getAppliedStepCount(weah, ["pay_card", "college"])).toBe(1);
    expect(getDisplayedScore(weah, ["pay_card", "college"])).toEqual({
      score: 62,
      appliedStepCount: 1,
      hasSelectedWithoutScore: false,
    });
  });

  it("flags when an unscored recommendation id is included", () => {
    expect(getDisplayedScore(weah, ["liability"])).toEqual({
      score: 60,
      appliedStepCount: 0,
      hasSelectedWithoutScore: true,
    });
  });
});

describe("Advisor flags and reveal summaries", () => {
  it("flags confident and wrong only when confidence is 3 and distance > 25% of range", () => {
    const scale = { kind: "score" as const, min: 0, max: 100, unit: "score" };
    expect(isConfidentAndWrong(20, 3, 60, scale)).toBe(true);
    expect(isConfidentAndWrong(35, 3, 60, scale)).toBe(false); // exactly 25%, not > 25%
    expect(isConfidentAndWrong(20, 2, 60, scale)).toBe(false);
  });

  it("describes who predicted the other best in words without points", () => {
    const participants = [
      { id: "p1", name: "Timothy" },
      { id: "p2", name: "Melanie" },
    ];
    const answers = {
      p1: { card_interest: { value: 600, confidence: 2 as const } },
      p2: { card_interest: { value: 1800, confidence: 3 as const } },
    };
    const predictions = {
      p1: { p2: 1740 }, // off by 60
      p2: { p1: 3000 }, // off by 2400
    };
    const summary = getBestPredictorSummary(
      participants,
      "card_interest",
      answers,
      predictions
    );
    expect(summary).toContain("Timothy");
    expect(summary).not.toMatch(/\d/);
  });

  it("derives reveal confidence summary in words without any numbers", () => {
    const scale = { kind: "usd_per_year" as const, min: 0, max: 6000, unit: "$/year" };
    const participants = [
      { id: "p1", name: "Timothy" },
      { id: "p2", name: "Melanie" },
    ];

    const confidentFurthest = getRevealConfidenceSummary(
      participants,
      "card_interest",
      {
        p1: { card_interest: { value: 600, confidence: 3 } },
        p2: { card_interest: { value: 2400, confidence: 1 } },
      },
      3240,
      scale
    );
    expect(confidentFurthest).toBe("Timothy was very sure and furthest away.");
    expect(confidentFurthest).not.toMatch(/\d/);

    const closestOnly = getRevealConfidenceSummary(
      participants,
      "plan_score",
      {
        p1: { plan_score: { value: 80, confidence: 2 } },
        p2: { plan_score: { value: 65, confidence: 2 } },
      },
      60,
      { kind: "score", min: 0, max: 100, unit: "score" }
    );
    expect(closestOnly).toBe("Melanie was closest.");
    expect(closestOnly).not.toMatch(/\d/);

    const solo = getRevealConfidenceSummary(
      [{ id: "p1", name: "Samantha" }],
      "run_out_age",
      {
        p1: { run_out_age: { value: 90, confidence: 3 } },
      },
      73,
      { kind: "age", min: 50, max: 95, unit: "age" }
    );
    expect(solo).toContain("Samantha");
    expect(solo).toContain("very sure");
    expect(solo).not.toMatch(/\d/);
  });
});

describe("Day 3 summary, Day 30 comparison labels, and Advisor 3-bullet summary", () => {
  const cardScale = {
    kind: "usd_per_year" as const,
    min: 0,
    max: 6000,
    unit: "$/year",
  };

  it("formats Day 3 family summary with statuses and blocker reason", () => {
    const summary = formatDay3FamilySummary(
      [
        { id: "p1", name: "Timothy" },
        { id: "p2", name: "Melanie" },
      ],
      {
        responses: {
          p1: { status: "started" },
          p2: { status: "not_yet", blockerReason: "not_sure_how" },
        },
      }
    );
    expect(summary).toBe("Timothy: Started. Melanie: Not yet — Not sure how.");
  });

  it("assigns Closer, Same, and Further labels and word-only sentences", () => {
    // Much closer: 600 -> 3000 vs plan 3240 (range 6000)
    const closer = getDay30Comparison(600, 3000, 3240, cardScale);
    expect(closer).toEqual({
      firstGap: 2640,
      todayGap: 240,
      label: "Closer",
      magnitude: "much",
    });
    const closerSentence = getDay30ComparisonSentence(
      "Timothy",
      600,
      3000,
      3240,
      cardScale
    );
    expect(closerSentence).toBe(
      "Timothy is much closer to the plan than a month ago."
    );
    expect(closerSentence).not.toMatch(/\d/);

    // Same: 1200 -> 1320 vs plan 3240 (delta 120 = 2% of 6000 <= 5%)
    const same = getDay30Comparison(1200, 1320, 3240, cardScale);
    expect(same.label).toBe("Same");
    const sameSentence = getDay30ComparisonSentence(
      "Melanie",
      1200,
      1320,
      3240,
      cardScale
    );
    expect(sameSentence).toBe("Melanie stayed about the same.");
    expect(sameSentence).not.toMatch(/\d/);

    // Further: 2400 -> 600 vs plan 3240
    const further = getDay30Comparison(2400, 600, 3240, cardScale);
    expect(further).toEqual({
      firstGap: 840,
      todayGap: 2640,
      label: "Further",
      magnitude: "much",
    });
    const furtherSentence = getDay30ComparisonSentence(
      "Timothy",
      2400,
      600,
      3240,
      cardScale
    );
    expect(furtherSentence).toBe(
      "Timothy is much further from the plan than a month ago."
    );
    expect(furtherSentence).not.toMatch(/\d/);

    // Exact match on Day 30 even within 5% of plan counts as Closer
    const exactMatch = getDay30Comparison(75, 73, 73, {
      kind: "age",
      min: 50,
      max: 95,
      unit: "age",
    });
    expect(exactMatch.label).toBe("Closer");
  });

  it("builds the 3-bullet Advisor top summary using normalised gaps", () => {
    const weah = FAMILIES.find((f) => f.id === "weah")!;
    const session: SessionRecord = {
      id: "s1",
      familyId: "weah",
      familyDisplayName: "Weah family",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      participants: [
        { id: "person-1", name: "Timothy" },
        { id: "person-2", name: "Melanie" },
      ],
      answers: {
        "person-1": {
          card_interest: { value: 600, confidence: 3 }, // gap 2640/6000 = 44%, confident & wrong
          plan_score: { value: 85, confidence: 2 }, // diff vs Melanie = 25/100 = 25%
        },
        "person-2": {
          card_interest: { value: 1200, confidence: 1 }, // diff vs Timothy = 600/6000 = 10%
          plan_score: { value: 60, confidence: 2 },
        },
      },
      otherPredictions: {},
      selectedRecommendationIds: [],
      checkIns: {},
    };

    const bullets = getAdvisorTopSummary(weah, session);
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toContain("Most misunderstood");
    expect(bullets[0]).toContain("Timothy");
    expect(bullets[0]).toContain("$2,640");
    expect(bullets[1]).toContain("Where they disagree most");
    expect(bullets[1]).toContain("plan got");
    expect(bullets[1]).toContain("25");
    expect(bullets[2]).toContain("Confident and wrong");
    expect(bullets[2]).toContain("Timothy");
  });
});
