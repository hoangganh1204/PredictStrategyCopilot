"use client";
// T086 — Watch every followed leader for a fresh copyable bet. Polls the
// latest-position API (10s) per leader and surfaces the first new copyable one
// as `pending`. Stops polling a leader as soon as they're unfollowed.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { DUSDC_SCALE } from "@/config/predict.js";
import type { CopyParams, StrategyType } from "@/lib/copytrade/types.js";
import { useFollowState } from "./useFollowState.js";

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

function toResult(body: ApiResponse): CopyResult {
  return {
    copyable: !!body.copyable,
    strategyType: body.strategyType,
    copyParams: body.copyParams ? parseCopyParams(body.copyParams) : undefined,
    reason: body.reason,
  };
}

/** Stable identity for a copyable bet — so we only prompt once per position. */
function copyKey(leader: string, p: CopyParams): string {
  const lvl = p.strategyType === "range" ? `${p.lowerStrike_raw}-${p.upperStrike_raw}` : `${p.strike_raw}`;
  return `${leader}|${p.oracleId}|${lvl}|${p.expiryMs}`;
}

interface Pending {
  leaderAddress: string;
  result: CopyResult;
}

export interface UseCopyTradeReturn {
  pending: Pending | null;
  /** Live result for a leader (so an open modal reflects eligibility changes). */
  resultFor: (leaderAddress: string) => CopyResult | undefined;
  clearPendingCopy: () => void;
}

export function useCopyTrade(followerManagerId: string | null): UseCopyTradeReturn {
  const { followed } = useFollowState();
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);

  const results = useQueries({
    queries: followed.map((f) => ({
      queryKey: ["copy-trade", f.leaderAddress, followerManagerId, f.followerAmount_raw.toString()],
      enabled: !!followerManagerId,
      refetchInterval: 10_000,
      staleTime: 5_000,
      queryFn: async (): Promise<{ leaderAddress: string; result: CopyResult }> => {
        const amount = Number(f.followerAmount_raw) / Number(DUSDC_SCALE);
        const url = `/api/leaders/${f.leaderAddress}/latest-position?followerAmount=${amount}&followerManager=${followerManagerId}`;
        const res = await fetch(url);
        const body = (await res.json()) as ApiResponse;
        return { leaderAddress: f.leaderAddress, result: toResult(body) };
      },
    })),
  });

  // Map leader → live result (used by the open modal).
  const byLeader = useMemo(() => {
    const m = new Map<string, CopyResult>();
    for (const q of results) if (q.data) m.set(q.data.leaderAddress, q.data.result);
    return m;
  }, [results]);

  // Signature of currently-copyable bets, so the effect only runs on real changes.
  const copyableSig = useMemo(() => {
    const keys: string[] = [];
    for (const q of results) {
      const d = q.data;
      if (d?.result.copyable && d.result.copyParams) keys.push(copyKey(d.leaderAddress, d.result.copyParams));
    }
    return keys.join(",");
  }, [results]);

  useEffect(() => {
    if (pending) return; // one prompt at a time
    for (const q of results) {
      const d = q.data;
      if (d?.result.copyable && d.result.copyParams) {
        const key = copyKey(d.leaderAddress, d.result.copyParams);
        if (!seen.has(key)) {
          // Surfacing async poll data as a one-time prompt — the legitimate
          // "subscribe to an external system" effect use. Kept sticky so the
          // modal stays open (and can show an ineligibility reason) if the
          // position later flips, until the user dismisses it.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPending(d);
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyableSig, pending, seen]);

  const clearPendingCopy = useCallback(() => {
    setPending((p) => {
      if (p?.result.copyParams) {
        const key = copyKey(p.leaderAddress, p.result.copyParams);
        setSeen((s) => new Set(s).add(key));
      }
      return null;
    });
  }, []);

  const resultFor = useCallback((leaderAddress: string) => byLeader.get(leaderAddress), [byLeader]);

  return { pending, resultFor, clearPendingCopy };
}
