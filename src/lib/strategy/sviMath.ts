// SVI math functions. All inputs use 1e9 scale; outputs are plain numbers.
// Convention: w(k) is TOTAL VARIANCE (Gatheral), σ = sqrt(w / T). Verified probe #7.

import type { SVIParams } from "./types.js";

const SVI_SCALE = 1_000_000_000;

/** Compute SVI total variance w(k) at log-moneyness k. */
export function computeTotalVariance(svi: SVIParams, k: number): number {
  const a = svi.a / SVI_SCALE;
  const b = svi.b / SVI_SCALE;
  const rho = (svi.rho_negative ? -svi.rho : svi.rho) / SVI_SCALE;
  const m = (svi.m_negative ? -svi.m : svi.m) / SVI_SCALE;
  const sigma = svi.sigma / SVI_SCALE;

  // w(k) = a + b*(rho*(k - m) + sqrt((k - m)^2 + sigma^2))
  const km = k - m;
  return a + b * (rho * km + Math.sqrt(km * km + sigma * sigma));
}

/**
 * Compute implied vol σ from SVI params at log-moneyness k and time T (years).
 * Uses Gatheral total-variance convention: σ = sqrt(w / T).
 */
export function computeImpliedVol(svi: SVIParams, k: number, T: number): number {
  const w = computeTotalVariance(svi, k);
  return Math.sqrt(Math.max(w, 0) / Math.max(T, 1e-10));
}

/**
 * Compute 1-sigma price move in raw bigint (scale 1e9).
 * σ_move = forward_raw * σ_ATM * sqrt(T)
 * where T is time to expiry in years and σ_ATM is implied vol at k=0.
 */
export function computeSigmaMove(
  forward_raw: bigint,
  svi: SVIParams,
  T: number
): bigint {
  const sigmaATM = computeImpliedVol(svi, 0, T);
  const move = Number(forward_raw) * sigmaATM * Math.sqrt(Math.max(T, 1e-10));
  return BigInt(Math.round(move));
}

/**
 * Compute time to expiry in years from expiry unix ms timestamp.
 */
export function timeToExpiryYears(expiryMs: number): number {
  const remaining = Math.max(expiryMs - Date.now(), 0);
  return remaining / (365.25 * 24 * 3600 * 1000);
}

/**
 * Estimate win probability using normal CDF approximation.
 * For a binary bet, prob ≈ N(d2) where d2 = -k / (σ * sqrt(T)).
 * k = log(strike / forward).
 */
export function computeBinaryProb(
  forward_raw: bigint,
  strike_raw: bigint,
  svi: SVIParams,
  T: number,
  isUp: boolean
): number {
  const k = Math.log(Number(strike_raw) / Number(forward_raw));
  const sigma = computeImpliedVol(svi, k, T);
  const sqrtT = Math.sqrt(Math.max(T, 1e-10));
  const d2 = -k / (sigma * sqrtT);
  const prob = normalCDF(isUp ? d2 : -d2);
  return Math.max(0.01, Math.min(0.99, prob));
}

/**
 * Estimate range bet probability (price stays within [lower, upper]).
 * prob ≈ N(d2_upper) - N(d2_lower)
 */
export function computeRangeProb(
  forward_raw: bigint,
  lower_raw: bigint,
  upper_raw: bigint,
  svi: SVIParams,
  T: number
): number {
  const kLower = Math.log(Number(lower_raw) / Number(forward_raw));
  const kUpper = Math.log(Number(upper_raw) / Number(forward_raw));
  const sigmaATM = computeImpliedVol(svi, 0, T);
  const sqrtT = Math.sqrt(Math.max(T, 1e-10));
  const d2Lower = -kLower / (sigmaATM * sqrtT);
  const d2Upper = -kUpper / (sigmaATM * sqrtT);
  const prob = normalCDF(d2Upper) - normalCDF(d2Lower);
  return Math.max(0.01, Math.min(0.99, prob));
}

/** Abramowitz & Stegun normal CDF approximation. */
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}
