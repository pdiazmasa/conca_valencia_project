export type LabelAnchor = "start" | "middle" | "end";

export type LabelLayoutItem = {
  id: string;
  percent: number;
  label: string;
};

export type PositionedLabel = LabelLayoutItem & {
  row: number;
  anchor: LabelAnchor;
  boxStartPct: number;
  boxEndPct: number;
};

const MIN_PERCENT_SEPARATION = 15;
const LABEL_HORIZONTAL_PADDING_PCT = 2;

export function valueToPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0;
  }
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function getFurthestGuessValue(guessValues: number[], planValue: number): number | null {
  if (guessValues.length === 0) {
    return null;
  }
  let furthest = guessValues[0];
  let maxDistance = Math.abs(furthest - planValue);

  for (let i = 1; i < guessValues.length; i += 1) {
    const distance = Math.abs(guessValues[i] - planValue);
    if (distance > maxDistance) {
      maxDistance = distance;
      furthest = guessValues[i];
    }
  }
  return furthest;
}

export function getGapRangePercent(
  guessValues: number[],
  planValue: number,
  min: number,
  max: number
): { startPercent: number; endPercent: number } | null {
  const furthest = getFurthestGuessValue(guessValues, planValue);
  if (furthest === null) {
    return null;
  }
  const furthestPct = valueToPercent(furthest, min, max);
  const planPct = valueToPercent(planValue, min, max);
  return {
    startPercent: Math.min(furthestPct, planPct),
    endPercent: Math.max(furthestPct, planPct),
  };
}

export function computeLabelBox(
  percent: number,
  label: string
): { anchor: LabelAnchor; boxStartPct: number; boxEndPct: number } {
  // Conservative mobile track width (~295px) at ~18px label font so labels stay separated on 375px screens
  const estimatedWidthPct = Math.min(72, ((label.length * 8.8 + 12) / 295) * 100);

  if (percent < 20) {
    const start = Math.max(0, Math.min(100 - estimatedWidthPct, percent - 4));
    return {
      anchor: "start",
      boxStartPct: start,
      boxEndPct: start + estimatedWidthPct,
    };
  }

  if (percent > 80) {
    const end = Math.min(100, Math.max(estimatedWidthPct, percent + 4));
    return {
      anchor: "end",
      boxStartPct: end - estimatedWidthPct,
      boxEndPct: end,
    };
  }

  const start = Math.max(
    0,
    Math.min(100 - estimatedWidthPct, percent - estimatedWidthPct / 2)
  );
  return {
    anchor: "middle",
    boxStartPct: start,
    boxEndPct: start + estimatedWidthPct,
  };
}

/**
 * Assigns non-overlapping rows for lifeline mark labels.
 * Marks closer than 15% of the track width or with overlapping label spans
 * are stacked on separate rows.
 */
export function assignLabelRows(items: LabelLayoutItem[]): PositionedLabel[] {
  const sorted = [...items].sort((a, b) => a.percent - b.percent);
  const rows: PositionedLabel[][] = [];
  const placedById = new Map<string, PositionedLabel>();

  for (const item of sorted) {
    const box = computeLabelBox(item.percent, item.label);
    let assignedRow = 0;

    while (true) {
      const rowItems = rows[assignedRow] ?? [];
      const conflicts = rowItems.some(
        (existing) =>
          Math.abs(existing.percent - item.percent) < MIN_PERCENT_SEPARATION ||
          (box.boxStartPct < existing.boxEndPct + LABEL_HORIZONTAL_PADDING_PCT &&
            box.boxEndPct + LABEL_HORIZONTAL_PADDING_PCT > existing.boxStartPct)
      );
      if (!conflicts) {
        const positioned: PositionedLabel = {
          ...item,
          ...box,
          row: assignedRow,
        };
        rowItems.push(positioned);
        rows[assignedRow] = rowItems;
        placedById.set(item.id, positioned);
        break;
      }
      assignedRow += 1;
    }
  }

  return items.map((item) => placedById.get(item.id)!);
}
