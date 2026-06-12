// T079 — Copy-trade domain types. All on-chain amounts are bigint with _raw suffix.
import type { StrategyType } from "@/lib/strategy/types.js";

export type { StrategyType };

/**
 * A copyable bet, scaled to the follower's stake. Preserves the leader's
 * strategy type, strike(s) and direction exactly — only the size differs.
 */
export interface CopyParams {
  strategyType: StrategyType;
  oracleId: string;
  /** Binary strike, scale 1e9 (present for binary_up/binary_down). */
  strike_raw?: bigint;
  /** Range lower strike, scale 1e9 (present for range). */
  lowerStrike_raw?: bigint;
  /** Range upper strike, scale 1e9 (present for range). */
  upperStrike_raw?: bigint;
  /** Binary direction — true=up, false=down, absent for range. */
  isUp?: boolean;
  /** Token quantity to mint, scale 1e6. */
  quantity_raw: bigint;
  /** DUSDC the follower spends (their stake), scale 1e6. */
  cost_raw: bigint;
  /** Max payout on a win (token face value), scale 1e6. */
  payout_raw: bigint;
  /** Oracle expiry, Unix ms. */
  expiryMs: number;
}

/** Result of the three copy-trade eligibility gates. */
export interface CopyEligibility {
  eligible: boolean;
  /** Plain-language reason when not eligible. */
  reason?: string;
}

/** A follower's intent to copy a leader at a chosen stake. */
export interface FollowConfig {
  leaderAddress: string;
  /** DUSDC the follower wants to spend, scale 1e6. */
  followerAmount_raw: bigint;
}
