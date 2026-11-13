import { describe, expect, it } from "vitest";
import { assignLabelRows, getGapRangePercent, valueToPercent } from "./lifeline";

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

describe("Lifeline non-overlapping label row assignment", () => {
  it("stacks two marks closer than 15% onto different rows", () => {
    const layout = assignLabelRows([
      { id: "a", percent: 40, label: "Timothy: $2,400" },
      { id: "b", percent: 48, label: "Melanie: $2,880" },
    ]);
    expect(layout[0].row).not.toBe(layout[1].row);
  });

  it("places up to 5 clustered marks onto distinct non-overlapping rows", () => {
    const layout = assignLabelRows([
      { id: "m1", percent: 42, label: "Timothy: $2,520" },
      { id: "m2", percent: 45, label: "Melanie: $2,700" },
      { id: "m3", percent: 49, label: "Alex: $2,940" },
      { id: "m4", percent: 52, label: "Jordan: $3,120" },
      { id: "m5", percent: 55, label: "Today: $3,300" },
    ]);

    const rows = new Set(layout.map((item) => item.row));
    expect(rows.size).toBe(5);
  });

  it("allows well-separated marks at opposite ends to share a row", () => {
    const layout = assignLabelRows([
      { id: "left", percent: 5, label: "Timothy: $300" },
      { id: "right", percent: 92, label: "Melanie: $5,520" },
    ]);
    expect(layout[0].row).toBe(0);
    expect(layout[1].row).toBe(0);
  });
});
