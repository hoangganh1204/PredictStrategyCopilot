"use client";
// Auto-Vault dashboard data: keeper state from /api/vault + live vault balance
// straight from the Public Server. Works without a connected wallet.
import { useQuery } from "@tanstack/react-query";
import { fetchManagerSummary } from "@/lib/predict-client.js";
import type { VaultState } from "@/lib/vault/types.js";

interface VaultApiResponse {
  ok: boolean;
  state: VaultState | null;
  paused: boolean;
}

export function useVault() {
  const stateQuery = useQuery<VaultApiResponse>({
    queryKey: ["vault-state"],
    refetchInterval: 10_000,
    queryFn: async () => (await fetch("/api/vault")).json(),
  });
  const state = stateQuery.data?.ok ? stateQuery.data.state : null;
  const paused = stateQuery.data?.paused ?? false;
  const managerId = state?.managerId ?? null;

  async function setPaused(next: boolean) {
    await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: next }),
    });
    await stateQuery.refetch();
  }

  const balanceQuery = useQuery<number>({
    queryKey: ["vault-balance", managerId],
    enabled: !!managerId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const s = await fetchManagerSummary(managerId!);
      return s.trading_balance ?? s.balances?.[0]?.balance ?? 0;
    },
  });

  return {
    state,
    paused,
    setPaused,
    balanceRaw: balanceQuery.data ?? null,
    isLoading: stateQuery.isLoading,
  };
}
