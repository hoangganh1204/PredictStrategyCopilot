// Strategy Engine types. All on-chain amounts use bigint with _raw suffix.
// Convert to number only at UI boundary using DUSDC_SCALE / PRICE_SCALE.

export type StrategyType = "range" | "binary_up" | "binary_down";

/** SVI params as received from Public Server (all fields in 1e9 scale). */
export interface SVIParams {
  /** Scale: 1e9, always positive */
  a: number;
  /** Scale: 1e9, always positive */
  b: number;
  /** Magnitude of rho. Scale: 1e9. Negate when rho_negative=true. */
  rho: number;
  rho_negative: boolean;
  /** Magnitude of m. Scale: 1e9. Negate when m_negative=true. */
  m: number;
  m_negative: boolean;
  /** Scale: 1e9, always positive */
  sigma: number;
  /** Unix ms timestamp when SVI was last updated (for staleness check). Optional in pure math. */
  updatedAtMs?: number;
}

/** Full snapshot of oracle market data, ready for strategy computation. */
export interface OracleSnapshot {
  oracleId: string;
  /** Current spot price, scale 1e9 */
  spot_raw: bigint;
  /** Forward price, scale 1e9 */
  forward_raw: bigint;
  /** Oracle expiry as Unix ms timestamp */
  expiryMs: number;
  /** Minimum valid strike, scale 1e9 */
  minStrike_raw: bigint;
  /** Strike grid step, scale 1e9 */
  tickSize_raw: bigint;
  svi: SVIParams;
}

/** One computed strategy ready for display. */
export interface Strategy {
  type: StrategyType;
  /** For binary strategies */
  strike_raw?: bigint;
  /** For range strategies */
  lowerStrike_raw?: bigint;
  upperStrike_raw?: bigint;
  /** Cost to open position, raw DUSDC (scale 1e6) */
  cost_raw: bigint;
  /** Max payout if settled correctly, raw DUSDC (scale 1e6) */
  payout_raw: bigint;
  /** Win probability in (0, 1) */
  prob: number;
}

/** Pricing function dependency — abstracts devInspect for testability. */
export type PricingFn = (
  oracleId: string,
  strike: bigint,
  isUp: boolean | null, // null = range
  lowerStrike: bigint | null,
  upperStrike: bigint | null,
  quantity: bigint,
  expiryMs: number
) => Promise<{ mint_cost_raw: bigint; redeem_payout_raw: bigint }>;

/** computeStrategies success result */
export interface StrategiesOk {
  ok: true;
  strategies: Strategy[];
  /** Annualized at-the-money implied volatility (e.g. 0.42 = 42%/yr). */
  impliedVol: number;
}

/** computeStrategies error result */
export interface StrategiesErr {
  ok: false;
  code: "ERR_STALE_SVI" | "ERR_NO_MARKET" | "ERR_PRICING";
  message: string;
}

export type StrategiesResult = StrategiesOk | StrategiesErr;
