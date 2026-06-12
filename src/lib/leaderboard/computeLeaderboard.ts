// T065 — Pure leaderboard aggregation. No I/O: takes positions, returns stats.
// Metrics count settled positions only, computed entirely from on-chain data (FR-014).
import type { PositionSummaryItem } from "@/types/predict-server.js";
import type { LeaderStats, LeaderboardResult, RankedLeader } from "./types.js";
import { classifyOutcome, inferStrategyType } from "./classify.js";

/** Below this many total settled positions, the board is "sparse" (FR-017). */
export const MIN_SETTLED_THRESHOLD = 5;

/** How many recent strategy types to surface per leader. */
const RECENT_STRATEGY_LIMIT = 3;

/** Newest activity first; positions without a timestamp sort last. */
function byRecency(a: PositionSummaryItem, b: PositionSummaryItem): number {
  const ta = Number((a.last_activity_at as number | undefined) ?? 0);
  const tb = Number((b.last_activity_at as number | undefined) ?? 0);
  return tb - ta;
}

/** "0x1234...cdef" — 6 leading + "..." + 4 trailing. Short strings pass through. */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Aggregate one investor's settled performance. winRate is 0 (never NaN) with no settled. */
export function aggregateLeaderStats(
  address: string,
  positions: PositionSummaryItem[]
): LeaderStats {
  const settled = positions.filter((p) => classifyOutcome(p.status) !== "open");

  let netPnl_raw = 0;
  let wins = 0;
  for (const p of settled) {
    netPnl_raw += p.realized_pnl ?? 0;
    if (classifyOutcome(p.status) === "won") wins += 1;
  }

  const settledCount = settled.length;
  const winRate = settledCount > 0 ? wins / settledCount : 0;
  const recentStrategyTypes = [...settled]
    .sort(byRecency)
    .slice(0, RECENT_STRATEGY_LIMIT)
    .map(inferStrategyType);

  return { address, netPnl_raw, winRate, settledCount, recentStrategyTypes };
}

/**
 * Rank investors by net P&L (desc), tie-broken by win rate then settled count.
 * Only investors with settled activity appear. `sparse` is set when the combined
 * settled count is below MIN_SETTLED_THRESHOLD so the UI can be honest (FR-017).
 */
export function rankLeaders(allStats: LeaderStats[]): LeaderboardResult {
  const active = allStats.filter((s) => s.settledCount > 0);
  const sorted = [...active].sort(
    (a, b) =>
      b.netPnl_raw - a.netPnl_raw ||
      b.winRate - a.winRate ||
      b.settledCount - a.settledCount
  );
  const leaders: RankedLeader[] = sorted.map((s, i) => ({ ...s, rank: i + 1 }));

  const totalSettled = active.reduce((sum, s) => sum + s.settledCount, 0);
  const sparse = totalSettled < MIN_SETTLED_THRESHOLD;

  return {
    leaders,
    sparse,
    message: sparse
      ? "Data is still thin — few settled bets on testnet so far. The leaderboard fills out as more people play."
      : undefined,
  };
}
