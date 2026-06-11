import { describe, it, expect } from "vitest";
import { computeMarketPulse } from "../../../src/lib/strategy/marketPulse.js";

// Real SVI shape (scaled 1e9). Same params each snapshot → stable baseline vol.
const BASE = {
  a: 120350,
  b: 1079485,
  rho: 950000000,
  rho_negative: true,
  m: 11768203,
  m_negative: false,
  sigma: 7977445,
};
const EXPIRY = 1_780_491_600_000;
// Snapshots a few minutes apart, before expiry.
const history = Array.from({ length: 20 }, (_, i) => ({
  ...BASE,
  checkpoint_timestamp_ms: EXPIRY - (10 + i) * 60_000, // 10..29 min before expiry
}));

function baselineVol() {
  const p = computeMarketPulse(history, EXPIRY, 0.4)!;
  return p.averageVol;
}

describe("computeMarketPulse", () => {
  it("flags 'steady' when current ≈ recent average", () => {
    const avg = baselineVol();
    const p = computeMarketPulse(history, EXPIRY, avg)!;
    expect(p.level).toBe("steady");
    expect(Math.abs(p.deltaPct)).toBeLessThan(5);
  });

  it("flags 'elevated' when current is well above the average", () => {
    const avg = baselineVol();
    const p = computeMarketPulse(history, EXPIRY, avg * 1.2)!; // +20%
    expect(p.level).toBe("elevated");
    expect(p.deltaPct).toBeGreaterThan(5);
  });

  it("flags 'subdued' when current is well below the average", () => {
    const avg = baselineVol();
    const p = computeMarketPulse(history, EXPIRY, avg * 0.85)!; // −15%
    expect(p.level).toBe("subdued");
    expect(p.deltaPct).toBeLessThan(-5);
  });

  it("returns null when history is too small", () => {
    expect(computeMarketPulse(history.slice(0, 2), EXPIRY, 0.4)).toBeNull();
  });

  it("skips snapshots at/after expiry (T <= 0)", () => {
    const withFuture = [...history, { ...BASE, checkpoint_timestamp_ms: EXPIRY + 1000 }];
    const p = computeMarketPulse(withFuture, EXPIRY, 0.4);
    expect(p).not.toBeNull();
    expect(isFinite(p!.averageVol)).toBe(true);
  });
});
