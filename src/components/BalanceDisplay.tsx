"use client";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useManagerBalance } from "@/hooks/useManagerBalance.js";
import { formatDusdc } from "@/lib/format.js";

function Skeleton() {
  return <div className="h-5 w-28 animate-pulse rounded bg-zinc-700" />;
}

export function BalanceDisplay() {
  const account = useCurrentAccount();
  const { data, isLoading } = useManagerBalance();

  if (!account) return null;
  if (isLoading || !data) return <Skeleton />;

  return (
    <span className="text-sm font-mono text-zinc-200">
      {formatDusdc(data.balance_raw)}
    </span>
  );
}
