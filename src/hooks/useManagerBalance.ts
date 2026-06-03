"use client";
// TanStack Query hook: get DUSDC balance from PredictManager.
// On first call: findOrCreateManager → fetch /managers/:id/summary → return balance.
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useSuiClient } from "@mysten/dapp-kit";
import { PREDICT_CONFIG, DUSDC_SCALE } from "@/config/predict.js";
import { fetchManagerSummary } from "@/lib/predict-client.js";
import type { ManagerDeps } from "@/lib/execute/findOrCreateManager.js";
import { findOrCreateManager } from "@/lib/execute/findOrCreateManager.js";
import type { TxResult } from "@/lib/execute/types.js";

export interface ManagerBalance {
  managerId: string;
  balance_raw: bigint;
  /** Formatted for display: balance_raw ÷ 1e6 */
  balance_dusdc: number;
}

export const MANAGER_BALANCE_KEY = ["manager-balance"] as const;

export function useManagerBalance() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  return useQuery<ManagerBalance | null>({
    queryKey: [...MANAGER_BALANCE_KEY, account?.address],
    enabled: !!account,
    staleTime: 5_000,
    queryFn: async () => {
      if (!account) return null;

      // Build signAndExecute that throws (balance query only — never signs)
      const dummySignAndExecute = async (): Promise<TxResult> => {
        throw new Error("signAndExecute not available in query context");
      };

      const deps: ManagerDeps = {
        walletAddress: account.address,
        listOwnedObjects: async (owner, structType) => {
          const result = await suiClient.getOwnedObjects({
            owner,
            filter: { StructType: structType },
            options: { showType: true },
          });
          return { data: result.data.map((d) => ({ objectId: d.data?.objectId ?? "" })) };
        },
        signAndExecute: dummySignAndExecute,
      };

      const managerId = await findOrCreateManager(deps);
      const summary = await fetchManagerSummary(managerId);

      const balance_raw = BigInt(Math.round(summary.balance));
      return {
        managerId,
        balance_raw,
        balance_dusdc: Number(balance_raw) / Number(DUSDC_SCALE),
      };
    },
  });
}
