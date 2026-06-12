"use client";
// Per-leader copy status on the investor detail page. Makes the otherwise-invisible
// copy flow explicit: shows whether there's a bet to copy right now (with a Copy
// button), or explains why not — instead of the user following and seeing nothing.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useFollowState } from "@/hooks/useFollowState.js";
import { useManagerBalance } from "@/hooks/useManagerBalance.js";
import { amountToDusdc, fetchCopyResult } from "@/lib/copytrade/copyResult.js";
import { STRATEGY_LABELS } from "@/lib/leaderboard/investorDetail.js";
import { formatDusdcNumber } from "@/lib/format.js";
import { CopyTradeModal } from "./CopyTradeModal.js";

function Panel({ tone, children }: { tone: "amber" | "muted" | "emerald"; children: React.ReactNode }) {
  const cls =
    tone === "amber"
      ? "border-amber-900/40 bg-amber-500/10 text-amber-200/90"
      : tone === "emerald"
      ? "border-emerald-800/50 bg-emerald-500/10 text-emerald-100"
      : "border-zinc-800/70 bg-zinc-900/40 text-zinc-400";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function CopyStatusPanel({ leaderAddress }: { leaderAddress: string }) {
  const { followed, isFollowing } = useFollowState();
  const following = isFollowing(leaderAddress);
  const cfg = followed.find((f) => f.leaderAddress.toLowerCase() === leaderAddress.toLowerCase());
  const amountDusdc = cfg ? amountToDusdc(cfg.followerAmount_raw) : 0;

  const account = useCurrentAccount();
  const { data: balance } = useManagerBalance();
  const followerManagerId = balance?.managerId ?? null;
  const [showModal, setShowModal] = useState(false);

  const enabled = following && !!followerManagerId && amountDusdc > 0;
  const { data: result, isLoading } = useQuery({
    queryKey: ["copy-status", leaderAddress, followerManagerId, amountDusdc],
    enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
    queryFn: () => fetchCopyResult(leaderAddress, followerManagerId!, amountDusdc),
  });

  if (!following) return null;

  // Followed, but can't copy without a funded game account.
  if (!account || !followerManagerId) {
    return (
      <Panel tone="amber">
        You&apos;re following ✓ — connect your wallet and fund your account on{" "}
        <span className="font-medium">Play</span> to copy this player&apos;s bets.
      </Panel>
    );
  }

  if (isLoading || !result) {
    return <Panel tone="muted">Following ✓ — checking for a bet to copy…</Panel>;
  }

  // A live, copyable bet → offer to copy it right now.
  if (result.copyable && result.copyParams) {
    const p = result.copyParams;
    return (
      <>
        <Panel tone="emerald">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-emerald-200">This player has an open bet you can copy</div>
              <div className="mt-0.5 text-xs text-emerald-200/70">
                {STRATEGY_LABELS[p.strategyType]} · you pay {formatDusdcNumber(Number(p.cost_raw))} · max win{" "}
                {formatDusdcNumber(Number(p.payout_raw))}
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            >
              Copy now
            </button>
          </div>
        </Panel>
        {showModal && (
          <CopyTradeModal
            leaderAddress={leaderAddress}
            result={result}
            followerManagerId={followerManagerId}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // Followed, account ready, but nothing to copy at the moment.
  return (
    <Panel tone="muted">
      <span className="text-zinc-300">Following ✓</span> — no open bet to copy right now
      {result.reason ? ` (${result.reason.replace(/\.$/, "").toLowerCase()})` : ""}. We&apos;ll prompt you
      automatically the moment they place a new one, betting {amountDusdc} DUSDC each time.
    </Panel>
  );
}
