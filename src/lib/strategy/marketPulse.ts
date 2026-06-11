// Market Pulse: is current volatility elevated vs its recent norm?
// Compares the live annualized implied vol against the average over the recent
// SVI history of the same oracle. Pure read from the public server — no on-chain.
import type { SVIParams } from "./types.js";
import { computeImpliedVol } from "./sviMath.js";

const YEAR_MS = 365.25 * 24 * 3600 * 1000;
// A move beyond this vs the recent average counts as elevated / subdued.
const PULSE_THRESHOLD_PCT = 5;

export type PulseLevel = "elevated" | "subdued" | "steady";

export interface MarketPulse {
  /** Annualized implied vol averaged over recent history. */
  averageVol: number;
  /** Current vol vs that average, in percent (e.g. +12 = 12% above normal). */
  deltaPct: number;
  level: PulseLevel;
}

/** One SVI snapshot from the history endpoint (scaled ints + timestamp). */
interface SviSnapshot {
  a: number;
  b: number;
  rho: number;
  rho_negative: boolean;
  m: number;
  m_negative: boolean;
  sigma: number;
  checkpoint_timestamp_ms: number;
}

/**
 * @param history    recent SVI snapshots for the oracle (any order)
 * @param expiryMs   oracle expiry (to annualize each snapshot's vol)
 * @param currentVol live annualized vol (from the latest SVI), for the comparison
 */
export function computeMarketPulse(
  history: SviSnapshot[],
  expiryMs: number,
  currentVol: number
): MarketPulse | null {
  const vols: number[] = [];
  for (const s of history) {
    const T = (expiryMs - s.checkpoint_timestamp_ms) / YEAR_MS;
    if (T <= 0) continue;
    const svi: SVIParams = {
      a: s.a,
      b: s.b,
      rho: s.rho,
      rho_negative: s.rho_negative,
      m: s.m,
      m_negative: s.m_negative,
      sigma: s.sigma,
    };
    const v = computeImpliedVol(svi, 0, T);
    if (isFinite(v) && v > 0) vols.push(v);
  }
  if (vols.length < 3) return null;

  const averageVol = vols.reduce((a, b) => a + b, 0) / vols.length;
  const deltaPct = averageVol > 0 ? ((currentVol - averageVol) / averageVol) * 100 : 0;
  const level: PulseLevel =
    deltaPct >= PULSE_THRESHOLD_PCT ? "elevated"
    : deltaPct <= -PULSE_THRESHOLD_PCT ? "subdued"
    : "steady";

  return { averageVol, deltaPct, level };
}
