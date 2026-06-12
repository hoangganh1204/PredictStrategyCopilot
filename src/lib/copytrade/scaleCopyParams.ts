// T080 — Scale a leader's position to the follower's stake, preserving the
// strategy type, strike(s) and direction exactly (FR-019). Only the size changes.
import { DUSDC_SCALE } from "@/config/predict.js";
import { computeBetEconomics } from "@/lib/strategy/sizing.js";
import type { PricingFn, StrategyType } from "@/lib/strategy/types.js";
import type { PositionSummaryItem } from "@/types/predict-server.js";
import type { CopyParams } from "./types.js";

const SCALE = Number(DUSDC_SCALE);
/** Reference quantity for unit pricing: 1 token (1e6 raw). */
const REF_QUANTITY = DUSDC_SCALE;

/** Infer the leader's strategy type from its position fields. */
export function inferStrategyType(p: PositionSummaryItem): StrategyType {
  if (p.lower_strike !== undefined || p.higher_strike !== undefined) return "range";
  if (p.is_up === false) return "binary_down";
  return "binary_up";
}

/**
 * Build CopyParams for a follower copying `leaderPosition` at `followerAmount_raw`.
 * Uses the same linear sizing as a normal bet: price one token, then derive the
 * quantity so the follower spends their chosen stake. Each token redeems 1 DUSDC
 * face value on a win (verified), so payout = token face value.
 */
export async function scaleCopyParams(
  leaderPosition: PositionSummaryItem,
  followerAmount_raw: bigint,
  pricingFn: PricingFn
): Promise<CopyParams> {
  const strategyType = inferStrategyType(leaderPosition);
  const isRange = strategyType === "range";
  const isUp = strategyType === "binary_up";
  const oracleId = leaderPosition.oracle_id;
  const expiryMs = leaderPosition.expiry;

  const strike_raw =
    leaderPosition.strike !== undefined ? BigInt(leaderPosition.strike) : 0n;
  const lowerStrike_raw =
    leaderPosition.lower_strike !== undefined ? BigInt(leaderPosition.lower_strike) : undefined;
  const upperStrike_raw =
    leaderPosition.higher_strike !== undefined ? BigInt(leaderPosition.higher_strike) : undefined;

  // Price one reference token to get the per-token cost, then size to the stake.
  const ref = await pricingFn(
    oracleId,
    strike_raw,
    isRange ? null : isUp,
    isRange ? lowerStrike_raw ?? null : null,
    isRange ? upperStrike_raw ?? null : null,
    REF_QUANTITY,
    expiryMs
  );

  const econ = computeBetEconomics(Number(followerAmount_raw) / SCALE, Number(ref.mint_cost_raw));
  const quantity_raw = econ.quantityRaw;
  const cost_raw = BigInt(Math.round(econ.stakeRaw));
  const payout_raw = BigInt(Math.round(econ.winRaw));

  const base: CopyParams = { strategyType, oracleId, expiryMs, quantity_raw, cost_raw, payout_raw };

  return isRange
    ? { ...base, lowerStrike_raw, upperStrike_raw }
    : { ...base, strike_raw, isUp };
}
