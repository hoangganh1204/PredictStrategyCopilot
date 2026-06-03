// Execute flow types. All on-chain amounts use bigint with _raw suffix.

export interface TxResult {
  status: "success" | "failed" | "rejected";
  /** Transaction digest — present on success */
  digest?: string;
  /** Human-readable error message — present on failure */
  error?: string;
}

export type PositionState =
  | "active"
  | "awaiting_settlement"
  | "settled_won"
  | "settled_lost"
  | "redeemed";

export interface MintParams {
  oracleId: string;
  managerId: string;
  /** Strike price, scale 1e9 */
  strike_raw: bigint;
  /** true = binary up, false = binary down */
  isUp: boolean;
  /** Quantity of prediction units, scale 1e6 (DUSDC decimals) */
  quantity_raw: bigint;
  /** Oracle expiry ms timestamp */
  expiryMs: number;
}

export interface MintRangeParams {
  oracleId: string;
  managerId: string;
  /** Lower strike, scale 1e9 */
  lowerStrike_raw: bigint;
  /** Upper strike, scale 1e9 */
  upperStrike_raw: bigint;
  /** Quantity, scale 1e6 */
  quantity_raw: bigint;
  /** Oracle expiry ms timestamp */
  expiryMs: number;
}

export interface RedeemParams {
  oracleId: string;
  managerId: string;
  /** Strike for binary, scale 1e9 */
  strike_raw?: bigint;
  isUp?: boolean;
  /** For range redeem */
  lowerStrike_raw?: bigint;
  upperStrike_raw?: bigint;
  quantity_raw: bigint;
  expiryMs: number;
  isRange: boolean;
}

/** Callback type for signing and executing a Transaction. */
export type SignAndExecuteFn = (tx: import("@mysten/sui/transactions").Transaction) => Promise<TxResult>;
