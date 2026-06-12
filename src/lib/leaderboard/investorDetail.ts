// T066 — Per-investor detail: breakdown by strategy + recent settled trades.
// Pure functions over on-chain position data (FR-014); labels are plain language (FR-023).
import type { PositionSummaryItem } from "@/types/predict-server.js";
import type { InvestorDetail, RecentTrade, StrategyBreakdown, StrategyType } from "./types.js";
import { classifyOutcome, inferStrategyType } from "./classify.js";

/** Plain-Vietnamese strategy labels, consistent with the rest of the product. */
export const STRATEGY_LABELS: Record<StrategyType, string> = {
  binary_up: "Giá lên",
  binary_down: "Phòng vệ khi giảm",
  range: "Đi ngang trong vùng",
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
    if (classifyOutcome(p.status) === "open") continue;
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
    .filter((p) => classifyOutcome(p.status) !== "open")
    .sort(byRecency)
    .slice(0, limit)
    .map((p) => {
      const type = inferStrategyType(p);
      const ts = Number((p.last_activity_at as number | undefined) ?? 0);
      return {
        type,
        label: STRATEGY_LABELS[type],
        outcome: classifyOutcome(p.status) === "won" ? "won" : "lost",
        pnl_raw: p.realized_pnl ?? 0,
        settledAt: ts || undefined,
      };
    });
}

/** Assemble the full investor detail payload. */
export function buildInvestorDetail(
  address: string,
  positions: PositionSummaryItem[],
  recentLimit = DEFAULT_RECENT_LIMIT
): InvestorDetail {
  return {
    address,
    recentTrades: getRecentTrades(positions, recentLimit),
    strategyBreakdown: getStrategyBreakdown(positions),
  };
}
