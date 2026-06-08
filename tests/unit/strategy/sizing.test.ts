import { describe, it, expect } from "vitest";
import { computeBetEconomics } from "../../../src/lib/strategy/sizing.js";

const SCALE = 1_000_000; // raw DUSDC per 1.0 DUSDC

describe("computeBetEconomics", () => {
  it("at 50% (cost 0.50/token) a 5 DUSDC stake wins 10 and profits 5", () => {
    const econ = computeBetEconomics(5, 0.5 * SCALE);
    expect(econ.stakeRaw).toBe(5 * SCALE);
    expect(econ.winRaw).toBe(10 * SCALE);
    expect(econ.profitRaw).toBe(5 * SCALE);
    expect(econ.quantityRaw).toBe(BigInt(10 * SCALE)); // 10 tokens
  });

  it("cheaper odds (cost 0.08/token) yield a larger win for the same stake", () => {
    const econ = computeBetEconomics(5, 0.08 * SCALE);
    expect(econ.winRaw).toBeCloseTo(62.5 * SCALE, 0);
    expect(econ.profitRaw).toBeCloseTo(57.5 * SCALE, 0);
  });

  it("win always equals stake plus profit", () => {
    const econ = computeBetEconomics(3.3, 0.42 * SCALE);
    expect(econ.winRaw).toBeCloseTo(econ.stakeRaw + econ.profitRaw, 6);
  });

  it("guards against zero/undefined cost (no division by zero)", () => {
    const econ = computeBetEconomics(5, 0);
    expect(econ.quantityRaw).toBe(0n);
    expect(econ.winRaw).toBe(0);
    expect(econ.profitRaw).toBe(-5 * SCALE);
  });

  it("a zero stake produces a zero position", () => {
    const econ = computeBetEconomics(0, 0.5 * SCALE);
    expect(econ.stakeRaw).toBe(0);
    expect(econ.quantityRaw).toBe(0n);
    expect(econ.winRaw).toBe(0);
  });
});
