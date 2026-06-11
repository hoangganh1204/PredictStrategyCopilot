// Pure win/loss evaluation for an Auto-Vault round, from the oracle's
// settlement price. Kept pure so the keeper logic is unit-testable.
//
// Conventions (matching the app's settlement logic in useRangePositions):
//   binary_up   wins when settlement >  strike
//   binary_down wins when settlement <  strike
//   range       wins when lower <= settlement <= upper
// Tokens redeem 1:1 at face value on a win (verified on testnet).
import type { VaultOpenRound } from "./types.js";

export interface RoundOutcome {
  won: boolean;
  /** Raw DUSDC received on redeem (face value of the tokens, or 0). */
  payout_raw: number;
  /** payout − cost, raw DUSDC. */
  pnl_raw: number;
}

type RoundParams = Pick<
  VaultOpenRound,
  "type" | "strike_raw" | "lower_raw" | "upper_raw" | "quantity_raw" | "cost_raw"
>;

export function evaluateRound(
  round: RoundParams,
  settlementPrice_raw: number
): RoundOutcome {
  const quantity = Number(round.quantity_raw);
  const cost = Number(round.cost_raw);

  let won = false;
  if (round.type === "range") {
    const lower = Number(round.lower_raw);
    const upper = Number(round.upper_raw);
    won = settlementPrice_raw >= lower && settlementPrice_raw <= upper;
  } else if (round.type === "binary_up") {
    won = settlementPrice_raw > Number(round.strike_raw);
  } else {
    won = settlementPrice_raw < Number(round.strike_raw);
  }

  const payout_raw = won ? quantity : 0;
  return { won, payout_raw, pnl_raw: payout_raw - cost };
}
