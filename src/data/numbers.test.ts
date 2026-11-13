import { describe, expect, it } from "vitest";
import { FAMILIES } from "./index";
import type { Family } from "./types";
import { validateFamily } from "../../scripts/numberGuard.mjs";

describe("number guard on family JSON data", () => {
  it("passes for all demo families", () => {
    expect(FAMILIES.length).toBe(4);
    for (const family of FAMILIES) {
      const result = validateFamily(family);
      expect(result.errors, `Errors in ${family.id}`).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });

  it("fails when a string introduces a number not present in facts", () => {
    const weah = FAMILIES.find((f) => f.id === "weah")!;
    const badFamily: Family = {
      ...weah,
      questions: [
        {
          ...weah.questions[0],
          revealSentence: "Your plan scores out of 100 and costs $9,999 a year.",
        },
      ],
    };

    const result = validateFamily(badFamily);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes("100"))).toBe(true);
    expect(result.errors.some((err) => err.includes("9999"))).toBe(true);
  });

  it("fails when a placeholder, planFactKey, or scoreAfterFactKey references a missing fact", () => {
    const weah = FAMILIES.find((f) => f.id === "weah")!;
    const badFamily: Family = {
      ...weah,
      questions: [
        {
          ...weah.questions[0],
          planFactKey: "missingPlanKey",
          revealSentence: "Your plan shows {missingPlaceholder} here.",
        },
      ],
      recommendations: [
        {
          ...weah.recommendations[0],
          scoreAfterFactKey: "missingScoreKey",
        },
      ],
    };

    const result = validateFamily(badFamily);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes("missingPlanKey"))).toBe(true);
    expect(result.errors.some((err) => err.includes("missingPlaceholder"))).toBe(true);
    expect(result.errors.some((err) => err.includes("missingScoreKey"))).toBe(true);
  });
});
