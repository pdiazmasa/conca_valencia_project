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
