import { describe, it, expect } from "vitest";
import {
  computeTotalVariance,
  computeImpliedVol,
  computeSigmaMove,
  computeBinaryProb,
  computeRangeProb,
} from "@/lib/strategy/sviMath";

// Real SVI params from probe (2026-06-03), oracle 0x62a044..., scale ÷1e9:
// a=120350, b=1079485, rho=950000000(neg), m=11768203(neg=false), sigma=7977445
// → a=1.2035e-4, b=1.0795e-3, rho=-0.95, m=1.1768e-2, sigma=7.977e-3
// spot=67074059995523, forward=67066930290353 (scale 1e9 → $67,074 / $67,067)
// expiry=1780491600000ms, probe ts≈1780474184000ms → T≈0.000552yr

const REAL_SVI = {
  a: 120350,
  b: 1079485,
  rho: 950000000,
  rho_negative: true,
  m: 11768203,
  m_negative: false,
  sigma: 7977445,
};
const REAL_SPOT_RAW = 67074059995523n;
const REAL_FORWARD_RAW = 67066930290353n;
const REAL_EXPIRY_MS = 1780491600000;
const PROBE_TS_MS = 1780474184000; // approx time probe ran

describe("computeTotalVariance", () => {
  it("returns correct w at ATM (k=0)", () => {
    const T = (REAL_EXPIRY_MS - PROBE_TS_MS) / (365.25 * 24 * 3600 * 1000);
    const w = computeTotalVariance(REAL_SVI, 0);
    // Expected: scale 1e9: a=1.2035e-4, b=1.0795e-3, rho=-0.95, m=1.1768e-2, sigma=7.977e-3
    // w(0) = a + b*(rho*(0-m) + sqrt(m^2 + sigma^2))
    //      ≈ 0.00012035 + 0.0010795*(-0.95*(−0.011768) + sqrt(0.011768^2 + 0.007977^2))
    //      ≈ 0.00012035 + 0.0010795*(0.011180 + sqrt(0.000138474 + 0.000063632))
    //      ≈ 0.00012035 + 0.0010795*(0.011180 + 0.014224)
    //      ≈ 0.00012035 + 0.0010795*0.025404
    //      ≈ 0.00012035 + 0.0000274
    //      ≈ 0.0001478
    expect(w).toBeGreaterThan(0);
    expect(w).toBeCloseTo(0.0001478, 5);
  });

  it("returns higher w for deeply OTM puts (k = -0.2)", () => {
    // With rho=-0.95, smile min is near k≈+0.04. Deep OTM put (k<0) should be > ATM.
    const wATM = computeTotalVariance(REAL_SVI, 0);
    const wDeepPut = computeTotalVariance(REAL_SVI, -0.2);
    expect(wDeepPut).toBeGreaterThan(wATM);
  });

  it("is always positive", () => {
    for (const k of [-0.5, -0.2, -0.1, 0, 0.1, 0.2, 0.5]) {
      expect(computeTotalVariance(REAL_SVI, k)).toBeGreaterThan(0);
    }
  });
});

describe("computeImpliedVol", () => {
  it("returns ATM vol close to 50% annually (Gatheral total-variance convention)", () => {
    const T = (REAL_EXPIRY_MS - PROBE_TS_MS) / (365.25 * 24 * 3600 * 1000);
    const vol = computeImpliedVol(REAL_SVI, 0, T);
    // Probe showed ~51.8% at scale 1e9 with Gatheral convention
    expect(vol).toBeGreaterThan(0.3); // > 30%
    expect(vol).toBeLessThan(1.2);   // < 120%
  });

  it("is higher for deeply OTM puts (k = -0.3) than ATM", () => {
    // Smile is asymmetric: deep puts (k<0) > ATM with rho=-0.95 skew
    const T = (REAL_EXPIRY_MS - PROBE_TS_MS) / (365.25 * 24 * 3600 * 1000);
    const volATM = computeImpliedVol(REAL_SVI, 0, T);
    const volDeepPut = computeImpliedVol(REAL_SVI, -0.3, T);
    expect(volDeepPut).toBeGreaterThan(volATM);
  });
});

describe("computeSigmaMove", () => {
  it("returns a positive price move in raw bigint", () => {
    const T = (REAL_EXPIRY_MS - PROBE_TS_MS) / (365.25 * 24 * 3600 * 1000);
    const move = computeSigmaMove(REAL_FORWARD_RAW, REAL_SVI, T);
    expect(move).toBeGreaterThan(0n);
  });

  it("returns move in same scale as spot (1e9)", () => {
    const T = (REAL_EXPIRY_MS - PROBE_TS_MS) / (365.25 * 24 * 3600 * 1000);
    const move = computeSigmaMove(REAL_FORWARD_RAW, REAL_SVI, T);
    // σ_move = forward * vol * sqrt(T)
    // forward=$67,067 → forward_raw=67067e9
    // vol≈0.5, T≈0.000552yr → move ≈ 67067e9 * 0.5 * sqrt(0.000552) ≈ 787e9
    // So move should be in range 100e9..5000e9 ($100-$5000 in scale 1e9)
    expect(move).toBeGreaterThan(100_000_000_000n);  // > $100 in raw
    expect(move).toBeLessThan(5_000_000_000_000n);   // < $5000 in raw
  });
});

describe("computeBinaryProb", () => {
  const T = (REAL_EXPIRY_MS - PROBE_TS_MS) / (365.25 * 24 * 3600 * 1000);

  it("is ~50% for an at-the-money 'up' bet (strike = forward)", () => {
    const p = computeBinaryProb(REAL_FORWARD_RAW, REAL_FORWARD_RAW, REAL_SVI, T, true);
    expect(p).toBeGreaterThan(0.45);
    expect(p).toBeLessThan(0.55);
  });

  it("'up' below the strike is less likely than above (strike > forward)", () => {
    const move = computeSigmaMove(REAL_FORWARD_RAW, REAL_SVI, T);
    const p = computeBinaryProb(REAL_FORWARD_RAW, REAL_FORWARD_RAW + move, REAL_SVI, T, true);
    expect(p).toBeLessThan(0.5);
  });
});

describe("computeRangeProb", () => {
  const T = (REAL_EXPIRY_MS - PROBE_TS_MS) / (365.25 * 24 * 3600 * 1000);

  it("a ±1σ band around the forward is a likely outcome (~55-80%), not ~1%", () => {
    const move = computeSigmaMove(REAL_FORWARD_RAW, REAL_SVI, T);
    const p = computeRangeProb(
      REAL_FORWARD_RAW,
      REAL_FORWARD_RAW - move,
      REAL_FORWARD_RAW + move,
      REAL_SVI,
      T
    );
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(0.85);
  });

  it("a wider band has higher probability than a narrow one", () => {
    const move = computeSigmaMove(REAL_FORWARD_RAW, REAL_SVI, T);
    const narrow = computeRangeProb(
      REAL_FORWARD_RAW,
      REAL_FORWARD_RAW - move / 2n,
      REAL_FORWARD_RAW + move / 2n,
      REAL_SVI,
      T
    );
    const wide = computeRangeProb(
      REAL_FORWARD_RAW,
      REAL_FORWARD_RAW - move * 2n,
      REAL_FORWARD_RAW + move * 2n,
      REAL_SVI,
      T
    );
    expect(wide).toBeGreaterThan(narrow);
  });
});
