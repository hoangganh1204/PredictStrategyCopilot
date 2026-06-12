import { describe, it, expect } from "vitest";
import { validateCopyEligibility } from "../../../src/lib/copytrade/validateCopyEligibility.js";

const NOW = 1_781_253_000_000;
const ACTIVE = { status: "active" };

describe("validateCopyEligibility", () => {
  it("is eligible when oracle is active, SVI is fresh, and balance covers the cost", () => {
    const r = validateCopyEligibility(ACTIVE, NOW - 5_000, 100_000_000n, 10_000_000n, NOW);
    expect(r.eligible).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it("blocks when the oracle is not active", () => {
    const r = validateCopyEligibility({ status: "settled" }, NOW, 100_000_000n, 10_000_000n, NOW);
    expect(r.eligible).toBe(false);
    expect(r.reason && r.reason.length).toBeGreaterThan(0);
  });

  it("blocks when SVI is stale — exactly 30_000ms is blocked (boundary)", () => {
    const r = validateCopyEligibility(ACTIVE, NOW - 30_000, 100_000_000n, 10_000_000n, NOW);
    expect(r.eligible).toBe(false);
    expect(r.reason && r.reason.length).toBeGreaterThan(0);
  });

  it("allows SVI just under the staleness boundary (29_999ms)", () => {
    const r = validateCopyEligibility(ACTIVE, NOW - 29_999, 100_000_000n, 10_000_000n, NOW);
    expect(r.eligible).toBe(true);
  });

  it("blocks when the balance is below the cost", () => {
    const r = validateCopyEligibility(ACTIVE, NOW, 9_999_999n, 10_000_000n, NOW);
    expect(r.eligible).toBe(false);
    expect(r.reason && r.reason.length).toBeGreaterThan(0);
  });

  it("allows when balance exactly equals the cost", () => {
    const r = validateCopyEligibility(ACTIVE, NOW, 10_000_000n, 10_000_000n, NOW);
    expect(r.eligible).toBe(true);
  });

  it("checks the market gate before the staleness gate", () => {
    // Not active AND stale → should report the market reason (first gate).
    const r = validateCopyEligibility({ status: "settled" }, NOW - 60_000, 0n, 10_000_000n, NOW);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBeTruthy();
  });
});
