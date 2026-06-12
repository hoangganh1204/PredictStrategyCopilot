// Types for all DeepBook Predict Public Server REST responses.
// Verified against real testnet endpoints — probe run 2026-06-03.

// ─── GET /predicts/:predict_id/oracles ───────────────────────────────────────

export interface OracleListItem {
  predict_id: string;
  oracle_id: string;
  oracle_cap_id: string;
  underlying_asset: string;
  /** Unix timestamp in MILLISECONDS (verified via probe) */
  expiry: number;
  /** Minimum valid strike. Scale: 1e9 (e.g. 50000 * 1e9 = $50,000) */
  min_strike: number;
  /** Strike increment. Scale: 1e9 (1e9 = $1 step) */
  tick_size: number;
  status: "created" | "active" | "settled" | "pending_settlement";
  activated_at: number | null;
  /** Scale: 1e9 */
  settlement_price: number | null;
  settled_at: number | null;
  created_checkpoint: number;
}

export type OracleListResponse = OracleListItem[];

// ─── GET /oracles/:oracle_id/state ────────────────────────────────────────────

export interface OraclePrice {
  event_digest: string;
  digest: string;
  sender: string;
  checkpoint: number;
  checkpoint_timestamp_ms: number;
  tx_index: number;
  event_index: number;
  package: string;
  oracle_id: string;
  /** Spot price, scale 1e9 */
  spot: number;
  /** Forward price, scale 1e9 */
  forward: number;
  onchain_timestamp: number;
}

export interface OracleSviParams {
  event_digest: string;
  digest: string;
  sender: string;
  checkpoint: number;
  checkpoint_timestamp_ms: number;
  tx_index: number;
  event_index: number;
  package: string;
  oracle_id: string;
  /** SVI param a. Scale: 1e9. Always positive. */
  a: number;
  /** SVI param b. Scale: 1e9. Always positive. */
  b: number;
  /** SVI param rho magnitude. Scale: 1e9. Apply rho_negative for sign. */
  rho: number;
  /** True when rho is negative */
  rho_negative: boolean;
  /** SVI param m magnitude. Scale: 1e9. Apply m_negative for sign. */
  m: number;
  /** True when m is negative */
  m_negative: boolean;
  /** SVI param sigma. Scale: 1e9. Always positive. */
  sigma: number;
  onchain_timestamp: number;
}

export interface OracleStateResponse {
  oracle: OracleListItem;
  latest_price: OraclePrice | null;
  latest_svi: OracleSviParams | null;
  /** Currently null when market ask-bounds not set by protocol */
  ask_bounds: AskBoundsResponse | null;
}

// ─── GET /oracles/:oracle_id/svi/latest ──────────────────────────────────────

export type SviLatestResponse = OracleSviParams;

// ─── GET /oracles/:oracle_id/ask-bounds ──────────────────────────────────────
// Returns null when the protocol has not configured ask-bounds for this oracle.
// Strike grid is derived from oracle.min_strike + N * oracle.tick_size.

export interface AskBoundsResponse {
  oracle_id: string;
  /** Lower bound of ask price as fraction (scale 1e9) */
  lower_bound?: number;
  /** Upper bound of ask price as fraction (scale 1e9) */
  upper_bound?: number;
  /** Explicit list of valid strikes if provided */
  strikes?: number[];
  [key: string]: unknown;
}

// ─── GET /managers/:manager_id/summary ────────────────────────────────────────

export interface ManagerSummaryResponse {
  manager_id: string;
  owner: string;
  /** Top-level balance in raw DUSDC (scale 1e6) — server field is trading_balance */
  trading_balance: number;
  balances?: Array<{ quote_asset: string; balance: number }>;
  [key: string]: unknown;
}

// ─── GET /managers/:manager_id/positions/summary ──────────────────────────────

export interface PositionSummaryItem {
  predict_id: string;
  manager_id: string;
  oracle_id: string;
  underlying_asset: string;
  /** Unix ms timestamp */
  expiry: number;
  /** Scale: 1e9 */
  strike?: number;
  /** Scale: 1e9 */
  lower_strike?: number;
  /** Scale: 1e9 */
  higher_strike?: number;
  /** Binary direction — true=up, false=down, absent for range */
  is_up?: boolean;
  /** Total tokens minted (scale: 1e6) */
  minted_quantity: number;
  /** Currently held tokens (scale: 1e6) */
  open_quantity: number;
  /** Total DUSDC paid (scale: 1e6) */
  total_cost: number;
  /** Unrealized P&L in raw DUSDC (scale: 1e6) */
  unrealized_pnl: number;
  /** Realized P&L in raw DUSDC (scale: 1e6) */
  realized_pnl: number;
  /**
   * Position status. The live server emits "active" | "redeemable" (won, unclaimed)
   * | "lost" | "redeemed" (won, claimed); the normalized "settled_won"/"settled_lost"/
   * "awaiting_settlement" spellings are tolerated by consumers as well.
   */
  status:
    | "active"
    | "redeemable"
    | "lost"
    | "redeemed"
    | "awaiting_settlement"
    | "settled_won"
    | "settled_lost";
  [key: string]: unknown;
}

export type PositionsSummaryResponse = PositionSummaryItem[];
