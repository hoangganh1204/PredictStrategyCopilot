"use client";
// PredictManager is a SHARED object — find via the Public Server's owner index.
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { DUSDC_SCALE } from "@/config/predict.js";
import { fetchManagerSummary } from "@/lib/predict-client.js";
import { findManagerId } from "@/lib/execute/findManager.js";

export interface ManagerBalance {
  managerId: string | null;
  balance_raw: bigint;
  balance_dusdc: number;
}

export const MANAGER_BALANCE_KEY = ["manager-balance"] as const;

export function useManagerBalance() {
  const account = useCurrentAccount();

  return useQuery<ManagerBalance | null>({
    queryKey: [...MANAGER_BALANCE_KEY, account?.address],
    enabled: !!account,
    staleTime: 5_000,
    // Poll every 3s until manager is found (handles indexer delay after create_manager)
    refetchInterval: (query) =>
      query.state.data?.managerId === null ? 3_000 : false,
    queryFn: async () => {
      if (!account) return null;

      try {
        const managerId = await findManagerId(account.address);
        if (!managerId) {
          return { managerId: null, balance_raw: 0n, balance_dusdc: 0 };
        }

        const summary = await fetchManagerSummary(managerId);
        const rawBalance = summary.trading_balance ?? summary.balances?.[0]?.balance ?? 0;
        const balance_raw = BigInt(Math.round(rawBalance));
        return {
          managerId,
          balance_raw,
          balance_dusdc: Number(balance_raw) / Number(DUSDC_SCALE),
        };
      } catch (err) {
        console.error("[useManagerBalance]", err);
        // Return null so the UI shows "Create account" instead of an infinite skeleton
        return { managerId: null, balance_raw: 0n, balance_dusdc: 0 };
      }
    },
  });
}
