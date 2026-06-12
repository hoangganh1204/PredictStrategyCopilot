import { describe, it, expect } from "vitest";
import {
  getStrategyBreakdown,
  getRecentTrades,
  STRATEGY_LABELS,
} from "../../../src/lib/leaderboard/investorDetail.js";
import type { PositionSummaryItem } from "../../../src/types/predict-server.js";

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

describe("getStrategyBreakdown", () => {
  it("groups settled positions by inferred strategy type with count + net P&L", () => {
    const breakdown = getStrategyBreakdown([
      mk({ status: "redeemed", is_up: true, realized_pnl: 10 }),
      mk({ status: "redeemable", is_up: true, realized_pnl: 5 }),
      mk({ status: "lost", is_up: false, realized_pnl: -3 }),
      mk({ status: "redeemed", lower_strike: 1, higher_strike: 2, realized_pnl: 8 }),
      mk({ status: "active", is_up: true, realized_pnl: 0 }), // open — excluded
    ]);
    const up = breakdown.find((b) => b.type === "binary_up");
    const down = breakdown.find((b) => b.type === "binary_down");
    const range = breakdown.find((b) => b.type === "range");
    expect(up).toEqual({ type: "binary_up", count: 2, netPnl_raw: 15 });
    expect(down).toEqual({ type: "binary_down", count: 1, netPnl_raw: -3 });
    expect(range).toEqual({ type: "range", count: 1, netPnl_raw: 8 });
  });

  it("returns an empty array when there is no settled activity", () => {
    expect(getStrategyBreakdown([mk({ status: "active" })])).toEqual([]);
  });
});

describe("getRecentTrades", () => {
  it("returns the last N settled trades newest-first with plain-language labels", () => {
    const trades = getRecentTrades(
      [
        mk({ status: "redeemed", is_up: true, realized_pnl: 10, last_activity_at: 100 }),
        mk({ status: "lost", is_up: false, realized_pnl: -4, last_activity_at: 300 }),
        mk({ status: "redeemable", lower_strike: 1, higher_strike: 2, realized_pnl: 7, last_activity_at: 200 }),
        mk({ status: "active", is_up: true, last_activity_at: 999 }), // open — excluded
      ],
      2
    );
    expect(trades).toHaveLength(2);
    // Newest settled first: ts=300 (down/lost), then ts=200 (range/won)
    expect(trades[0]).toMatchObject({ type: "binary_down", outcome: "lost", pnl_raw: -4 });
    expect(trades[0].label).toBe(STRATEGY_LABELS.binary_down);
    expect(trades[1]).toMatchObject({ type: "range", outcome: "won", pnl_raw: 7 });
  });

  it("defaults to a reasonable limit and never includes open positions", () => {
    const trades = getRecentTrades([mk({ status: "active" }), mk({ status: "lost", is_up: true, realized_pnl: -1 })]);
    expect(trades).toHaveLength(1);
    expect(trades[0].outcome).toBe("lost");
  });
});
