import { describe, it, expect } from "vitest";
import { snapToGrid, snapRangeToGrid } from "@/lib/strategy/snapToGrid";

// Use $1,000-step grid (1e12 raw) so test targets fall between grid points
// Real tick_size=1e9=$1, but $1,000 step makes test cases readable
const STEP = 1_000_000_000_000n; // $1,000 per step in 1e9 scale
function makeGrid(from: bigint, to: bigint, step: bigint): bigint[] {
  const result: bigint[] = [];
  for (let s = from; s <= to; s += step) result.push(s);
  return result;
}

const GRID = makeGrid(50_000_000_000_000n, 70_000_000_000_000n, STEP);
// GRID: [50000e9, 51000e9, 52000e9, ..., 70000e9]

const SIGMA_MOVE = 2_000_000_000_000n; // $2,000 sigma → 0.5σ = $1,000

describe("snapToGrid", () => {
  it("exact match returns that strike", () => {
    const result = snapToGrid(60_000_000_000_000n, GRID, SIGMA_MOVE);
    expect(result).toBe(60_000_000_000_000n);
  });

  it("snaps to nearest strike below when closer", () => {
    // $60,300 → nearest $60,000 (diff=300) vs $61,000 (diff=700) → $60,000
    const result = snapToGrid(60_300_000_000_000n, GRID, SIGMA_MOVE);
    expect(result).toBe(60_000_000_000_000n);
  });

  it("snaps to nearest strike above when closer", () => {
    // $60,700 → nearest $61,000 (diff=300) vs $60,000 (diff=700) → $61,000
    const result = snapToGrid(60_700_000_000_000n, GRID, SIGMA_MOVE);
    expect(result).toBe(61_000_000_000_000n);
  });

  it("returns null when target is beyond 0.5σ from nearest valid strike", () => {
    // σ=$2,000 → 0.5σ=$1,000; $49,001 → nearest=$50,000, diff=$999 < $1,000 → snaps
    // $48,900 → nearest=$50,000, diff=$1,100 > $1,000 → null
    const result = snapToGrid(48_900_000_000_000n, GRID, SIGMA_MOVE);
    expect(result).toBeNull();
  });

  it("returns null for target above grid by more than 0.5σ", () => {
    // $71,100 → nearest=$70,000, diff=$1,100 > $1,000 → null
    const result = snapToGrid(71_100_000_000_000n, GRID, SIGMA_MOVE);
    expect(result).toBeNull();
  });

  it("snaps when within 0.5σ of grid start", () => {
    // $49,100 → nearest=$50,000, diff=$900 < $1,000 → snap to $50,000
    const result = snapToGrid(49_100_000_000_000n, GRID, SIGMA_MOVE);
    expect(result).toBe(50_000_000_000_000n);
  });
});

describe("snapRangeToGrid", () => {
  it("snaps both bounds to valid strikes", () => {
    // lower=$59,300 → $59,000 (diff=300); upper=$61,700 → $62,000 (diff=300)
    const result = snapRangeToGrid(
      59_300_000_000_000n, // → $59,000
      61_700_000_000_000n, // → $62,000
      GRID,
      SIGMA_MOVE
    );
    expect(result).not.toBeNull();
    expect(result![0]).toBe(59_000_000_000_000n);
    expect(result![1]).toBe(62_000_000_000_000n);
  });

  it("returns null when both bounds snap to same strike", () => {
    // lower=$59,600 → $60,000; upper=$60,400 → $60,000 → lower == upper → null
    const result = snapRangeToGrid(
      59_600_000_000_000n,
      60_400_000_000_000n,
      GRID,
      SIGMA_MOVE
    );
    expect(result).toBeNull();
  });

  it("returns null when lower bound snap fails", () => {
    const result = snapRangeToGrid(
      48_800_000_000_000n, // too far below grid (diff=$1,200 > $1,000)
      61_000_000_000_000n,
      GRID,
      SIGMA_MOVE
    );
    expect(result).toBeNull();
  });

  it("returns null when upper bound snap fails", () => {
    const result = snapRangeToGrid(
      60_000_000_000_000n,
      71_200_000_000_000n, // too far above grid
      GRID,
      SIGMA_MOVE
    );
    expect(result).toBeNull();
  });

  it("ensures lower < upper after snapping", () => {
    const result = snapRangeToGrid(
      62_300_000_000_000n, // → $62,000
      65_700_000_000_000n, // → $66,000
      GRID,
      SIGMA_MOVE
    );
    expect(result).not.toBeNull();
    expect(result![0]).toBeLessThan(result![1]);
  });
});
