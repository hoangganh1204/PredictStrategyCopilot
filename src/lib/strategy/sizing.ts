// Position sizing: convert a user stake (DUSDC spent) into a token quantity.
// Each token redeems 1 DUSDC (face value) on win — verified on testnet.
// Cost scales ~linearly with quantity, so tokens = stake / costPerToken.
// This is a linear approximation; it ignores price impact at large sizes.
import { DUSDC_SCALE } from "@/config/predict.js";

const SCALE = Number(DUSDC_SCALE);

export interface BetEconomics {
  /** Raw DUSDC the user spends (= the stake). */
  stakeRaw: number;
  /** Token quantity to mint, raw (SCALE = 1 token). */
  quantityRaw: bigint;
  /** Raw DUSDC paid out if the position wins (= face value of all tokens). */
  winRaw: number;
  /** Raw DUSDC profit if the position wins (winRaw − stakeRaw). */
  profitRaw: number;
}

/**
 * Compute position economics from a stake and the per-token mint cost.
 * @param stakeDusdc   DUSDC the user wants to spend (plain number, e.g. 5)
 * @param costPerTokenRaw  raw DUSDC cost to mint 1 token (strategy.cost_raw)
 */
export function computeBetEconomics(
  stakeDusdc: number,
  costPerTokenRaw: number
): BetEconomics {
  const stakeRaw = stakeDusdc * SCALE;
  const tokens = costPerTokenRaw > 0 ? stakeRaw / costPerTokenRaw : 0;
  const winRaw = tokens * SCALE;
  return {
    stakeRaw,
    quantityRaw: BigInt(Math.round(winRaw)),
    winRaw,
    profitRaw: winRaw - stakeRaw,
  };
}
