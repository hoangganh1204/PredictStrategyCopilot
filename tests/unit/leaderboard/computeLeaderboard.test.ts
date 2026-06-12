import { describe, it, expect } from "vitest";
import {
  aggregateLeaderStats,
  rankLeaders,
  truncateAddress,
  MIN_SETTLED_THRESHOLD,
} from "../../../src/lib/leaderboard/computeLeaderboard.js";
import type { LeaderStats } from "../../../src/lib/leaderboard/types.js";
import type { PositionSummaryItem } from "../../../src/types/predict-server.js";

// Minimal PositionSummaryItem factory — only the fields the engine reads.
let seq = 0;
function mk(p: Partial<PositionSummaryItem>): PositionSummaryItem {
  seq += 1;
  return {
    predict_id: "0xpredict",
    manager_id: "0xmanager",
    oracle_id: "0xoracle",
    underlying_asset: "BTC",
    expiry: 1_781_253_000_000,
    minted_quantity: 1,
    open_quantity: 0,
    total_cost: 0,
    unrealized_pnl: 0,
    realized_pnl: 0,
    status: "active",
    last_activity_at: seq,
    ...p,
  } as PositionSummaryItem;
}

describe("truncateAddress", () => {
  it("renders 6 leading + ... + 4 trailing chars", () => {
    expect(truncateAddress("0x1234567890abcdef")).toBe("0x1234...cdef");
  });
  it("leaves short strings untouched", () => {
    expect(truncateAddress("0xabcd")).toBe("0xabcd");
  });
  it("handles empty input", () => {
    expect(truncateAddress("")).toBe("");
  });
});

describe("aggregateLeaderStats", () => {
  it("sums net P&L from settled positions only and ignores open ones", () => {
    const positions = [
      mk({ status: "redeemable", is_up: true, realized_pnl: 100 }), // won
      mk({ status: "redeemed", is_up: true, realized_pnl: 50 }), // won
      mk({ status: "lost", is_up: false, realized_pnl: -30 }), // lost
      mk({ status: "active", is_up: true, realized_pnl: 0 }), // open — ignored
    ];
    const stats = aggregateLeaderStats("0xowner", positions);
    expect(stats.address).toBe("0xowner");
    expect(stats.netPnl_raw).toBe(120);
    expect(stats.settledCount).toBe(3);
    expect(stats.winRate).toBeCloseTo(2 / 3, 5);
  });

  it("returns winRate 0 (not NaN) when there are no settled positions", () => {
    const stats = aggregateLeaderStats("0xowner", [mk({ status: "active" })]);
    expect(stats.settledCount).toBe(0);
    expect(stats.netPnl_raw).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(Number.isNaN(stats.winRate)).toBe(false);
  });

  it("collects recent strategy types newest-first", () => {
    const positions = [
      mk({ status: "lost", is_up: false, last_activity_at: 1 }),
      mk({ status: "redeemed", is_up: true, last_activity_at: 3 }),
      mk({ status: "redeemable", lower_strike: 1, higher_strike: 2, last_activity_at: 2 }),
    ];
    const stats = aggregateLeaderStats("0xowner", positions);
    expect(stats.recentStrategyTypes[0]).toBe("binary_up"); // newest (ts=3)
    expect(stats.recentStrategyTypes).toContain("range");
    expect(stats.recentStrategyTypes).toContain("binary_down");
  });
});

describe("rankLeaders", () => {
  const base: Omit<LeaderStats, "address" | "netPnl_raw" | "winRate" | "settledCount"> = {
    recentStrategyTypes: [],
  };
  const leader = (address: string, netPnl_raw: number, winRate: number, settledCount: number): LeaderStats => ({
    ...base,
    address,
    netPnl_raw,
    winRate,
    settledCount,
  });

  it("sorts by net P&L descending and assigns 1-based ranks", () => {
    const result = rankLeaders([
      leader("0xa", 50, 0.5, 4),
      leader("0xb", 200, 0.5, 4),
      leader("0xc", 100, 0.5, 4),
    ]);
    expect(result.leaders.map((l) => l.address)).toEqual(["0xb", "0xc", "0xa"]);
    expect(result.leaders.map((l) => l.rank)).toEqual([1, 2, 3]);
  });

  it("breaks P&L ties by win rate descending", () => {
    const result = rankLeaders([
      leader("0xlow", 100, 0.4, 5),
      leader("0xhigh", 100, 0.9, 5),
    ]);
    expect(result.leaders[0].address).toBe("0xhigh");
  });

  it("excludes investors with no settled activity", () => {
    const result = rankLeaders([leader("0xa", 0, 0, 0), leader("0xb", 10, 1, MIN_SETTLED_THRESHOLD)]);
    expect(result.leaders.map((l) => l.address)).toEqual(["0xb"]);
  });

  it("flags sparse when total settled count is below the threshold", () => {
    const result = rankLeaders([leader("0xa", 10, 1, 1)]);
    expect(result.sparse).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it("is not sparse once the threshold is met", () => {
    const result = rankLeaders([leader("0xa", 10, 1, MIN_SETTLED_THRESHOLD)]);
    expect(result.sparse).toBe(false);
    expect(result.message).toBeUndefined();
  });
});
