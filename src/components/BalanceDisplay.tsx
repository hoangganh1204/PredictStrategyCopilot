"use client";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useManagerBalance } from "@/hooks/useManagerBalance.js";

function formatDusdc(amount_raw: bigint): string {
  const value = Number(amount_raw) / 1_000_000;
  return value.toFixed(2);
}

function Skeleton() {
  return (
    <div className="h-5 w-28 animate-pulse rounded bg-zinc-700" />
  );
}

/**
 * Displays the user's DUSDC game account balance.
 * Shows skeleton while loading, hides when wallet not connected.
 */
export function BalanceDisplay() {
  const account = useCurrentAccount();
  const { data, isLoading } = useManagerBalance();

  if (!account) return null;

  if (isLoading || !data) return <Skeleton />;

  return (
    <span className="text-sm font-mono text-zinc-200">
      {formatDusdc(data.balance_raw)}{" "}
      <span className="text-zinc-400">DUSDC</span>
    </span>
  );
}
