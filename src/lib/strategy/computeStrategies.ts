// Core strategy computation pipeline.
// Constraint: this module MUST NOT import from lib/execute/.
import type {
  OracleSnapshot,
  Strategy,
  StrategiesResult,
  PricingFn,
} from "./types.js";
import {
  computeSigmaMove,
  computeBinaryProb,
  computeRangeProb,
  timeToExpiryYears,
} from "./sviMath.js";
import { snapToGrid, snapRangeToGrid, buildGrid } from "./snapToGrid.js";
import { SVI_STALENESS_MS } from "@/config/predict.js";

const QUANTITY = 1_000_000n; // 1 DUSDC in raw (scale 1e6)

/**
 * Compute 3 strategies from an OracleSnapshot.
 * Uses PricingFn for cost/payout (enables mocking in tests).
 */
export async function computeStrategies(
  snapshot: OracleSnapshot,
  pricing: PricingFn
): Promise<StrategiesResult> {
  // Guard: market must not be expired
  if (snapshot.expiryMs <= Date.now()) {
    return { ok: false, code: "ERR_NO_MARKET", message: "This market has closed" };
  }

  // Guard: SVI must be fresh (< 30s old) — if updatedAtMs present
  if (snapshot.svi.updatedAtMs !== undefined &&
      Date.now() - snapshot.svi.updatedAtMs > SVI_STALENESS_MS) {
    return { ok: false, code: "ERR_STALE_SVI", message: "Volatility data is stale (>30s)" };
  }

  const T = timeToExpiryYears(snapshot.expiryMs);
  const sigmaMove = computeSigmaMove(snapshot.forward_raw, snapshot.svi, T);

  // Build grid from oracle min_strike + tick_size
  // Extend grid around spot ±3σ
  const spotCenter = snapshot.forward_raw;
  const gridMin = snapshot.minStrike_raw;
  const gridMax = spotCenter + sigmaMove * 5n;
  const grid = buildGrid(gridMin, snapshot.tickSize_raw, gridMax);

  const strategies: Strategy[] = [];

  // 1. Range strategy: ±1σ around forward
  const rangeLowerTarget = snapshot.forward_raw - sigmaMove;
  const rangeUpperTarget = snapshot.forward_raw + sigmaMove;
  const rangeSnap = snapRangeToGrid(rangeLowerTarget, rangeUpperTarget, grid, sigmaMove);

  if (rangeSnap) {
    const [lower, upper] = rangeSnap;
    try {
      const { mint_cost_raw, redeem_payout_raw } = await pricing(
        snapshot.oracleId, lower, null, lower, upper, QUANTITY, snapshot.expiryMs
      );
      const prob = computeRangeProb(snapshot.forward_raw, lower, upper, snapshot.svi, T);
      strategies.push({
        type: "range",
        lowerStrike_raw: lower,
        upperStrike_raw: upper,
        cost_raw: mint_cost_raw,
        payout_raw: redeem_payout_raw,
        prob,
      });
    } catch {
      // If pricing fails for this strategy, skip it
    }
  }

  // 2. Binary Up: strike = forward (or nearest above)
  const binaryUpTarget = snapshot.forward_raw;
  const binaryUpStrike = snapToGrid(binaryUpTarget, grid, sigmaMove);

  if (binaryUpStrike !== null) {
    try {
      const { mint_cost_raw, redeem_payout_raw } = await pricing(
        snapshot.oracleId, binaryUpStrike, true, null, null, QUANTITY, snapshot.expiryMs
      );
      const prob = computeBinaryProb(
        snapshot.forward_raw, binaryUpStrike, snapshot.svi, T, true
      );
      strategies.push({
        type: "binary_up",
        strike_raw: binaryUpStrike,
        cost_raw: mint_cost_raw,
        payout_raw: redeem_payout_raw,
        prob,
      });
    } catch {
      // skip
    }
  }

  // 3. Binary Down (hedge): strike = forward - 2σ
  const binaryDownTarget = snapshot.forward_raw - sigmaMove * 2n;
  const binaryDownStrike = snapToGrid(binaryDownTarget, grid, sigmaMove);

  if (binaryDownStrike !== null) {
    try {
      const { mint_cost_raw, redeem_payout_raw } = await pricing(
        snapshot.oracleId, binaryDownStrike, false, null, null, QUANTITY, snapshot.expiryMs
      );
      const prob = computeBinaryProb(
        snapshot.forward_raw, binaryDownStrike, snapshot.svi, T, false
      );
      strategies.push({
        type: "binary_down",
        strike_raw: binaryDownStrike,
        cost_raw: mint_cost_raw,
        payout_raw: redeem_payout_raw,
        prob,
      });
    } catch {
      // skip
    }
  }

  if (strategies.length === 0) {
    return { ok: false, code: "ERR_NO_MARKET", message: "Could not price any strategy" };
  }

  return { ok: true, strategies };
}
