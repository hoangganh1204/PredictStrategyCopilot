import { describe, it, expect } from "vitest";
import { evaluateRound } from "../../../src/lib/vault/evaluateRound.js";

// Prices in raw 1e9 scale ($62,000 = 62_000e9); amounts in raw 1e6.
const P = (usd: number) => usd * 1e9;
const base = { quantity_raw: "5000000", cost_raw: "2500000" }; // 5 tokens for 2.5 DUSDC

describe("evaluateRound", () => {
  it("binary_up wins above the strike (payout = face value)", () => {
    const o = evaluateRound({ ...base, type: "binary_up", strike_raw: String(P(62_000)) }, P(63_000));
    expect(o).toEqual({ won: true, payout_raw: 5_000_000, pnl_raw: 2_500_000 });
  });

  it("binary_up loses below the strike (pnl = −cost)", () => {
    const o = evaluateRound({ ...base, type: "binary_up", strike_raw: String(P(62_000)) }, P(61_000));
    expect(o).toEqual({ won: false, payout_raw: 0, pnl_raw: -2_500_000 });
  });

  it("binary_down wins below the strike", () => {
    const o = evaluateRound({ ...base, type: "binary_down", strike_raw: String(P(62_000)) }, P(61_000));
    expect(o.won).toBe(true);
  });

  it("binary_down loses above the strike", () => {
    const o = evaluateRound({ ...base, type: "binary_down", strike_raw: String(P(62_000)) }, P(63_000));
    expect(o.won).toBe(false);
  });

  it("range wins inside the band (inclusive bounds)", () => {
    const r = { ...base, type: "range" as const, lower_raw: String(P(61_000)), upper_raw: String(P(63_000)) };
    expect(evaluateRound(r, P(62_000)).won).toBe(true);
    expect(evaluateRound(r, P(61_000)).won).toBe(true); // boundary
  });

  it("range loses outside the band", () => {
    const r = { ...base, type: "range" as const, lower_raw: String(P(61_000)), upper_raw: String(P(63_000)) };
    const o = evaluateRound(r, P(64_000));
    expect(o).toEqual({ won: false, payout_raw: 0, pnl_raw: -2_500_000 });
  });
});
