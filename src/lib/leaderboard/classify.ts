// Shared classifiers for leaderboard aggregation. Kept separate so both
// computeLeaderboard.ts and investorDetail.ts agree on what "settled" means.
import type { PositionSummaryItem } from "@/types/predict-server.js";
import type { StrategyType } from "./types.js";

export type Outcome = "won" | "lost" | "open";

const OPEN_STATUSES = new Set(["active", "awaiting_settlement", "pending"]);

/**
 * Outcome of a position. While its market is unresolved it's "open"; once the
 * position is closed, the outcome follows the REALIZED P&L sign.
 *
 * Status alone is NOT reliable: the server marks both wins and losses as
 * "redeemed" (a lost binary has payout 0 but cost > 0 → negative realized_pnl).
 * Verified on testnet: ~55% of "redeemed" positions are actually losses. So we
 * decide win/loss from realized_pnl, not the status string.
 */
export function classifyOutcome(p: { status: string; realized_pnl?: number }): Outcome {
  if (OPEN_STATUSES.has(p.status)) return "open";
  return (p.realized_pnl ?? 0) >= 0 ? "won" : "lost";
}

/** Infer the strategy type from a position's strike/range/direction fields. */
export function inferStrategyType(p: PositionSummaryItem): StrategyType {
  if (p.lower_strike !== undefined || p.higher_strike !== undefined) return "range";
  if (p.is_up === false) return "binary_down";
  // Default to up: binary positions always carry is_up; range is handled above.
  return "binary_up";
}
