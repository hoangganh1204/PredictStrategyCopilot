"use client";
// T088 + T090 — Confirm-and-sign modal for a copyable leader bet.
// The follower ALWAYS confirms and signs in their own wallet (FR-021). When the
// bet is ineligible the Copy button is disabled and useExecuteTx is never called
// (FR-020). Labels match the rest of the app (English).
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { POSITIONS_KEY } from "@/hooks/usePositions.js";
import { RANGE_POSITIONS_KEY } from "@/hooks/useRangePositions.js";
import { MANAGER_BALANCE_KEY } from "@/hooks/useManagerBalance.js";
import { useExecuteTx } from "@/hooks/useExecuteTx.js";
import { useCountdown } from "@/hooks/useCountdown.js";
import { buildCopyMintTx } from "@/lib/copytrade/buildCopyMintTx.js";
import { truncateAddress } from "@/lib/leaderboard/computeLeaderboard.js";
import { STRATEGY_LABELS } from "@/lib/leaderboard/investorDetail.js";
import { formatDusdcNumber, formatCountdown } from "@/lib/format.js";
import { TxStatusOverlay } from "@/components/TxStatusOverlay.js";
import type { CopyResult } from "@/hooks/useCopyTrade.js";

interface CopyTradeModalProps {
  leaderAddress: string;
  result: CopyResult;
  followerManagerId: string | null;
  onClose: () => void;
}

export function CopyTradeModal({ leaderAddress, result, followerManagerId, onClose }: CopyTradeModalProps) {
  const account = useCurrentAccount();
  const { execute, isPending, lastResult } = useExecuteTx();
  const [submitted, setSubmitted] = useState(false);

  const copyParams = result.copyParams;
  // FR-020: copy is only possible when eligible AND we have a follower account.
  const canCopy = result.copyable && !!copyParams && !!followerManagerId;
  const expiryMs = copyParams?.expiryMs ?? 0;
  const remaining = useCountdown(expiryMs);

  async function handleCopy() {
    // Hard guard — never sign when ineligible (FR-020).
    if (!canCopy || !copyParams || !followerManagerId) return;
    const tx = buildCopyMintTx(copyParams, followerManagerId);
    setSubmitted(true);
    await execute(tx, [
      [...POSITIONS_KEY, account?.address],
      [...MANAGER_BALANCE_KEY, account?.address],
      [...RANGE_POSITIONS_KEY, account?.address, followerManagerId],
    ]);
  }

  function dismiss() {
    setSubmitted(false);
    onClose();
  }

  // Transaction in flight / finished → hand off to the shared status overlay.
  if (submitted && (isPending || lastResult)) {
    return <TxStatusOverlay isPending={isPending} result={lastResult} onDismiss={dismiss} />;
  }

  const label = copyParams ? STRATEGY_LABELS[copyParams.strategyType] : "Copy bet";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Copy this bet?</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Following <span className="font-mono text-zinc-400">{truncateAddress(leaderAddress)}</span>
            </p>
          </div>
          <button onClick={dismiss} className="rounded-lg p-1 text-zinc-500 hover:text-zinc-300" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {copyParams && (
          <div className="mt-4 flex flex-col gap-2.5 rounded-xl bg-zinc-900/60 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Strategy</span>
              <span className="font-medium text-zinc-200">{label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">You pay</span>
              <span className="font-mono text-zinc-100">{formatDusdcNumber(Number(copyParams.cost_raw))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Max win</span>
              <span className="font-mono text-emerald-400">{formatDusdcNumber(Number(copyParams.payout_raw))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Closes in</span>
              <span className="font-mono text-zinc-300">
                {remaining === null ? "—" : remaining <= 0 ? "Closed" : formatCountdown(remaining)}
              </span>
            </div>
          </div>
        )}

        {/* Ineligibility reason (T090) — market closed / data stale / low balance. */}
        {!result.copyable && (
          <div className="mt-4 rounded-xl border border-amber-900/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
            {result.reason ?? "This bet can't be copied right now."}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={dismiss}
            className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/60"
          >
            Not now
          </button>
          <button
            onClick={handleCopy}
            disabled={!canCopy}
            className="btn-primary flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {canCopy ? "Copy bet" : "Can't copy"}
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-zinc-600">
          You confirm and sign every copy in your own wallet.
        </p>
      </div>
    </div>
  );
}
