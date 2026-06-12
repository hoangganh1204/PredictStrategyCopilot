"use client";
// T089 — Global host: watches followed leaders and shows the copy modal whenever
// any of them has a fresh copyable bet. Mounted once in Providers.
import { useManagerBalance } from "@/hooks/useManagerBalance.js";
import { useCopyTrade } from "@/hooks/useCopyTrade.js";
import { CopyTradeModal } from "@/components/CopyTradeModal.js";

export function CopyTradeHost() {
  const { data: balance } = useManagerBalance();
  const followerManagerId = balance?.managerId ?? null;
  const { pending, resultFor, clearPendingCopy } = useCopyTrade(followerManagerId);

  if (!pending) return null;

  // Prefer the live result so eligibility changes reflect while the modal is open.
  const result = resultFor(pending.leaderAddress) ?? pending.result;

  return (
    <CopyTradeModal
      leaderAddress={pending.leaderAddress}
      result={result}
      followerManagerId={followerManagerId}
      onClose={clearPendingCopy}
    />
  );
}
