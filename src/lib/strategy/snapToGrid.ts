// Snap target strikes to the valid protocol grid.
// Grid: [minStrike, minStrike + tickSize, minStrike + 2*tickSize, ...]
// Returns null if no valid strike is within 0.5σ of the target.

const HALF_SIGMA_FACTOR = 2n; // 0.5σ = sigma / 2

/**
 * Snap a target strike to the nearest valid strike in the grid.
 * Returns null if the nearest valid strike is more than 0.5σ away.
 */
export function snapToGrid(
  target: bigint,
  grid: bigint[],
  sigmaMove: bigint
): bigint | null {
  if (grid.length === 0) return null;

  const halfSigma = sigmaMove / HALF_SIGMA_FACTOR;
  let best: bigint | null = null;
  let bestDiff = BigInt(Number.MAX_SAFE_INTEGER);

  for (const strike of grid) {
    const diff = target > strike ? target - strike : strike - target;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = strike;
    }
  }

  if (best === null || bestDiff > halfSigma) return null;
  return best;
}

/**
 * Snap both bounds of a range to the grid.
 * Returns [snappedLower, snappedUpper] or null if either fails or lower >= upper.
 */
export function snapRangeToGrid(
  lowerTarget: bigint,
  upperTarget: bigint,
  grid: bigint[],
  sigmaMove: bigint
): [bigint, bigint] | null {
  const lower = snapToGrid(lowerTarget, grid, sigmaMove);
  const upper = snapToGrid(upperTarget, grid, sigmaMove);

  if (lower === null || upper === null) return null;
  if (lower >= upper) return null;

  return [lower, upper];
}

/**
 * Generate the full valid strike grid from oracle min_strike and tick_size.
 * Generates strikes from min up to maxStrike (exclusive upper bound).
 * maxStrike defaults to minStrike + 100 ticks (adjustable).
 */
export function buildGrid(
  minStrike: bigint,
  tickSize: bigint,
  maxStrike?: bigint
): bigint[] {
  const max = maxStrike ?? minStrike + tickSize * 200n;
  const grid: bigint[] = [];
  for (let s = minStrike; s <= max; s += tickSize) {
    grid.push(s);
  }
  return grid;
}
