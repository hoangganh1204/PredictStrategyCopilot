"use client";
// TanStack Query hook: fetch positions from Public Server for connected wallet.
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useManagerBalance } from "./useManagerBalance.js";
import { fetchPositionsSummary } from "@/lib/predict-client.js";
import type { PositionSummaryItem } from "@/types/predict-server.js";
import type { PositionState } from "@/lib/execute/types.js";

export interface Position extends PositionSummaryItem {
  positionState: PositionState;
}

export const POSITIONS_KEY = ["positions"] as const;

/** Map server status string to PositionState enum. */
function toPositionState(status: string): PositionState {
  switch (status) {
    case "active":             return "active";
    case "awaiting_settlement":return "awaiting_settlement";
    case "settled_won":        return "settled_won";
    case "settled_lost":       return "settled_lost";
    case "redeemed":           return "redeemed";
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
    queryFn: async () => {
      if (!managerId) return [];
      const items = await fetchPositionsSummary(managerId);
      return items.map((item) => ({
        ...item,
        positionState: toPositionState(item.status),
      }));
    },
  });
}
