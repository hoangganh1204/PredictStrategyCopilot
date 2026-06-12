// T066 — Per-investor detail: breakdown by strategy + recent settled trades.
// Pure functions over on-chain position data (FR-014); labels are plain language (FR-023).
import type { PositionSummaryItem } from "@/types/predict-server.js";
import type { InvestorDetail, RecentTrade, StrategyBreakdown, StrategyType } from "./types.js";
import { classifyOutcome, inferStrategyType } from "./classify.js";

/** Plain-language strategy labels, matching StrategyCard/PositionCard across the app. */
export const STRATEGY_LABELS: Record<StrategyType, string> = {
  binary_up: "Price up",
  binary_down: "Crash hedge",
  range: "Stay in range",
};

const DEFAULT_RECENT_LIMIT = 5;

function byRecency(a: PositionSummaryItem, b: PositionSummaryItem): number {
  const ta = Number((a.last_activity_at as number | undefined) ?? 0);
  const tb = Number((b.last_activity_at as number | undefined) ?? 0);
  return tb - ta;
}

/** Group an investor's settled positions by strategy type: count + net P&L per type. */
export function getStrategyBreakdown(positions: PositionSummaryItem[]): StrategyBreakdown[] {
  const byType = new Map<StrategyType, StrategyBreakdown>();
  for (const p of positions) {
    if (classifyOutcome(p) === "open") continue;
    const type = inferStrategyType(p);
    const entry = byType.get(type) ?? { type, count: 0, netPnl_raw: 0 };
    entry.count += 1;
    entry.netPnl_raw += p.realized_pnl ?? 0;
    byType.set(type, entry);
  }
  return [...byType.values()].sort((a, b) => b.count - a.count);
}

/** The last `limit` settled trades, newest-first, each with a plain-language label. */
export function getRecentTrades(
  positions: PositionSummaryItem[],
  limit = DEFAULT_RECENT_LIMIT
): RecentTrade[] {
  return positions
    .filter((p) => classifyOutcome(p) !== "open")
    .sort(byRecency)
    .slice(0, limit)
    .map((p) => {
      const type = inferStrategyType(p);
      const ts = Number((p.last_activity_at as number | undefined) ?? 0);
      return {
        type,
        label: STRATEGY_LABELS[type],
        outcome: classifyOutcome(p) === "won" ? "won" : "lost",
        pnl_raw: p.realized_pnl ?? 0,
        settledAt: ts || undefined,
      };
    });
}

/** Assemble the full investor detail payload, incl. aggregate stats. */
export function buildInvestorDetail(
  address: string,
  positions: PositionSummaryItem[],
  recentLimit = DEFAULT_RECENT_LIMIT
): InvestorDetail {
  const settled = positions.filter((p) => classifyOutcome(p) !== "open");
  const wins = settled.filter((p) => classifyOutcome(p) === "won").length;
  return {
    address,
    settledCount: settled.length,
    winRate: settled.length > 0 ? wins / settled.length : 0,
    netPnl_raw: settled.reduce((s, p) => s + (p.realized_pnl ?? 0), 0),
    recentTrades: getRecentTrades(positions, recentLimit),
    strategyBreakdown: getStrategyBreakdown(positions),
  };
}
