import { describe, it, expect, vi } from "vitest";
import type { OracleSnapshot, PricingFn } from "@/lib/strategy/types";
import { computeStrategies } from "@/lib/strategy/computeStrategies";

// Mock OracleSnapshot from real probe data (2026-06-03)
const PROBE_TS = 1780474184000;
const MOCK_SNAPSHOT: OracleSnapshot = {
  oracleId: "0x62a0440b74d3594c0196ee0e89a3873fe879d2655e7972fc771cae13f0dfd2f2",
  spot_raw: 67074059995523n,
  forward_raw: 67066930290353n,
  expiryMs: Date.now() + 4 * 3600 * 1000, // 4 hours from now
  minStrike_raw: 50_000_000_000_000n,
  tickSize_raw: 1_000_000_000n,
  svi: {
    a: 120350,
    b: 1079485,
    rho: 950000000,
    rho_negative: true,
    m: 11768203,
    m_negative: false,
    sigma: 7977445,
    updatedAtMs: Date.now() - 5000, // 5s old, fresh at test runtime
  },
};

// Mock PricingFn that returns probe-captured values
// probe: strike≈ATM, qty=1_000_000 → mint_cost=485_525, redeem_payout=465_549
const MOCK_PRICING_FN: PricingFn = vi.fn().mockResolvedValue({
  mint_cost_raw: 485_525n,
  redeem_payout_raw: 1_000_000n, // Win payout = full notional
});

describe("computeStrategies", () => {
  it("returns exactly 3 strategies", async () => {
    const result = await computeStrategies(MOCK_SNAPSHOT, MOCK_PRICING_FN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategies).toHaveLength(3);
  });

  it("returns range, binary_up, binary_down strategy types", async () => {
    const result = await computeStrategies(MOCK_SNAPSHOT, MOCK_PRICING_FN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const types = result.strategies.map((s) => s.type);
    expect(types).toContain("range");
    expect(types).toContain("binary_up");
    expect(types).toContain("binary_down");
  });

  it("all strategies have cost_raw > 0", async () => {
    const result = await computeStrategies(MOCK_SNAPSHOT, MOCK_PRICING_FN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const s of result.strategies) {
      expect(s.cost_raw).toBeGreaterThan(0n);
    }
  });

  it("all strategies have payout_raw > cost_raw", async () => {
    const result = await computeStrategies(MOCK_SNAPSHOT, MOCK_PRICING_FN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const s of result.strategies) {
      expect(s.payout_raw).toBeGreaterThan(s.cost_raw);
    }
  });

  it("all strategies have prob in (0, 1)", async () => {
    const result = await computeStrategies(MOCK_SNAPSHOT, MOCK_PRICING_FN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const s of result.strategies) {
      expect(s.prob).toBeGreaterThan(0);
      expect(s.prob).toBeLessThan(1);
    }
  });

  it("range strategy has lower < upper strike", async () => {
    const result = await computeStrategies(MOCK_SNAPSHOT, MOCK_PRICING_FN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const range = result.strategies.find((s) => s.type === "range");
    expect(range).toBeDefined();
    expect(range!.lowerStrike_raw).toBeLessThan(range!.upperStrike_raw!);
  });

  it("binary strategies have a single strike on valid grid", async () => {
    const result = await computeStrategies(MOCK_SNAPSHOT, MOCK_PRICING_FN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const s of result.strategies.filter((s) => s.type !== "range")) {
      // Strike must be a multiple of tick_size from min_strike
      const offset = s.strike_raw! - MOCK_SNAPSHOT.minStrike_raw;
      expect(offset % MOCK_SNAPSHOT.tickSize_raw).toBe(0n);
    }
  });

  it("returns ERR_STALE_SVI when SVI is older than 30s", async () => {
    const staleSnapshot: OracleSnapshot = {
      ...MOCK_SNAPSHOT,
      svi: { ...MOCK_SNAPSHOT.svi, updatedAtMs: Date.now() - 35_000 },
    };
    const result = await computeStrategies(staleSnapshot, MOCK_PRICING_FN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ERR_STALE_SVI");
  });

  it("returns ERR_NO_MARKET when oracle is expired", async () => {
    const expiredSnapshot: OracleSnapshot = {
      ...MOCK_SNAPSHOT,
      expiryMs: Date.now() - 1000, // already expired
    };
    const result = await computeStrategies(expiredSnapshot, MOCK_PRICING_FN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ERR_NO_MARKET");
  });
});
