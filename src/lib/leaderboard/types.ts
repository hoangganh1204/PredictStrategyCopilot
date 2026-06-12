// T061 — Leaderboard domain types. All amounts are raw DUSDC (scale 1e6).
// Everything here is derived purely from on-chain settled positions (FR-014).

/** The three plain-language strategy kinds, inferred from position fields. */
export type StrategyType = "binary_up" | "binary_down" | "range";

/** Aggregated performance for one investor (one PredictManager owner). */
export interface LeaderStats {
  /** Owner wallet address (full; the UI truncates for display — FR-016). */
  address: string;
  /** Net realized P&L across settled positions, raw DUSDC (scale 1e6). */
  netPnl_raw: number;
  /** Wins / (wins + losses), in [0,1]. 0 when there are no settled positions. */
  winRate: number;
  /** Number of settled positions (won + lost); excludes still-open ones. */
  settledCount: number;
  /** Strategy types of the most recent settled positions (newest first). */
  recentStrategyTypes: StrategyType[];
}

/** A LeaderStats with its 1-based position in the ranking. */
export interface RankedLeader extends LeaderStats {
  rank: number;
}

/** Ranked leaderboard payload. `sparse` is true when testnet data is thin (FR-017). */
export interface LeaderboardResult {
  leaders: RankedLeader[];
  sparse: boolean;
  /** Honest message shown when data is sparse (FR-017). */
  message?: string;
}

/** Count + net P&L of one investor's positions for a single strategy type. */
export interface StrategyBreakdown {
  type: StrategyType;
  count: number;
  netPnl_raw: number;
}

/** One settled trade, labelled in plain language for the investor detail view. */
export interface RecentTrade {
  type: StrategyType;
  /** Plain-language strategy label (FR-023). */
  label: string;
  outcome: "won" | "lost";
  /** Realized P&L of this trade, raw DUSDC (scale 1e6). */
  pnl_raw: number;
  /** Last activity timestamp (Unix ms), if known. */
  settledAt?: number;
}

/** Per-investor detail: aggregate stats + recent trades + breakdown by strategy. */
export interface InvestorDetail {
  address: string;
  /** Number of settled (closed) positions the indexer returned. */
  settledCount: number;
  /** Wins / settled, in [0,1] (0 when none settled). */
  winRate: number;
  /** Net realized P&L across settled positions, raw DUSDC (scale 1e6). */
  netPnl_raw: number;
  recentTrades: RecentTrade[];
  strategyBreakdown: StrategyBreakdown[];
}
