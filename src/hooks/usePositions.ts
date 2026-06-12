"use client";
// TanStack Query hook: fetch positions from Public Server for connected wallet.
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useManagerBalance } from "./useManagerBalance.js";
import { fetchPositionsSummary, fetchPositionsRaw } from "@/lib/predict-client.js";
import type { PositionSummaryItem } from "@/types/predict-server.js";
import type { PositionState } from "@/lib/execute/types.js";

export interface Position extends PositionSummaryItem {
  positionState: PositionState;
  /** Derived from is_up for display — "up" | "down" | undefined (range) */
  direction?: "up" | "down";
  /** Mint transaction digest, for an explorer link. */
  mintDigest?: string;
}

export const POSITIONS_KEY = ["positions"] as const;

/**
 * Map the Public Server's position status to our UI PositionState.
 * Verified server vocabulary (testnet): "active", "redeemable", "lost", "redeemed".
 * ("redeemable" = won and claimable; "lost" = settled loss.)
 */
function toPositionState(status: string): PositionState {
  switch (status) {
    case "active":              return "active";
    case "redeemable":         return "settled_won";  // won, ready to claim
    case "lost":               return "settled_lost";
    case "redeemed":           return "redeemed";
    // Tolerate alternate/legacy spellings if the server ever emits them:
    case "settled_won":        return "settled_won";
    case "settled_lost":       return "settled_lost";
    case "awaiting_settlement":
    case "pending":            return "awaiting_settlement";
    default:                   return "active";
  }
}

export function usePositions() {
  const account = useCurrentAccount();
  const { data: balance } = useManagerBalance();
  const managerId = balance?.managerId;

  return useQuery<Position[]>({
    queryKey: [...POSITIONS_KEY, account?.address],
    enabled: !!account && !!managerId,
    staleTime: 5_000,
    // Poll so positions flip to Won/Lost (and the redeem button appears) shortly
    // after settlement (~11s past expiry) without a manual page reload.
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!managerId) return [];
      const [items, raw] = await Promise.all([
        fetchPositionsSummary(managerId),
        fetchPositionsRaw(managerId).catch(() => ({ minted: [], redeemed: [] })),
      ]);

      // Map each (oracle, direction, strike) to its latest mint tx digest.
      const digestByKey = new Map<string, { ts: number; digest: string }>();
      for (const m of raw.minted ?? []) {
        const key = `${m.oracle_id}|${m.is_up}|${m.strike}`;
        const prev = digestByKey.get(key);
        if (!prev || m.checkpoint_timestamp_ms > prev.ts) {
          digestByKey.set(key, { ts: m.checkpoint_timestamp_ms, digest: m.digest });
        }
      }

      return items.map((item) => ({
        ...item,
        positionState: toPositionState(item.status),
        direction:
          item.is_up === true ? "up" as const :
          item.is_up === false ? "down" as const :
          undefined,
        mintDigest: digestByKey.get(`${item.oracle_id}|${item.is_up}|${item.strike}`)?.digest,
      }));
    },
  });
}
