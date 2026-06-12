import { describe, it, expect, vi } from "vitest";
import { scaleCopyParams } from "../../../src/lib/copytrade/scaleCopyParams.js";
import type { PricingFn } from "../../../src/lib/strategy/types.js";
import type { PositionSummaryItem } from "../../../src/types/predict-server.js";

// Fixed cost-per-token: 0.5 DUSDC (500_000 raw) regardless of args.
const COST_PER_TOKEN = 500_000n;
const pricing: PricingFn = vi.fn(async () => ({
  mint_cost_raw: COST_PER_TOKEN,
  redeem_payout_raw: 480_000n,
}));

function leader(p: Partial<PositionSummaryItem>): PositionSummaryItem {
  return {
    predict_id: "0xpredict",
    manager_id: "0xleaderM",
    oracle_id: "0xoracle",
    underlying_asset: "BTC",
    expiry: 1_781_253_000_000,
    minted_quantity: 999, // large leader size — must NOT affect follower sizing
    open_quantity: 999,
    total_cost: 0,
    unrealized_pnl: 0,
    realized_pnl: 0,
    status: "active",
    ...p,
  } as PositionSummaryItem;
}

describe("scaleCopyParams", () => {
  it("preserves a binary_up leader's direction and strike, scaled to follower stake", async () => {
    const pos = leader({ is_up: true, strike: 62_000_000_000_000 });
    const out = await scaleCopyParams(pos, 10_000_000n, pricing); // follower spends 10 DUSDC
    expect(out.strategyType).toBe("binary_up");
    expect(out.isUp).toBe(true);
    expect(out.strike_raw).toBe(62_000_000_000_000n);
    expect(out.oracleId).toBe("0xoracle");
    expect(out.expiryMs).toBe(1_781_253_000_000);
    // 10 DUSDC / 0.5 per token = 20 tokens → quantity 20e6, payout = face value 20 DUSDC.
    expect(out.quantity_raw).toBe(20_000_000n);
    expect(out.cost_raw).toBe(10_000_000n);
    expect(out.payout_raw).toBe(20_000_000n);
  });

  it("preserves a binary_down leader's direction", async () => {
    const pos = leader({ is_up: false, strike: 62_000_000_000_000 });
    const out = await scaleCopyParams(pos, 5_000_000n, pricing);
    expect(out.strategyType).toBe("binary_down");
    expect(out.isUp).toBe(false);
  });

  it("scales quantity by the FOLLOWER amount, not the leader's size", async () => {
    const pos = leader({ is_up: true, strike: 62_000_000_000_000, minted_quantity: 1, open_quantity: 1 });
    const small = await scaleCopyParams(pos, 5_000_000n, pricing); // 5 DUSDC → 10 tokens
    const big = await scaleCopyParams(pos, 20_000_000n, pricing); // 20 DUSDC → 40 tokens
    expect(small.quantity_raw).toBe(10_000_000n);
    expect(big.quantity_raw).toBe(40_000_000n);
    // Leader minted only 1 token — output is driven purely by follower stake.
    expect(small.quantity_raw).not.toBe(BigInt(pos.minted_quantity));
  });

  it("preserves a range leader's lower and upper strikes exactly", async () => {
    const pos = leader({ lower_strike: 60_000_000_000_000, higher_strike: 64_000_000_000_000 });
    const out = await scaleCopyParams(pos, 10_000_000n, pricing);
    expect(out.strategyType).toBe("range");
    expect(out.lowerStrike_raw).toBe(60_000_000_000_000n);
    expect(out.upperStrike_raw).toBe(64_000_000_000_000n);
    expect(out.isUp).toBeUndefined();
    expect(out.strike_raw).toBeUndefined();
  });
});
