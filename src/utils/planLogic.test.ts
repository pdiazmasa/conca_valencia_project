import { describe, expect, it } from "vitest";
import { FAMILIES } from "../data";
import {
  getBestPredictorSummary,
  getDisplayedScore,
  isConfidentAndWrong,
} from "./planLogic";

describe("Recommendation score toggling", () => {
  const weah = FAMILIES.find((f) => f.id === "weah")!;

  it("returns baseline planScore when nothing is selected", () => {
    expect(getDisplayedScore(weah, [])).toEqual({
      score: 60,
      hasSelectedWithoutScore: false,
    });
  });

  it("returns the fact of the last selected recommendation with a score key", () => {
    expect(getDisplayedScore(weah, ["pay_card"])).toEqual({
      score: 62,
      hasSelectedWithoutScore: false,
    });
    expect(getDisplayedScore(weah, ["pay_card", "life_insurance"])).toEqual({
      score: 73,
      hasSelectedWithoutScore: false,
    });
    expect(
      getDisplayedScore(weah, ["pay_card", "life_insurance", "college"])
    ).toEqual({
      score: 78,
      hasSelectedWithoutScore: false,
    });
    expect(
      getDisplayedScore(weah, [
        "pay_card",
        "life_insurance",
        "college",
        "liability",
      ])
    ).toEqual({
      score: 78,
      hasSelectedWithoutScore: true,
    });
  });

  it("flags when only a recommendation without score key is selected", () => {
    expect(getDisplayedScore(weah, ["liability"])).toEqual({
      score: 60,
      hasSelectedWithoutScore: true,
    });
  });
});

describe("Advisor flags and best predictor summary", () => {
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
});
