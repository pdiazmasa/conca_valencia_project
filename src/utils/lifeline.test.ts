import { describe, expect, it } from "vitest";
import { getGapRangePercent, valueToPercent } from "./lifeline";

describe("Lifeline position calculations", () => {
  it("maps values within range to [0, 100]", () => {
    expect(valueToPercent(0, 0, 100)).toBe(0);
    expect(valueToPercent(50, 0, 100)).toBe(50);
    expect(valueToPercent(100, 0, 100)).toBe(100);
    expect(valueToPercent(73, 50, 95)).toBeCloseTo(((73 - 50) / 45) * 100, 5);
  });

  it("clamps values outside [min, max] to [0, 100]", () => {
    expect(valueToPercent(-500, 0, 6000)).toBe(0);
    expect(valueToPercent(9999, 0, 6000)).toBe(100);
    expect(valueToPercent(40, 50, 100)).toBe(0);
    expect(valueToPercent(120, 50, 100)).toBe(100);
  });

  it("returns 0 when scale range is invalid", () => {
    expect(valueToPercent(50, 100, 100)).toBe(0);
    expect(valueToPercent(50, 100, 50)).toBe(0);
  });

  it("computes shaded gap range between furthest guess and plan", () => {
    const gap = getGapRangePercent([600, 2400], 3240, 0, 6000);
    expect(gap).not.toBeNull();
    expect(gap!.startPercent).toBeCloseTo(10, 5);
    expect(gap!.endPercent).toBeCloseTo(54, 5);
  });
});
