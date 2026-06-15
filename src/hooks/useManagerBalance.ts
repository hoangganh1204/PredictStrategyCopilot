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
    // Poll 3s until the manager is found (indexer delay after create_manager),
    // then 10s so the balance updates live as bets settle (incl. the auto-vault).
    refetchInterval: (query) =>
      query.state.data?.managerId === null ? 3_000 : 10_000,
    queryFn: async () => {
      if (!account) return null;

      // Resolve the manager. A failure here means we genuinely can't find an
      // account (or the lookup is down) → show the create-account state.
      let managerId: string | null = null;
      try {
        managerId = await findManagerId(account.address);
      } catch (err) {
        console.warn("[useManagerBalance] manager lookup failed", err);
        return { managerId: null, balance_raw: 0n, balance_dusdc: 0 };
      }
      if (!managerId) {
        return { managerId: null, balance_raw: 0n, balance_dusdc: 0 };
      }

      // Balance fetch can hit a transient 5xx — keep the managerId so the
      // account doesn't vanish; the next poll refreshes the balance.
      try {
        const summary = await fetchManagerSummary(managerId);
        const rawBalance = summary.trading_balance ?? summary.balances?.[0]?.balance ?? 0;
        const balance_raw = BigInt(Math.round(rawBalance));
        return {
          managerId,
          balance_raw,
          balance_dusdc: Number(balance_raw) / Number(DUSDC_SCALE),
        };
      } catch (err) {
        console.warn("[useManagerBalance] balance fetch failed, keeping manager", err);
        return { managerId, balance_raw: 0n, balance_dusdc: 0 };
      }
    },
  });
}
