"use client";
// T086 — Watch every followed leader for a fresh copyable bet. Polls the
// latest-position API (10s) per leader and surfaces the first new copyable one
// as `pending`. Stops polling a leader as soon as they're unfollowed.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { amountToDusdc, copyKey, fetchCopyResult, type CopyResult } from "@/lib/copytrade/copyResult.js";
import { useFollowState } from "./useFollowState.js";

export type { CopyResult };

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
        const result = await fetchCopyResult(f.leaderAddress, followerManagerId!, amountToDusdc(f.followerAmount_raw));
        return { leaderAddress: f.leaderAddress, result };
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
