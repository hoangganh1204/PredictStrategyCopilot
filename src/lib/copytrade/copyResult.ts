// Shared copy-trade result shape + parsing + fetch. Used by the global watcher
// (useCopyTrade) and the per-leader status panel (CopyStatusPanel) so they agree.
import { DUSDC_SCALE } from "@/config/predict.js";
import type { CopyParams, StrategyType } from "./types.js";

export interface CopyResult {
  copyable: boolean;
  strategyType?: StrategyType;
  copyParams?: CopyParams;
  reason?: string;
}

interface SerializedCopyParams {
  strategyType: StrategyType;
  oracleId: string;
  strike_raw?: string;
  lowerStrike_raw?: string;
  upperStrike_raw?: string;
  isUp?: boolean;
  quantity_raw: string;
  cost_raw: string;
  payout_raw: string;
  expiryMs: number;
}

interface ApiResponse {
  copyable: boolean;
  strategyType?: StrategyType;
  copyParams?: SerializedCopyParams;
  reason?: string;
}

function parseCopyParams(p: SerializedCopyParams): CopyParams {
  return {
    strategyType: p.strategyType,
    oracleId: p.oracleId,
    strike_raw: p.strike_raw !== undefined ? BigInt(p.strike_raw) : undefined,
    lowerStrike_raw: p.lowerStrike_raw !== undefined ? BigInt(p.lowerStrike_raw) : undefined,
    upperStrike_raw: p.upperStrike_raw !== undefined ? BigInt(p.upperStrike_raw) : undefined,
    isUp: p.isUp,
    quantity_raw: BigInt(p.quantity_raw),
    cost_raw: BigInt(p.cost_raw),
    payout_raw: BigInt(p.payout_raw),
    expiryMs: p.expiryMs,
  };
}

export function toCopyResult(body: ApiResponse): CopyResult {
  return {
    copyable: !!body.copyable,
    strategyType: body.strategyType,
    copyParams: body.copyParams ? parseCopyParams(body.copyParams) : undefined,
    reason: body.reason,
  };
}

/** Stable identity for a copyable bet — so we only prompt once per position. */
export function copyKey(leader: string, p: CopyParams): string {
  const lvl = p.strategyType === "range" ? `${p.lowerStrike_raw}-${p.upperStrike_raw}` : `${p.strike_raw}`;
  return `${leader}|${p.oracleId}|${lvl}|${p.expiryMs}`;
}

/** Fetch the live copy result for one leader, scaled to a follower stake (DUSDC). */
export async function fetchCopyResult(
  leaderAddress: string,
  followerManagerId: string,
  amountDusdc: number
): Promise<CopyResult> {
  const url = `/api/leaders/${leaderAddress}/latest-position?followerAmount=${amountDusdc}&followerManager=${followerManagerId}`;
  const res = await fetch(url);
  return toCopyResult((await res.json()) as ApiResponse);
}

/** Convert a raw follower amount (1e6) to a DUSDC number for the API query. */
export function amountToDusdc(amount_raw: bigint): number {
  return Number(amount_raw) / Number(DUSDC_SCALE);
}
