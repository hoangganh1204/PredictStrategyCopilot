// Shared classifiers for leaderboard aggregation. Kept separate so both
// computeLeaderboard.ts and investorDetail.ts agree on what "settled" means.
import type { PositionSummaryItem } from "@/types/predict-server.js";
import type { StrategyType } from "./types.js";

export type Outcome = "won" | "lost" | "open";

/**
 * Map a Public Server position status to a settled outcome.
 * Real testnet vocabulary: "active", "redeemable" (won, unclaimed), "lost",
 * "redeemed" (won, claimed). We also tolerate the normalized spellings.
 */
export function classifyOutcome(status: string): Outcome {
  switch (status) {
    case "redeemable":
    case "redeemed":
    case "settled_won":
      return "won";
    case "lost":
    case "settled_lost":
      return "lost";
    default:
      // active / awaiting_settlement / pending / anything else
      return "open";
  }
}

/** Infer the strategy type from a position's strike/range/direction fields. */
export function inferStrategyType(p: PositionSummaryItem): StrategyType {
  if (p.lower_strike !== undefined || p.higher_strike !== undefined) return "range";
  if (p.is_up === false) return "binary_down";
  // Default to up: binary positions always carry is_up; range is handled above.
  return "binary_up";
}
