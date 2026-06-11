// Auto-Vault shared types — used by the keeper script (scripts/keeper.ts),
// the /api/vault route and the Vault dashboard page.

export type VaultStrategyType = "range" | "binary_up" | "binary_down";

export interface VaultConfig {
  asset: string;
  strategy: VaultStrategyType;
  /** DUSDC spent per round (stake). */
  stakeDusdc: number;
  /** Pause the vault when the manager balance falls below this (DUSDC). */
  floorDusdc: number;
}

export interface VaultOpenRound {
  oracleId: string;
  expiryMs: number;
  type: VaultStrategyType;
  /** Strikes, raw 1e9 (binary uses strike_raw; range uses lower/upper). */
  strike_raw?: string;
  lower_raw?: string;
  upper_raw?: string;
  /** Tokens minted, raw 1e6. Each token redeems 1 DUSDC on a win. */
  quantity_raw: string;
  /** DUSDC paid to mint, raw 1e6. */
  cost_raw: string;
  mintedAt: number;
  mintDigest?: string;
  redeemAttempts?: number;
}

export interface VaultRoundResult {
  oracleId: string;
  expiryMs: number;
  type: VaultStrategyType;
  strike_raw?: string;
  lower_raw?: string;
  upper_raw?: string;
  quantity_raw: string;
  cost_raw: string;
  settlementPrice_raw: string;
  won: boolean;
  /** DUSDC received back, raw 1e6. */
  payout_raw: string;
  /** payout − cost, raw 1e6 (negative on a loss). */
  pnl_raw: string;
  settledAt: number;
  redeemDigest?: string;
  note?: string;
}

export interface VaultState {
  version: 1;
  keeperAddress: string;
  managerId: string;
  config: VaultConfig;
  openRound: VaultOpenRound | null;
  /** Newest last. Capped by the keeper. */
  history: VaultRoundResult[];
  totals: { rounds: number; wins: number; losses: number; pnl_raw: number };
  startedAt: number;
  updatedAt: number;
  /** Set when the keeper pauses itself (e.g. balance below floor). */
  pausedReason?: string | null;
}
